import { and, asc, desc, eq, inArray, max, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { sumarDiasHabiles } from '../../shared/cotizacion.js'
import {
  codigoPedido,
  codigoSeguimiento,
  type EstadoOrden,
  type EstadoPedido,
  type EventoHistorial,
  type LineaPedido,
  type MetodoPago,
  type PedidoDetalle,
  type PedidoResumen,
  tipoDePago,
  type TipoPago,
  validarMotivoCancelacion,
  validarNota,
  validarPago,
} from '../../shared/pedidos.js'
import { getDb } from '../db/index.js'
import {
  clientes,
  cotizacionCargos,
  cotizacionLineas,
  cotizaciones,
  historialEstados,
  movimientosStock,
  ordenesProduccion,
  pagos,
  pedidoCargos,
  pedidoLineas,
  pedidos,
  productos,
  usuarios,
} from '../db/schema.js'
import { anotar, recalcularPedido, totalPagado, type Tx } from '../pedidos-logica.js'
import { conSesion, soloRoles, type UsuarioSesion, type Variables } from '../sesion.js'

export const rutasPedidos = new Hono<{ Variables: Variables }>()

rutasPedidos.use('*', conSesion)

const vende = soloRoles('admin', 'comercial')
const ve = soloRoles('admin', 'comercial', 'fabricacion', 'entregas')

const NO_EXISTE = 'No encontramos ese pedido.'
const DE_ENTREGA: EstadoPedido[] = ['listo', 'en_entrega', 'entregado', 'cerrado']

const tiene = (u: UsuarioSesion, ...r: UsuarioSesion['roles']) => u.roles.some((x) => r.includes(x))
const esAdmin = (u: UsuarioSesion) => u.roles.includes('admin')
const veDinero = (u: UsuarioSesion) => tiene(u, 'admin', 'comercial')

function anioBogota() {
  return Number(
    new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric' }).format(new Date())
  )
}

/** Qué pedidos puede ver cada persona. */
function puedeVer(u: UsuarioSesion, p: { comercialId: number; estado: string }) {
  if (tiene(u, 'admin', 'fabricacion')) return true
  if (u.roles.includes('comercial') && p.comercialId === u.id) return true
  if (u.roles.includes('entregas') && DE_ENTREGA.includes(p.estado as EstadoPedido)) return true
  return false
}

/** Admin, o el comercial dueño del pedido. */
function puedeCobrar(u: UsuarioSesion, p: { comercialId: number }) {
  return esAdmin(u) || (u.roles.includes('comercial') && p.comercialId === u.id)
}

async function cargar(id: number, u: UsuarioSesion) {
  const [p] = await getDb().select().from(pedidos).where(eq(pedidos.id, id))
  if (!p || !puedeVer(u, p)) return null
  return p
}

async function detalle(id: number, u: UsuarioSesion): Promise<PedidoDetalle | null> {
  const db = getDb()
  const p = await cargar(id, u)
  if (!p) return null
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, p.clienteId))
  const [comercial] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .where(eq(usuarios.id, p.comercialId))
  const [cot] = await db
    .select({ id: cotizaciones.id, codigo: cotizaciones.codigo })
    .from(cotizaciones)
    .where(eq(cotizaciones.id, p.cotizacionId))
  const lineas = await db
    .select()
    .from(pedidoLineas)
    .where(eq(pedidoLineas.pedidoId, id))
    .orderBy(asc(pedidoLineas.orden))
  const ordenes = await db
    .select({ lineaId: ordenesProduccion.lineaId, estado: ordenesProduccion.estado })
    .from(ordenesProduccion)
    .where(eq(ordenesProduccion.pedidoId, id))
  const estadoLinea = new Map(ordenes.map((o) => [o.lineaId, o.estado as EstadoOrden]))
  const cargos = await db
    .select({ concepto: pedidoCargos.concepto, valor: pedidoCargos.valor })
    .from(pedidoCargos)
    .where(eq(pedidoCargos.pedidoId, id))
    .orderBy(asc(pedidoCargos.id))
  const listaPagos = await db
    .select({
      id: pagos.id,
      tipo: pagos.tipo,
      metodo: pagos.metodo,
      monto: pagos.monto,
      referencia: pagos.referencia,
      usuario: usuarios.nombre,
      creadoEn: pagos.creadoEn,
    })
    .from(pagos)
    .leftJoin(usuarios, eq(usuarios.id, pagos.usuarioId))
    .where(eq(pagos.pedidoId, id))
    .orderBy(asc(pagos.id))
  const historial = await db
    .select({
      id: historialEstados.id,
      de: historialEstados.de,
      a: historialEstados.a,
      nota: historialEstados.nota,
      visibleCliente: historialEstados.visibleCliente,
      usuario: usuarios.nombre,
      creadoEn: historialEstados.creadoEn,
    })
    .from(historialEstados)
    .leftJoin(usuarios, eq(usuarios.id, historialEstados.usuarioId))
    .where(and(eq(historialEstados.entidad, 'pedido'), eq(historialEstados.entidadId, id)))
    .orderBy(desc(historialEstados.id))

  const lineasOut: LineaPedido[] = lineas.map((l) => ({
    id: l.id,
    productoId: l.productoId,
    nombre: l.nombre,
    descripcion: l.descripcion,
    imagen: l.imagen,
    cantidad: l.cantidad,
    precioFabrica: veDinero(u) ? l.precioFabrica : 0,
    precioVenta: l.precioVenta,
    personalizado: l.personalizado,
    desdeStock: l.desdeStock,
    estado: l.desdeStock ? 'listo' : (estadoLinea.get(l.id) ?? 'en_cola'),
  }))
  const pagado = listaPagos.reduce((s, x) => s + x.monto, 0)
  const dinero = veDinero(u)
  return {
    id: p.id,
    codigo: p.codigo,
    seguimiento: p.seguimiento,
    estado: p.estado as EstadoPedido,
    cliente: {
      id: cliente.id,
      nombre: cliente.nombre,
      whatsapp: cliente.whatsapp,
      ciudad: cliente.ciudad,
      direccion: cliente.direccion,
    },
    comercial: comercial ?? { id: p.comercialId, nombre: '—' },
    cotizacion: cot,
    total: p.total,
    pagado: dinero ? pagado : 0,
    avance: {
      listas: lineasOut.filter((l) => l.estado === 'listo').length,
      total: lineasOut.length,
    },
    fechaCompromiso: p.fechaCompromiso?.toISOString() ?? null,
    creadoEn: p.creadoEn.toISOString(),
    modalidad: p.modalidad as PedidoDetalle['modalidad'],
    lineas: lineasOut,
    cargos,
    descuento: p.descuento,
    subtotal: p.subtotal,
    ganancia: dinero ? p.ganancia : 0,
    anticipoPct: p.anticipoPct,
    anticipo: p.anticipo,
    requiereAnticipo: p.requiereAnticipo,
    producirSinAnticipo: p.producirSinAnticipo,
    diasFabricacion: p.diasFabricacion,
    diasEnvio: p.diasEnvio,
    notas: p.notas,
    motivoCancelacion: p.motivoCancelacion,
    pagos: dinero
      ? listaPagos.map((x) => ({
          id: x.id,
          tipo: x.tipo as TipoPago,
          metodo: x.metodo as MetodoPago,
          monto: x.monto,
          referencia: x.referencia,
          usuario: x.usuario ?? '—',
          creadoEn: x.creadoEn.toISOString(),
        }))
      : [],
    historial: historial
      .filter((h) => dinero || !h.nota.startsWith('Pago'))
      .map(
        (h): EventoHistorial => ({
          id: h.id,
          de: h.de,
          a: h.a,
          nota: h.nota,
          visibleCliente: h.visibleCliente,
          usuario: h.usuario ?? 'Sistema',
          creadoEn: h.creadoEn.toISOString(),
        })
      ),
  }
}

const responder = async (id: number, u: UsuarioSesion) => ({ pedido: await detalle(id, u) })

// ===================== Lista =====================

rutasPedidos.get('/', ve, async (c) => {
  const u = c.get('usuario')
  const db = getDb()
  const filas = await db
    .select({
      p: pedidos,
      cliente: clientes.nombre,
      comercial: usuarios.nombre,
      pagado: sql<number>`(select coalesce(sum(monto), 0)::int from pagos where pagos.pedido_id = ${pedidos.id})`,
      lineas: sql<number>`(select count(*)::int from pedido_lineas l where l.pedido_id = ${pedidos.id})`,
      listas: sql<number>`(select count(*)::int from pedido_lineas l where l.pedido_id = ${pedidos.id} and (l.desde_stock or exists (select 1 from ordenes_produccion o where o.linea_id = l.id and o.estado = 'listo')))`,
    })
    .from(pedidos)
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .innerJoin(usuarios, eq(usuarios.id, pedidos.comercialId))
    .orderBy(desc(pedidos.actualizadoEn))
    .limit(300)
  const lista: PedidoResumen[] = filas
    .filter(({ p }) => puedeVer(u, p))
    .map(({ p, cliente, comercial, pagado, lineas, listas }) => ({
      id: p.id,
      codigo: p.codigo,
      seguimiento: p.seguimiento,
      estado: p.estado as EstadoPedido,
      cliente: { id: p.clienteId, nombre: cliente },
      comercial: { id: p.comercialId, nombre: comercial },
      total: p.total,
      pagado: veDinero(u) ? pagado : 0,
      avance: { listas, total: lineas },
      fechaCompromiso: p.fechaCompromiso?.toISOString() ?? null,
      creadoEn: p.creadoEn.toISOString(),
    }))
  return c.json({ pedidos: lista })
})

rutasPedidos.get('/:id', ve, async (c) => {
  const d = await detalle(Number(c.req.param('id')) || 0, c.get('usuario'))
  if (!d) return c.json({ mensaje: NO_EXISTE }, 404)
  return c.json({ pedido: d })
})

// ===================== Convertir cotización =====================

rutasPedidos.post('/', vende, async (c) => {
  const u = c.get('usuario')
  const cuerpo = await c.req.json().catch(() => ({}))
  const cotizacionId = Number(cuerpo.cotizacionId) || 0
  const db = getDb()
  const [cot] = await db.select().from(cotizaciones).where(eq(cotizaciones.id, cotizacionId))
  if (!cot) return c.json({ mensaje: 'No encontramos esa cotización.' }, 404)
  if (!esAdmin(u) && cot.comercialId !== u.id) {
    return c.json({ mensaje: 'Esta cotización es de otro comercial.' }, 403)
  }
  const [ya] = await db
    .select({ id: pedidos.id, codigo: pedidos.codigo })
    .from(pedidos)
    .where(eq(pedidos.cotizacionId, cot.id))
  if (ya) {
    return c.json({ mensaje: `Esta cotización ya es el pedido ${ya.codigo}.`, pedidoId: ya.id }, 409)
  }
  if (cot.estado !== 'aprobada') {
    return c.json(
      { mensaje: 'Solo se convierte en pedido una cotización que el cliente aceptó.' },
      400
    )
  }
  if (!cot.clienteId) return c.json({ mensaje: 'La cotización no tiene cliente.' }, 400)

  const lineas = await db
    .select()
    .from(cotizacionLineas)
    .where(eq(cotizacionLineas.cotizacionId, cot.id))
    .orderBy(asc(cotizacionLineas.orden))
  const cargos = await db
    .select()
    .from(cotizacionCargos)
    .where(eq(cotizacionCargos.cotizacionId, cot.id))
  const anio = anioBogota()
  const requiereAnticipo = cot.anticipo > 0

  const id = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${anio + 100_000})`)
    const [fila] = await tx
      .select({ ultimo: max(pedidos.numero) })
      .from(pedidos)
      .where(eq(pedidos.anio, anio))
    const numero = (fila?.ultimo ?? 0) + 1
    let seguimiento = codigoSeguimiento()
    for (let i = 0; i < 5; i++) {
      const [choque] = await tx
        .select({ id: pedidos.id })
        .from(pedidos)
        .where(eq(pedidos.seguimiento, seguimiento))
      if (!choque) break
      seguimiento = codigoSeguimiento()
    }
    const [nuevo] = await tx
      .insert(pedidos)
      .values({
        anio,
        numero,
        codigo: codigoPedido(anio, numero),
        seguimiento,
        cotizacionId: cot.id,
        clienteId: cot.clienteId!,
        comercialId: cot.comercialId,
        estado: 'confirmado',
        modalidad: cot.modalidad,
        subtotal: cot.subtotal,
        totalCargos: cot.totalCargos,
        descuento: cot.descuento,
        total: cot.total,
        ganancia: cot.ganancia,
        anticipoPct: cot.anticipoPct,
        anticipo: cot.anticipo,
        requiereAnticipo,
        diasFabricacion: cot.diasFabricacion,
        diasEnvio: cot.diasEnvio,
        fechaCompromiso: requiereAnticipo
          ? null
          : sumarDiasHabiles(new Date(), cot.diasFabricacion + cot.diasEnvio),
        notas: cot.notas,
        creadoPor: u.id,
      })
      .returning({ id: pedidos.id })

    for (const [orden, l] of lineas.entries()) {
      // Lo que ya está impreso sale del stock (si alcanza para toda la línea)
      const [prod] = await tx
        .select({ stock: productos.stock, tipo: productos.tipo })
        .from(productos)
        .where(eq(productos.id, l.productoId))
        .for('update')
      const desdeStock = !l.personalizado && !!prod && prod.stock >= l.cantidad
      const [linea] = await tx
        .insert(pedidoLineas)
        .values({
          pedidoId: nuevo.id,
          orden,
          productoId: l.productoId,
          nombre: l.nombre,
          descripcion: l.descripcion,
          imagen: l.imagen,
          cantidad: l.cantidad,
          precioFabrica: l.precioFabrica,
          precioVenta: l.precioVenta,
          personalizado: l.personalizado,
          desdeStock,
        })
        .returning({ id: pedidoLineas.id })
      if (desdeStock) {
        await tx
          .update(productos)
          .set({ stock: prod!.stock - l.cantidad, actualizadoEn: new Date() })
          .where(eq(productos.id, l.productoId))
        await tx.insert(movimientosStock).values({
          productoId: l.productoId,
          tipo: 'venta',
          cantidad: -l.cantidad,
          nota: `Para el pedido ${codigoPedido(anio, numero)}`,
          pedidoId: nuevo.id,
          usuarioId: u.id,
        })
      } else {
        await tx.insert(ordenesProduccion).values({
          pedidoId: nuevo.id,
          lineaId: linea.id,
          productoId: l.productoId,
          cantidad: l.cantidad,
          estado: l.personalizado && requiereAnticipo ? 'espera_anticipo' : 'en_cola',
          creadoPor: u.id,
        })
      }
    }
    if (cargos.length) {
      await tx
        .insert(pedidoCargos)
        .values(cargos.map((g) => ({ pedidoId: nuevo.id, concepto: g.concepto, valor: g.valor })))
    }
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: nuevo.id,
      a: 'confirmado',
      nota: `Creado desde la cotización ${cot.codigo}.`,
      visibleCliente: true,
      usuarioId: u.id,
    })
    await recalcularPedido(tx, nuevo.id, u.id)
    return nuevo.id
  })
  return c.json(await responder(id, u), 201)
})

// ===================== Pagos =====================

rutasPedidos.post('/:id/pagos', vende, async (c) => {
  const u = c.get('usuario')
  const p = await cargar(Number(c.req.param('id')) || 0, u)
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)
  if (!puedeCobrar(u, p)) return c.json({ mensaje: 'Este pedido es de otro comercial.' }, 403)
  if (p.estado === 'cancelado') {
    return c.json({ mensaje: 'El pedido está cancelado: no se le registran pagos.' }, 400)
  }
  const cuerpo = await c.req.json().catch(() => ({}))
  const db = getDb()
  const r = await db.transaction(async (tx: Tx) => {
    await tx.select({ id: pedidos.id }).from(pedidos).where(eq(pedidos.id, p.id)).for('update')
    const pagadoAntes = await totalPagado(tx, p.id)
    const v = validarPago(cuerpo, p.total - pagadoAntes)
    if (!v.ok) return v
    const tipo = tipoDePago({
      requiereAnticipo: p.requiereAnticipo,
      anticipo: p.anticipo,
      total: p.total,
      pagadoAntes,
      monto: v.datos.monto,
    })
    await tx.insert(pagos).values({ pedidoId: p.id, tipo, ...v.datos, usuarioId: u.id })
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota: `Pago registrado: $ ${v.datos.monto.toLocaleString('es-CO')}`,
      usuarioId: u.id,
    })
    await recalcularPedido(tx, p.id, u.id)
    return { ok: true as const }
  })
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  return c.json(await responder(p.id, u), 201)
})

/** El Admin deja imprimir lo personalizado aunque no haya anticipo. */
rutasPedidos.post('/:id/producir-sin-anticipo', soloRoles('admin'), async (c) => {
  const u = c.get('usuario')
  const p = await cargar(Number(c.req.param('id')) || 0, u)
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)
  if (p.estado !== 'confirmado') {
    return c.json({ mensaje: 'Este pedido ya está en producción.' }, 400)
  }
  await getDb().transaction(async (tx) => {
    await tx
      .update(pedidos)
      .set({ producirSinAnticipo: true, actualizadoEn: new Date() })
      .where(eq(pedidos.id, p.id))
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota: 'El administrador autorizó producir sin anticipo.',
      usuarioId: u.id,
    })
    await recalcularPedido(tx, p.id, u.id)
  })
  return c.json(await responder(p.id, u))
})

// ===================== Cancelar =====================

rutasPedidos.post('/:id/cancelar', vende, async (c) => {
  const u = c.get('usuario')
  const p = await cargar(Number(c.req.param('id')) || 0, u)
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)
  if (!puedeCobrar(u, p)) return c.json({ mensaje: 'Este pedido es de otro comercial.' }, 403)
  if (p.estado === 'cancelado') return c.json({ mensaje: 'Este pedido ya estaba cancelado.' }, 400)
  if (['en_entrega', 'entregado', 'cerrado'].includes(p.estado)) {
    return c.json({ mensaje: 'Este pedido ya salió a entrega: no se puede cancelar.' }, 400)
  }
  const v = validarMotivoCancelacion(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const db = getDb()
  const ordenes = await db
    .select()
    .from(ordenesProduccion)
    .where(eq(ordenesProduccion.pedidoId, p.id))
  const empezo = ordenes.some((o) => !['espera_anticipo', 'en_cola'].includes(o.estado))
  if (empezo && !esAdmin(u)) {
    return c.json(
      { mensaje: 'El taller ya empezó a imprimir este pedido. Solo el administrador lo puede cancelar.' },
      403
    )
  }
  await db.transaction(async (tx) => {
    const lineas = await tx.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, p.id))
    // Lo que ya estaba impreso (o salió de stock) vuelve al stock
    const devolver = [
      ...lineas.filter((l) => l.desdeStock).map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
      ...ordenes
        .filter((o) => o.estado === 'listo')
        .map((o) => ({ productoId: o.productoId, cantidad: o.cantidad })),
    ]
    for (const d of devolver) {
      await tx
        .update(productos)
        .set({ stock: sql`${productos.stock} + ${d.cantidad}`, actualizadoEn: new Date() })
        .where(eq(productos.id, d.productoId))
      await tx.insert(movimientosStock).values({
        productoId: d.productoId,
        tipo: 'ajuste',
        cantidad: d.cantidad,
        nota: `Vuelve al stock: se canceló el pedido ${p.codigo}`,
        pedidoId: p.id,
        usuarioId: u.id,
      })
    }
    const abiertas = ordenes.filter((o) => o.estado !== 'listo').map((o) => o.id)
    if (abiertas.length) {
      await tx
        .update(ordenesProduccion)
        .set({ estado: 'cancelada', actualizadoEn: new Date() })
        .where(inArray(ordenesProduccion.id, abiertas))
    }
    await tx
      .update(pedidos)
      .set({ estado: 'cancelado', motivoCancelacion: v.motivo, actualizadoEn: new Date() })
      .where(eq(pedidos.id, p.id))
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      de: p.estado,
      a: 'cancelado',
      nota: v.motivo,
      visibleCliente: true,
      usuarioId: u.id,
    })
  })
  return c.json(await responder(p.id, u))
})

// ===================== Notas =====================

rutasPedidos.post('/:id/notas', ve, async (c) => {
  const u = c.get('usuario')
  const p = await cargar(Number(c.req.param('id')) || 0, u)
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)
  const v = validarNota(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  await getDb().transaction((tx) =>
    anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota: v.nota,
      visibleCliente: v.visibleCliente,
      usuarioId: u.id,
    })
  )
  return c.json(await responder(p.id, u), 201)
})
