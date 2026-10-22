import { and, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { estadoPago } from '../../shared/entregas.js'
import {
  diaBogota,
  limitesMes,
  MES_VALIDO,
  mesActual,
  type ReporteMes,
} from '../../shared/reportes.js'
import { getDb } from '../db/index.js'
import { clientes, entregas, pagos, pedidoLineas, pedidos, usuarios } from '../db/schema.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'

export const rutasReportes = new Hono<{ Variables: Variables }>()

rutasReportes.use('*', conSesion, soloRoles('admin', 'comercial'))

rutasReportes.get('/', async (c) => {
  const u = c.get('usuario')
  const mes = c.req.query('mes') ?? mesActual()
  if (!MES_VALIDO.test(mes)) return c.json({ mensaje: 'El mes debe tener la forma 2026-10.' }, 400)
  const { desde, hasta, dias } = limitesMes(mes)
  const soloMios = !u.roles.includes('admin')
  const db = getDb()
  const mios = soloMios ? eq(pedidos.comercialId, u.id) : undefined

  const delMes = await db
    .select({
      p: pedidos,
      cliente: clientes.nombre,
      comercial: usuarios.nombre,
      pagado: sql<number>`(select coalesce(sum(monto), 0)::int from pagos where pagos.pedido_id = ${pedidos.id})`,
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .innerJoin(usuarios, eq(usuarios.id, pedidos.comercialId))
    .where(and(gte(pedidos.creadoEn, desde), lt(pedidos.creadoEn, hasta), ne(pedidos.estado, 'cancelado'), mios))

  const [cobro] = await db
    .select({ total: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
    .from(pagos)
    .innerJoin(pedidos, eq(pedidos.id, pagos.pedidoId))
    .where(and(gte(pagos.creadoEn, desde), lt(pagos.creadoEn, hasta), mios))

  const porDia = Array.from({ length: dias }, (_, i) => ({ dia: i + 1, total: 0, pedidos: 0 }))
  const comerciales = new Map<number, ReporteMes['comerciales'][number]>()
  for (const { p, comercial, pagado } of delMes) {
    const d = porDia[diaBogota(p.creadoEn) - 1]
    d.total += p.total
    d.pedidos++
    const k = comerciales.get(p.comercialId) ?? {
      id: p.comercialId,
      nombre: comercial,
      pedidos: 0,
      ventas: 0,
      ganancia: 0,
      gananciaPagada: 0,
    }
    k.pedidos++
    k.ventas += p.total
    k.ganancia += p.ganancia
    if (pagado >= p.total) k.gananciaPagada += p.ganancia
    comerciales.set(p.comercialId, k)
  }
  const total = delMes.reduce((s, x) => s + x.p.total, 0)

  const ids = delMes.map((x) => x.p.id)
  const lineas = ids.length
    ? await db
        .select({
          productoId: pedidoLineas.productoId,
          nombre: pedidoLineas.nombre,
          unidades: sql<number>`sum(${pedidoLineas.cantidad})::int`,
          ventas: sql<number>`sum(${pedidoLineas.cantidad} * ${pedidoLineas.precioVenta})::int`,
        })
        .from(pedidoLineas)
        .where(inArray(pedidoLineas.pedidoId, ids))
        .groupBy(pedidoLineas.productoId, pedidoLineas.nombre)
    : []
  const productos = lineas.sort((a, b) => b.unidades - a.unidades || b.ventas - a.ventas).slice(0, 10)

  const envios = ids.length
    ? await db
        .select({ cobrado: entregas.costoCobrado, costoReal: entregas.costoReal })
        .from(entregas)
        .where(inArray(entregas.pedidoId, ids))
    : []
  const conCosto = envios.filter((e) => e.costoReal !== null)

  const entregados = await db
    .select({
      p: pedidos,
      cliente: clientes.nombre,
      whatsapp: clientes.whatsapp,
      comercial: usuarios.nombre,
      entregadoEn: entregas.entregadaEn,
      pagado: sql<number>`(select coalesce(sum(monto), 0)::int from pagos where pagos.pedido_id = ${pedidos.id})`,
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .innerJoin(usuarios, eq(usuarios.id, pedidos.comercialId))
    .leftJoin(entregas, eq(entregas.pedidoId, pedidos.id))
    .where(and(eq(pedidos.estado, 'entregado'), mios))

  const r: ReporteMes = {
    mes,
    ventas: {
      total,
      pedidos: delMes.length,
      ticket: delMes.length ? Math.round(total / delMes.length) : 0,
      cobrado: cobro?.total ?? 0,
    },
    porDia,
    comerciales: [...comerciales.values()].sort((a, b) => b.ventas - a.ventas),
    pedidos: delMes
      .sort((a, b) => a.p.creadoEn.getTime() - b.p.creadoEn.getTime())
      .map(({ p, cliente, comercial, pagado }) => ({
        id: p.id,
        codigo: p.codigo,
        cliente,
        comercial,
        fecha: p.creadoEn.toISOString(),
        total: p.total,
        ganancia: p.ganancia,
        estadoPago: estadoPago({ ...p, pagado, cancelado: false }),
      })),
    porCobrar: entregados
      .filter((x) => x.p.total - x.pagado > 0)
      .map((x) => ({
        id: x.p.id,
        codigo: x.p.codigo,
        cliente: x.cliente,
        whatsapp: x.whatsapp,
        comercial: x.comercial,
        entregadoEn: x.entregadoEn?.toISOString() ?? null,
        saldo: x.p.total - x.pagado,
      }))
      .sort((a, b) => (a.entregadoEn ?? '').localeCompare(b.entregadoEn ?? '')),
    productos,
    envios: {
      cobrado: conCosto.reduce((s, e) => s + e.cobrado, 0),
      costoReal: conCosto.reduce((s, e) => s + (e.costoReal ?? 0), 0),
      conCosto: conCosto.length,
    },
  }
  return c.json(r)
})
