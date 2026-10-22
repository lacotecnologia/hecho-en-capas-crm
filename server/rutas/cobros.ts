import { and, desc, eq, gte, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  estadoPago,
  type PedidoPorCobrar,
  type ResumenCobros,
} from '../../shared/entregas.js'
import { anticipoPendiente } from '../../shared/pedidos.js'
import { getDb } from '../db/index.js'
import { clientes, entregas, pagos, pedidos, usuarios } from '../db/schema.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'

export const rutasCobros = new Hono<{ Variables: Variables }>()

rutasCobros.use('*', conSesion, soloRoles('admin', 'comercial'))

/** Inicio del día y del mes en hora de Colombia (UTC-5, sin horario de verano). */
function iniciosBogota() {
  const ahora = new Date(Date.now() - 5 * 3_600_000)
  const dia = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()) + 5 * 3_600_000
  const mes = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1) + 5 * 3_600_000
  return { dia: new Date(dia), mes: new Date(mes) }
}

rutasCobros.get('/', async (c) => {
  const u = c.get('usuario')
  const db = getDb()
  const soloMios = !u.roles.includes('admin')
  const filas = await db
    .select({
      p: pedidos,
      cliente: clientes.nombre,
      whatsapp: clientes.whatsapp,
      comercial: usuarios.nombre,
      contraentrega: entregas.contraentrega,
      pagado: sql<number>`(select coalesce(sum(monto), 0)::int from pagos where pagos.pedido_id = ${pedidos.id})`,
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .innerJoin(usuarios, eq(usuarios.id, pedidos.comercialId))
    .leftJoin(entregas, eq(entregas.pedidoId, pedidos.id))
    .where(soloMios ? eq(pedidos.comercialId, u.id) : undefined)

  const fila = (f: (typeof filas)[number]): PedidoPorCobrar => {
    const cancelado = f.p.estado === 'cancelado'
    return {
      id: f.p.id,
      codigo: f.p.codigo,
      estado: f.p.estado,
      cliente: { nombre: f.cliente, whatsapp: f.whatsapp },
      comercial: f.comercial,
      total: f.p.total,
      pagado: f.pagado,
      saldo: f.p.total - f.pagado,
      anticipoPendiente: cancelado ? 0 : anticipoPendiente({ ...f.p, pagado: f.pagado }),
      estadoPago: estadoPago({ ...f.p, pagado: f.pagado, cancelado }),
      contraentrega: f.contraentrega ?? false,
      fechaCompromiso: f.p.fechaCompromiso?.toISOString() ?? null,
    }
  }
  const porCobrar = filas
    .filter((f) => f.p.estado !== 'cancelado' && f.p.total - f.pagado > 0)
    .map(fila)
    // Primero lo entregado sin pagar, luego por fecha prometida
    .sort(
      (a, b) =>
        Number(['entregado'].includes(b.estado)) - Number(['entregado'].includes(a.estado)) ||
        (a.fechaCompromiso ?? '9').localeCompare(b.fechaCompromiso ?? '9')
    )
  const porDevolver = filas.filter((f) => f.p.estado === 'cancelado' && f.pagado > 0).map(fila)

  const { dia, mes } = iniciosBogota()
  const hace60 = new Date(Date.now() - 60 * 86_400_000)
  const lista = await db
    .select({
      x: pagos,
      usuario: usuarios.nombre,
      codigo: pedidos.codigo,
      comercialId: pedidos.comercialId,
      cliente: clientes.nombre,
    })
    .from(pagos)
    .innerJoin(pedidos, eq(pedidos.id, pagos.pedidoId))
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .leftJoin(usuarios, eq(usuarios.id, pagos.usuarioId))
    .where(and(gte(pagos.creadoEn, hace60), soloMios ? eq(pedidos.comercialId, u.id) : undefined))
    .orderBy(desc(pagos.id))
    .limit(200)
  const suma = (desde: Date) =>
    lista.filter((l) => l.x.creadoEn >= desde).reduce((s, l) => s + l.x.monto, 0)

  const r: ResumenCobros = {
    porCobrar,
    porDevolver,
    pagos: lista.map(({ x, usuario, codigo, cliente }) => ({
      id: x.id,
      tipo: x.tipo,
      metodo: x.metodo,
      monto: x.monto,
      referencia: x.referencia,
      nota: x.nota,
      comprobanteUrl: x.comprobanteUrl,
      usuario: usuario ?? '—',
      creadoEn: x.creadoEn.toISOString(),
      pedido: { id: x.pedidoId, codigo, cliente },
    })),
    totales: {
      hoy: suma(dia),
      mes: suma(mes),
      porCobrar: porCobrar.reduce((s, p) => s + p.saldo, 0),
    },
  }
  return c.json(r)
})
