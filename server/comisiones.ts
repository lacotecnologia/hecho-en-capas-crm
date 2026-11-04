/**
 * Comisiones del comercial: se anotan solas cuando el pedido se cierra y se
 * descuentan cuando hay una devolución. Las rutas están en rutas/comisiones.ts.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm'
import {
  descuentoPorDevolucion,
  ganaComision,
  type MetodoComision,
  type MovimientoComision,
  type PagoComision,
  type ResumenComisiones,
  type TipoMovimiento,
} from '../shared/comisiones.js'
import { limitesMes, mesActual } from '../shared/reportes.js'
import { type getDb } from './db/index.js'
import { clientes, comisiones, pagosComision, pedidos, usuarios } from './db/schema.js'
import { type Tx } from './pedidos-logica.js'

type Db = ReturnType<typeof getDb> | Tx

/** El pedido quedó Cerrado: su comercial gana la comisión (una sola vez). */
export async function anotarComisionGanada(
  tx: Tx,
  p: { id: number; comercialId: number; ganancia: number; codigo: string }
) {
  if (p.ganancia <= 0) return
  const [u] = await tx
    .select({ roles: usuarios.roles })
    .from(usuarios)
    .where(eq(usuarios.id, p.comercialId))
  if (!u || !ganaComision(u.roles)) return
  await tx
    .insert(comisiones)
    .values({
      comercialId: p.comercialId,
      pedidoId: p.id,
      tipo: 'ganada',
      monto: p.ganancia,
      nota: `Pedido ${p.codigo} cerrado`,
    })
    .onConflictDoNothing()
}

/** Si un pedido deja de estar Cerrado, la comisión aún no pagada se quita. */
export async function quitarComisionSinPagar(tx: Tx, pedidoId: number) {
  await tx
    .delete(comisiones)
    .where(
      and(
        eq(comisiones.pedidoId, pedidoId),
        eq(comisiones.tipo, 'ganada'),
        isNull(comisiones.pagoId)
      )
    )
}

/**
 * Se le devolvió plata al cliente. Si la comisión del pedido ya se ganó,
 * se anota un descuento; si no, baja la ganancia del pedido (y así la comisión
 * que ganará al cerrarse).
 */
export async function aplicarDevolucion(
  tx: Tx,
  pedidoId: number,
  devuelto: number,
  usuarioId: number
) {
  const movs = await tx
    .select({ tipo: comisiones.tipo, monto: comisiones.monto, comercialId: comisiones.comercialId })
    .from(comisiones)
    .where(eq(comisiones.pedidoId, pedidoId))
  const ganada = movs.find((m) => m.tipo === 'ganada')
  if (ganada) {
    const restante = movs.reduce((s, m) => s + m.monto, 0)
    const monto = descuentoPorDevolucion(devuelto, restante)
    if (monto > 0) {
      const [p] = await tx.select({ codigo: pedidos.codigo }).from(pedidos).where(eq(pedidos.id, pedidoId))
      await tx.insert(comisiones).values({
        comercialId: ganada.comercialId,
        pedidoId,
        tipo: 'descuento',
        monto: -monto,
        nota: `Devolución al cliente en ${p?.codigo ?? 'el pedido'}`,
        creadoPor: usuarioId,
      })
    }
    return
  }
  await tx
    .update(pedidos)
    .set({ ganancia: sql`greatest(0, ${pedidos.ganancia} - ${devuelto})` })
    .where(eq(pedidos.id, pedidoId))
}

// ===================== Resumen =====================

async function movimientos(db: Db, condicion: ReturnType<typeof and>) {
  const filas = await db
    .select({
      m: comisiones,
      codigo: pedidos.codigo,
      cliente: clientes.nombre,
    })
    .from(comisiones)
    .leftJoin(pedidos, eq(pedidos.id, comisiones.pedidoId))
    .leftJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(condicion)
    .orderBy(desc(comisiones.creadoEn), desc(comisiones.id))
  return filas.map(
    ({ m, codigo, cliente }): MovimientoComision => ({
      id: m.id,
      tipo: m.tipo as TipoMovimiento,
      monto: m.monto,
      nota: m.nota,
      pedido: m.pedidoId && codigo ? { id: m.pedidoId, codigo, cliente: cliente ?? '' } : null,
      creadoEn: m.creadoEn.toISOString(),
      pagoId: m.pagoId,
    })
  )
}

/** Todo lo de comisiones de un comercial: por ganar, por pagar, pagos. */
export async function resumenComisiones(
  db: Db,
  comercial: { id: number; nombre: string; activo: boolean }
): Promise<ResumenComisiones> {
  const abiertos = await db
    .select({
      id: pedidos.id,
      codigo: pedidos.codigo,
      cliente: clientes.nombre,
      estado: pedidos.estado,
      ganancia: pedidos.ganancia,
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .where(
      and(
        eq(pedidos.comercialId, comercial.id),
        notInArray(pedidos.estado, ['cerrado', 'cancelado']),
        isNull(pedidos.borradoEn)
      )
    )
    .orderBy(asc(pedidos.id))
  const pendientes = await movimientos(
    db,
    and(eq(comisiones.comercialId, comercial.id), isNull(comisiones.pagoId))
  )
  const pagosFilas = await db
    .select({ p: pagosComision, quien: usuarios.nombre })
    .from(pagosComision)
    .leftJoin(usuarios, eq(usuarios.id, pagosComision.pagadoPor))
    .where(eq(pagosComision.comercialId, comercial.id))
    .orderBy(desc(pagosComision.id))
    .limit(24)
  const ids = pagosFilas.map((x) => x.p.id)
  const liquidados = ids.length
    ? await movimientos(db, inArray(comisiones.pagoId, ids))
    : []
  const { desde, hasta } = limitesMes(mesActual())
  const [mes] = await db
    .select({ total: sql<number>`coalesce(sum(${pagosComision.total}), 0)::int` })
    .from(pagosComision)
    .where(
      and(
        eq(pagosComision.comercialId, comercial.id),
        gte(pagosComision.creadoEn, desde),
        lt(pagosComision.creadoEn, hasta)
      )
    )
  const pagos: PagoComision[] = pagosFilas.map(({ p, quien }) => ({
    id: p.id,
    total: p.total,
    metodo: p.metodo as MetodoComision,
    referencia: p.referencia,
    comprobanteUrl: p.comprobanteUrl,
    nota: p.nota,
    porFuera: p.porFuera,
    pagadoPor: quien ?? '—',
    creadoEn: p.creadoEn.toISOString(),
    movimientos: liquidados.filter((m) => m.pagoId === p.id),
  }))
  return {
    comercial,
    porGanar: abiertos.reduce((s, x) => s + Math.max(0, x.ganancia), 0),
    porPagar: pendientes.reduce((s, m) => s + m.monto, 0),
    pagadoMes: mes?.total ?? 0,
    pedidosPorGanar: abiertos.filter((x) => x.ganancia > 0),
    pendientes,
    pagos,
  }
}
