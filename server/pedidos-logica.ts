/**
 * Lógica compartida de pedidos y cola: el estado del pedido se recalcula
 * siempre aquí, después de cada cambio (orden, pago, cancelación).
 */
import { and, eq, inArray, sql } from 'drizzle-orm'
import { sumarDiasHabiles } from '../shared/cotizacion.js'
import {
  calcularEstadoPedido,
  type EstadoOrden,
  type EstadoPedido,
  puedeProducir,
} from '../shared/pedidos.js'
import { type getDb } from './db/index.js'
import {
  historialEstados,
  ordenesProduccion,
  pagos,
  pedidoLineas,
  pedidos,
} from './db/schema.js'

export type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0]

export async function anotar(
  tx: Tx,
  e: {
    entidad: 'pedido' | 'orden'
    entidadId: number
    de?: string | null
    a?: string | null
    nota?: string
    visibleCliente?: boolean
    usuarioId: number | null
  }
) {
  await tx.insert(historialEstados).values({
    entidad: e.entidad,
    entidadId: e.entidadId,
    de: e.de ?? null,
    a: e.a ?? null,
    nota: e.nota ?? '',
    visibleCliente: e.visibleCliente ?? false,
    usuarioId: e.usuarioId,
  })
}

export async function totalPagado(tx: Tx, pedidoId: number) {
  const [f] = await tx
    .select({ total: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .where(eq(pagos.pedidoId, pedidoId))
  return f?.total ?? 0
}

/** Estado de cada línea: listo si salió de stock; si no, el de su orden. */
export async function estadosDeLineas(tx: Tx, pedidoId: number) {
  const lineas = await tx
    .select({ id: pedidoLineas.id, desdeStock: pedidoLineas.desdeStock })
    .from(pedidoLineas)
    .where(eq(pedidoLineas.pedidoId, pedidoId))
  const ordenes = await tx
    .select({ lineaId: ordenesProduccion.lineaId, estado: ordenesProduccion.estado })
    .from(ordenesProduccion)
    .where(eq(ordenesProduccion.pedidoId, pedidoId))
  const porLinea = new Map(ordenes.map((o) => [o.lineaId, o.estado as EstadoOrden]))
  return new Map(
    lineas.map((l) => [l.id, l.desdeStock ? 'listo' : (porLinea.get(l.id) ?? 'en_cola')] as const)
  )
}

/**
 * Recalcula el estado del pedido. Si ya se puede producir, suelta las órdenes
 * que esperaban el anticipo y fija la fecha prometida.
 */
export async function recalcularPedido(tx: Tx, pedidoId: number, usuarioId: number | null) {
  const [p] = await tx.select().from(pedidos).where(eq(pedidos.id, pedidoId)).for('update')
  if (!p) return null
  const pagado = await totalPagado(tx, pedidoId)
  const base = {
    requiereAnticipo: p.requiereAnticipo,
    producirSinAnticipo: p.producirSinAnticipo,
    anticipo: p.anticipo,
    pagado,
  }
  const cambios: Partial<typeof pedidos.$inferInsert> = {}

  if (p.estado !== 'cancelado' && puedeProducir(base)) {
    const esperando = await tx
      .select({ id: ordenesProduccion.id })
      .from(ordenesProduccion)
      .where(
        and(eq(ordenesProduccion.pedidoId, pedidoId), eq(ordenesProduccion.estado, 'espera_anticipo'))
      )
    if (esperando.length) {
      await tx
        .update(ordenesProduccion)
        .set({ estado: 'en_cola', actualizadoEn: new Date() })
        .where(inArray(ordenesProduccion.id, esperando.map((o) => o.id)))
      for (const o of esperando) {
        await anotar(tx, {
          entidad: 'orden',
          entidadId: o.id,
          de: 'espera_anticipo',
          a: 'en_cola',
          usuarioId,
        })
      }
    }
    if (!p.fechaCompromiso) {
      cambios.fechaCompromiso = sumarDiasHabiles(new Date(), p.diasFabricacion + p.diasEnvio)
    }
  }

  const estados = await estadosDeLineas(tx, pedidoId)
  const estado: EstadoPedido = calcularEstadoPedido({
    ...base,
    cancelado: p.estado === 'cancelado',
    total: p.total,
    estadosLineas: [...estados.values()],
  })
  if (estado !== p.estado) {
    cambios.estado = estado
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: pedidoId,
      de: p.estado,
      a: estado,
      visibleCliente: true,
      usuarioId,
    })
  }
  if (Object.keys(cambios).length) {
    await tx
      .update(pedidos)
      .set({ ...cambios, actualizadoEn: new Date() })
      .where(eq(pedidos.id, pedidoId))
  }
  return estado
}
