import { and, asc, desc, eq, inArray, isNull, max, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  calcularCotizacion,
  fabricaDeLinea,
  type Modalidad,
  validarColoresCotizacion,
  validarTextosCotizacion,
} from '../../shared/cotizacion.js'
import {
  ENTREGA_MODIFICABLE,
  leerEdicionPedido,
  lineaBloqueada,
  motivoNoModificable,
  validarPreciosPedido,
  validarTotalContraPagado,
} from '../../shared/editar-pedido.js'
import { conPunto, fraseConFecha } from '../../shared/promesa.js'
import { costoEnvioCobrado, estadoPago, validarReembolso } from '../../shared/entregas.js'
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
  entregas,
  historialEstados,
  ordenesProduccion,
  pagos,
  pedidoCargos,
  pedidoLineas,
  pedidos,
  productoArchivos,
  productos,
  usuarios,
} from '../db/schema.js'
import {
  anotar,
  crearEntrega,
  estadosDeLineas,
  leerEntrega,
  recalcularPedido,
  totalPagado,
  type Tx,
} from '../pedidos-logica.js'
import { conSesion, soloRoles, type UsuarioSesion, type Variables } from '../sesion.js'
import { aplicarDevolucion } from '../comisiones.js'
import { comprometerPedido, franjaDe, promesaAhora } from '../promesa.js'
import { coloresDe, moverStock, stockDisponible } from '../stock.js'
import { leerConfiguracion } from './configuracion.js'
import { permisoDeSubida, SOLO_IMAGENES, urlDeBlobValida } from '../subidas.js'

export const rutasPedidos = new Hono<{ Variables: Variables }>()

rutasPedidos.use('*', conSesion)

const vende = soloRoles('admin', 'comercial')
const ve = soloRoles('admin', 'comercial', 'fabricacion', 'entregas')
const soloAdmin = soloRoles('admin')
/** Notas internas: el equipo del taller y entregas (el comercial no). */
const anotaEquipo = soloRoles('admin', 'fabricacion', 'entregas')

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
  const [p] = await getDb()
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.id, id), isNull(pedidos.borradoEn)))
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
      comprobanteUrl: pagos.comprobanteUrl,
      nota: pagos.nota,
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
    deStock: l.deStock,
    textos: l.textos,
    estado: l.desdeStock ? 'listo' : (estadoLinea.get(l.id) ?? 'en_cola'),
    bobinaId: l.bobinaId,
    color: l.color,
    colorHex: l.colorHex,
  }))
  const pagado = listaPagos.reduce((s, x) => s + x.monto, 0)
  const dinero = veDinero(u)
  const entrega = await db.transaction((tx) => leerEntrega(tx, id))
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
    // El mensajero necesita saber cuánto cobrar al entregar
    pagado: dinero || u.roles.includes('entregas') ? pagado : 0,
    avance: {
      listas: lineasOut.filter((l) => l.estado === 'listo').length,
      total: lineasOut.length,
    },
    fechaCompromiso: p.fechaCompromiso?.toISOString() ?? null,
    conHora: p.listoCompromiso !== null,
    creadoEn: p.creadoEn.toISOString(),
    estadoPago: estadoPago({ ...p, pagado, cancelado: p.estado === 'cancelado' }),
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
    numeroFactura: p.numeroFactura,
    entrega,
    pagos: dinero
      ? listaPagos.map((x) => ({
          id: x.id,
          tipo: x.tipo as TipoPago,
          metodo: x.metodo as MetodoPago,
          monto: x.monto,
          referencia: x.referencia,
          comprobanteUrl: x.comprobanteUrl,
          nota: x.nota,
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
    .where(isNull(pedidos.borradoEn))
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
      conHora: p.listoCompromiso !== null,
      creadoEn: p.creadoEn.toISOString(),
      estadoPago: estadoPago({ ...p, pagado, cancelado: p.estado === 'cancelado' }),
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
  const [cot] = await db
    .select()
    .from(cotizaciones)
    .where(and(eq(cotizaciones.id, cotizacionId), isNull(cotizaciones.borradoEn)))
  if (!cot) return c.json({ mensaje: 'No encontramos esa cotización.' }, 404)
  if (!esAdmin(u) && cot.comercialId !== u.id) {
    return c.json({ mensaje: 'Esta cotización es de otro comercial.' }, 403)
  }
  const [ya] = await db
    .select({ id: pedidos.id, codigo: pedidos.codigo, borradoEn: pedidos.borradoEn })
    .from(pedidos)
    .where(eq(pedidos.cotizacionId, cot.id))
  if (ya) {
    return c.json(
      {
        mensaje: ya.borradoEn
          ? `Esta cotización ya fue el pedido ${ya.codigo}, que está en la Papelera. El administrador lo puede recuperar desde ahí.`
          : `Esta cotización ya es el pedido ${ya.codigo}.`,
        pedidoId: ya.borradoEn ? undefined : ya.id,
      },
      409
    )
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

  // La hora de entrega se vuelve a calcular con la cola de este momento.
  // Si quedó más tarde de lo que vio el cliente, el comercial confirma primero.
  if (!requiereAnticipo && cot.entregaEn && cuerpo.aceptaNuevaFecha !== true) {
    const ahora = await promesaAhora(
      db,
      lineas.map((l) => ({
        clave: String(l.id),
        productoId: l.productoId,
        cantidad: l.cantidad,
        bobinaId: l.bobinaId,
        textos: l.textos,
      })),
      cot.modalidad as Modalidad
    )
    // Se compara por día y franja: unos minutos de diferencia no cuentan
    if (ahora?.ok && new Date(ahora.entregaEn).getTime() - cot.entregaEn.getTime() > 59 * 60_000) {
      return c.json(
        {
          mensaje: `La cotización decía que se entregaba ${fraseConFecha({ entregaEn: cot.entregaEn.toISOString(), frase: cot.entregaFrase })}; con la cola de ahora se entrega ${conPunto(fraseConFecha(ahora))} Avísale al cliente antes de crear el pedido.`,
          campo: 'nuevaFecha',
          nuevaFecha: fraseConFecha(ahora),
        },
        409
      )
    }
  }

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
        // Se calcula al final con la cola (o al pagar el anticipo)
        fechaCompromiso: null,
        notas: cot.notas,
        creadoPor: u.id,
      })
      .returning({ id: pedidos.id })

    for (const [orden, l] of lineas.entries()) {
      // Lo que ya está impreso sale de existencias (del mismo color si el
      // producto tiene colores); si no alcanza, se imprime solo lo que falta
      const disponible = l.personalizado
        ? 0
        : await stockDisponible(tx, l.productoId, l.bobinaId)
      const deStock = Math.min(Math.max(0, disponible), l.cantidad)
      const desdeStock = deStock === l.cantidad
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
          deStock,
          textos: l.textos,
          bobinaId: l.bobinaId,
          color: l.color,
          colorHex: l.colorHex,
        })
        .returning({ id: pedidoLineas.id })
      if (deStock > 0) {
        const m = await moverStock(tx, {
          productoId: l.productoId,
          bobinaId: l.bobinaId,
          cantidad: -deStock,
          tipo: 'venta',
          nota: `Para el pedido ${codigoPedido(anio, numero)}`,
          pedidoId: nuevo.id,
          usuarioId: u.id,
        })
        if (!m.ok) throw new Error(m.error)
      }
      if (!desdeStock) {
        await tx.insert(ordenesProduccion).values({
          pedidoId: nuevo.id,
          lineaId: linea.id,
          productoId: l.productoId,
          colorBobinaId: l.bobinaId,
          cantidad: l.cantidad - deStock,
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
    await crearEntrega(tx, nuevo.id)
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: nuevo.id,
      a: 'confirmado',
      nota: `Creado desde la cotización ${cot.codigo}.`,
      visibleCliente: true,
      usuarioId: u.id,
    })
    await recalcularPedido(tx, nuevo.id, u.id)
    // Sin anticipo pendiente, el compromiso queda desde ya
    const [p] = await tx
      .select({ fechaCompromiso: pedidos.fechaCompromiso })
      .from(pedidos)
      .where(eq(pedidos.id, nuevo.id))
    if (!p.fechaCompromiso && !requiereAnticipo) await comprometerPedido(tx, nuevo.id)
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
    const comprobante = String(cuerpo.comprobanteUrl ?? '')
    if (comprobante && !urlDeBlobValida(comprobante)) {
      return { ok: false as const, mensaje: 'La foto del comprobante no se subió bien. Intenta de nuevo.', campo: 'comprobanteUrl' }
    }
    await tx.insert(pagos).values({
      pedidoId: p.id,
      tipo,
      ...v.datos,
      comprobanteUrl: comprobante || null,
      usuarioId: u.id,
    })
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

// Una vez es pedido, solo el administrador lo cambia o lo cancela.
rutasPedidos.post('/:id/cancelar', soloAdmin, async (c) => {
  const u = c.get('usuario')
  const p = await cargar(Number(c.req.param('id')) || 0, u)
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)
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
  await db.transaction(async (tx) => {
    const lineas = await tx.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, p.id))
    // Lo que ya estaba impreso (o salió de stock) vuelve al stock
    // (lo que lleva nombres no vuelve: no se le puede vender a otro)
    const conNombres = new Set(lineas.filter((l) => l.textos.length).map((l) => l.id))
    const devolver = [
      ...lineas
        .filter((l) => l.deStock > 0)
        .map((l) => ({ productoId: l.productoId, bobinaId: l.bobinaId, cantidad: l.deStock })),
      ...ordenes
        .filter((o) => o.estado === 'listo' && !(o.lineaId && conNombres.has(o.lineaId)))
        .map((o) => ({ productoId: o.productoId, bobinaId: o.colorBobinaId, cantidad: o.cantidad })),
    ]
    for (const d of devolver) {
      await moverStock(tx, {
        ...d,
        tipo: 'ajuste',
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

// El comercial ya no escribe en el pedido (solo registra pagos)
rutasPedidos.post('/:id/notas', anotaEquipo, async (c) => {
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

// ===================== Devoluciones, factura y comprobantes =====================

/** Devolverle plata al cliente: solo el Admin. Se guarda como pago negativo. */
rutasPedidos.post('/:id/reembolso', soloRoles('admin'), async (c) => {
  const u = c.get('usuario')
  const p = await cargar(Number(c.req.param('id')) || 0, u)
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)
  const cuerpo = await c.req.json().catch(() => ({}))
  const r = await getDb().transaction(async (tx) => {
    await tx.select({ id: pedidos.id }).from(pedidos).where(eq(pedidos.id, p.id)).for('update')
    const v = validarReembolso(cuerpo, await totalPagado(tx, p.id))
    if (!v.ok) return v
    await tx.insert(pagos).values({
      pedidoId: p.id,
      tipo: 'reembolso',
      metodo: v.datos.metodo,
      monto: -v.datos.monto,
      nota: v.datos.motivo,
      usuarioId: u.id,
    })
    // En un pedido que sigue, la devolución es un descuento: baja el total
    // y la comisión del comercial (o se le descuenta si ya la ganó)
    if (p.estado !== 'cancelado') {
      await tx
        .update(pedidos)
        .set({ total: sql`${pedidos.total} - ${v.datos.monto}`, actualizadoEn: new Date() })
        .where(eq(pedidos.id, p.id))
      await aplicarDevolucion(tx, p.id, v.datos.monto, u.id)
    }
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota: `Pago devuelto al cliente: $ ${v.datos.monto.toLocaleString('es-CO')} — ${v.datos.motivo}`,
      usuarioId: u.id,
    })
    await recalcularPedido(tx, p.id, u.id)
    return { ok: true as const }
  })
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  return c.json(await responder(p.id, u), 201)
})

/** Número de la factura, si se emitió por otro medio. */
rutasPedidos.patch('/:id/factura', soloAdmin, async (c) => {
  const u = c.get('usuario')
  const p = await cargar(Number(c.req.param('id')) || 0, u)
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)
  const cuerpo = await c.req.json().catch(() => ({}))
  const numero = String(cuerpo.numeroFactura ?? '').trim().slice(0, 40)
  await getDb()
    .update(pedidos)
    .set({ numeroFactura: numero, actualizadoEn: new Date() })
    .where(eq(pedidos.id, p.id))
  return c.json(await responder(p.id, u))
})

// ===================== Modificar (solo el administrador) =====================

rutasPedidos.put('/:id', soloAdmin, async (c) => {
  const u = c.get('usuario')
  const p = await cargar(Number(c.req.param('id')) || 0, u)
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)
  const noSe = motivoNoModificable(p.estado as EstadoPedido)
  if (noSe) return c.json({ mensaje: noSe }, 400)
  const e = leerEdicionPedido(await c.req.json().catch(() => ({})))
  if (!e.ok) return c.json({ mensaje: e.mensaje, campo: e.campo }, 400)
  const ed = e.datos
  const db = getDb()
  const config = await leerConfiguracion()

  const r = await db.transaction(async (tx: Tx) => {
    const [actual] = await tx.select().from(pedidos).where(eq(pedidos.id, p.id)).for('update')
    const estadoPedido = actual.estado as EstadoPedido
    const viejas = await tx.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, p.id))
    const estados = await estadosDeLineas(tx, p.id)
    const porId = new Map(viejas.map((l) => [l.id, l]))
    for (const l of ed.lineas) {
      if (l.id && !porId.has(l.id)) {
        return { ok: false as const, mensaje: 'Un producto del pedido cambió mientras editabas. Recarga la página.' }
      }
    }

    // Productos del catálogo (para las líneas nuevas o cambiadas y para los días)
    const ids = [...new Set([...ed.lineas.map((l) => l.productoId), ...viejas.map((l) => l.productoId)])]
    const prods = await tx.select().from(productos).where(inArray(productos.id, ids))
    const mapa = new Map(prods.map((x) => [x.id, x]))
    const colores = await coloresDe(tx, prods.filter((x) => x.escogeColor).map((x) => x.id))

    const igualFisico = (
      v: typeof viejas[number],
      n: (typeof ed.lineas)[number]
    ) =>
      v.productoId === n.productoId &&
      v.cantidad === n.cantidad &&
      (v.bobinaId ?? null) === n.bobinaId &&
      JSON.stringify(v.textos) === JSON.stringify(n.textos)

    // Qué pasa con cada línea vieja
    const seQuedan = new Set(ed.lineas.map((l) => l.id).filter(Boolean) as number[])
    for (const v of viejas) {
      const nueva = ed.lineas.find((l) => l.id === v.id)
      const cambia = !nueva || !igualFisico(v, nueva)
      if (!cambia) continue
      const bloqueo = lineaBloqueada(estadoPedido, {
        desdeStock: v.desdeStock,
        estado: estados.get(v.id) ?? 'en_cola',
      })
      if (bloqueo) {
        return {
          ok: false as const,
          mensaje: `“${v.nombre}”: ${bloqueo.charAt(0).toLowerCase()}${bloqueo.slice(1)}`,
          campo: 'lineas',
        }
      }
    }

    // Precio de fábrica: el guardado si es el mismo producto (aunque cambie la
    // cantidad); el de hoy si es nuevo o cambió de color o de nombres
    const mismoProducto = (v: (typeof viejas)[number], n: (typeof ed.lineas)[number]) =>
      v.productoId === n.productoId &&
      (v.bobinaId ?? null) === n.bobinaId &&
      JSON.stringify(v.textos) === JSON.stringify(n.textos)
    // Lo nuevo (o con otro color o nombres) se revisa contra el catálogo de hoy;
    // si solo cambió la cantidad, se revisan los nombres
    const aRevisar = ed.lineas.filter((l) => {
      const v = l.id ? porId.get(l.id) : undefined
      return !v || !mismoProducto(v, l)
    })
    const conOtraCantidad = ed.lineas.filter((l) => {
      const v = l.id ? porId.get(l.id) : undefined
      return !v || !igualFisico(v, l)
    })
    for (const l of aRevisar) {
      const prod = mapa.get(l.productoId)
      if (!prod || prod.borradoEn) {
        return { ok: false as const, mensaje: 'Uno de los productos ya no existe. Quítalo del pedido.', campo: 'lineas' }
      }
      if (prod.estado !== 'activo') {
        return {
          ok: false as const,
          mensaje: `"${prod.nombre}" no está listo para vender. Pídele al taller que le ponga precio.`,
          campo: 'lineas',
        }
      }
    }
    const vt = validarTextosCotizacion(conOtraCantidad, mapa)
    if (!vt.ok) return vt
    const vc = validarColoresCotizacion(
      aRevisar,
      new Map(
        prods.map((x) => [
          x.id,
          { nombre: x.nombre, escogeColor: x.escogeColor, colores: colores.get(x.id) ?? [] },
        ])
      )
    )
    if (!vc.ok) return vc

    const fabricaDe = (l: (typeof ed.lineas)[number]) => {
      const v = l.id ? porId.get(l.id) : undefined
      if (v && mismoProducto(v, l)) return v.precioFabrica
      return fabricaDeLinea(mapa.get(l.productoId)!, l.textos)
    }
    const vp = validarPreciosPedido(
      ed.lineas.map((l) => ({
        nombre: mapa.get(l.productoId)?.nombre ?? 'producto',
        cantidad: l.cantidad,
        precioVenta: l.precioVenta,
        fabrica: fabricaDe(l),
      })),
      ed.descuento,
      config.tope_comercial
    )
    if (!vp.ok) return vp

    const modalidad = (ed.entrega?.modalidad ?? actual.modalidad) as Modalidad
    const resumen = calcularCotizacion(
      ed.lineas.map((l) => {
        const v = l.id ? porId.get(l.id) : undefined
        const prod = mapa.get(l.productoId)!
        return {
          cantidad: l.cantidad,
          precioFabrica: fabricaDe(l),
          precioVenta: l.precioVenta,
          personalizado:
            v && igualFisico(v, l) ? v.personalizado : prod.tipo === 'personalizado' || l.textos.length > 0,
          diasFabricacion: prod.diasFabricacion,
          desdeStock: v && igualFisico(v, l) ? v.desdeStock : false,
        }
      }),
      ed.cargos,
      ed.descuento,
      modalidad,
      config
    )
    // Lo que ya se le devolvió al cliente sigue descontado del total
    const devuelto = -(
      await tx
        .select({ s: sql<number>`coalesce(sum(${pagos.monto}), 0)::int` })
        .from(pagos)
        .where(and(eq(pagos.pedidoId, p.id), eq(pagos.tipo, 'reembolso')))
    )[0].s
    const total = Math.max(0, resumen.total - devuelto)
    const pagado = await totalPagado(tx, p.id)
    const vtot = validarTotalContraPagado(total, pagado)
    if (!vtot.ok) return vtot

    // ---- Se aplica ----
    const cambios: string[] = []
    let cambianProductos = false
    const devolver = async (productoId: number, bobinaId: number | null, cantidad: number) => {
      if (cantidad <= 0) return
      await moverStock(tx, {
        productoId,
        bobinaId,
        cantidad,
        tipo: 'ajuste',
        nota: `Vuelve al stock: se cambió el pedido ${actual.codigo}`,
        pedidoId: p.id,
        usuarioId: u.id,
      })
    }
    // 1) Líneas que se quitan o cambian de cantidad/color/nombres: se deshacen
    for (const v of viejas) {
      const nueva = ed.lineas.find((l) => l.id === v.id)
      if (nueva && igualFisico(v, nueva)) continue
      cambianProductos = true
      await devolver(v.productoId, v.bobinaId, v.deStock)
      await tx.delete(pedidoLineas).where(eq(pedidoLineas.id, v.id))
      if (!seQuedan.has(v.id)) cambios.push(`quitó ${v.nombre}`)
    }
    // 2) Se guardan las líneas en el orden nuevo
    const anticipoNuevo = estadoPedido === 'confirmado' ? resumen.anticipo : actual.anticipo
    const puedeYa =
      actual.producirSinAnticipo || anticipoNuevo <= 0 || pagado >= anticipoNuevo
    const portadas = await tx
      .select({ productoId: productoArchivos.productoId, url: productoArchivos.url })
      .from(productoArchivos)
      .where(and(inArray(productoArchivos.productoId, ids), eq(productoArchivos.tipo, 'imagen')))
      .orderBy(desc(productoArchivos.esPortada), asc(productoArchivos.id))
    const portada = new Map<number, string>()
    for (const f of portadas) if (!portada.has(f.productoId)) portada.set(f.productoId, f.url)

    for (const [orden, l] of ed.lineas.entries()) {
      const v = l.id ? porId.get(l.id) : undefined
      if (v && igualFisico(v, l)) {
        if (v.precioVenta !== l.precioVenta) cambios.push(`precio de ${v.nombre}`)
        await tx
          .update(pedidoLineas)
          .set({ precioVenta: l.precioVenta, orden })
          .where(eq(pedidoLineas.id, v.id))
        continue
      }
      const prod = mapa.get(l.productoId)!
      const color = prod.escogeColor
        ? (colores.get(prod.id) ?? []).find((x) => x.bobinaId === l.bobinaId)
        : undefined
      const personalizado = prod.tipo === 'personalizado' || l.textos.length > 0
      const disponible = personalizado ? 0 : await stockDisponible(tx, prod.id, color?.bobinaId ?? null)
      const deStock = Math.min(Math.max(0, disponible), l.cantidad)
      const desdeStock = deStock === l.cantidad
      const [linea] = await tx
        .insert(pedidoLineas)
        .values({
          pedidoId: p.id,
          orden,
          productoId: prod.id,
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          imagen: portada.get(prod.id) ?? null,
          cantidad: l.cantidad,
          precioFabrica: fabricaDe(l),
          precioVenta: l.precioVenta,
          personalizado,
          desdeStock,
          deStock,
          textos: l.textos,
          bobinaId: color?.bobinaId ?? null,
          color: color?.color ?? '',
          colorHex: color?.colorHex ?? '',
        })
        .returning({ id: pedidoLineas.id })
      if (deStock > 0) {
        const m = await moverStock(tx, {
          productoId: prod.id,
          bobinaId: color?.bobinaId ?? null,
          cantidad: -deStock,
          tipo: 'venta',
          nota: `Para el pedido ${actual.codigo}`,
          pedidoId: p.id,
          usuarioId: u.id,
        })
        if (!m.ok) throw new Error(m.error)
      }
      if (!desdeStock) {
        await tx.insert(ordenesProduccion).values({
          pedidoId: p.id,
          lineaId: linea.id,
          productoId: prod.id,
          colorBobinaId: color?.bobinaId ?? null,
          cantidad: l.cantidad - deStock,
          estado: personalizado && !puedeYa ? 'espera_anticipo' : 'en_cola',
          creadoPor: u.id,
        })
      }
      cambianProductos = true
      cambios.push(v ? `cambió ${prod.nombre}` : `agregó ${prod.nombre}`)
    }

    // 3) Cargos, descuento, notas y totales
    const cargosAntes = await tx
      .select({ concepto: pedidoCargos.concepto, valor: pedidoCargos.valor })
      .from(pedidoCargos)
      .where(eq(pedidoCargos.pedidoId, p.id))
      .orderBy(asc(pedidoCargos.id))
    if (JSON.stringify(cargosAntes) !== JSON.stringify(ed.cargos)) {
      cambios.push('cargos')
      await tx.delete(pedidoCargos).where(eq(pedidoCargos.pedidoId, p.id))
      if (ed.cargos.length) {
        await tx.insert(pedidoCargos).values(ed.cargos.map((g) => ({ pedidoId: p.id, ...g })))
      }
    }
    if (ed.descuento !== actual.descuento) cambios.push('descuento')
    if (ed.notas !== actual.notas) cambios.push('notas')
    const fijo = {
      modalidad,
      subtotal: resumen.subtotal,
      totalCargos: resumen.cargos,
      descuento: ed.descuento,
      total,
      ganancia: Math.max(0, resumen.ganancia - devuelto),
      notas: ed.notas,
      diasFabricacion: resumen.diasFabricacion,
      diasEnvio: resumen.diasEnvio,
      ...(estadoPedido === 'confirmado'
        ? {
            anticipoPct: resumen.anticipoPct,
            anticipo: resumen.anticipo,
            requiereAnticipo: resumen.anticipo > 0,
          }
        : {}),
      actualizadoEn: new Date(),
    }
    await tx.update(pedidos).set(fijo).where(eq(pedidos.id, p.id))

    // 4) Entrega
    const [ent] = await tx.select().from(entregas).where(eq(entregas.pedidoId, p.id))
    if (ent) {
      const cambiosEntrega: Partial<typeof entregas.$inferInsert> = {
        costoCobrado: costoEnvioCobrado(ed.cargos),
      }
      if (ed.entrega) {
        const otra =
          ent.modalidad !== ed.entrega.modalidad ||
          ent.direccion !== ed.entrega.direccion ||
          ent.ciudad !== ed.entrega.ciudad ||
          ent.recibe !== ed.entrega.recibe ||
          ent.telefono !== ed.entrega.telefono
        if (otra) {
          if (!ENTREGA_MODIFICABLE.includes(ent.estado)) {
            return {
              ok: false as const,
              mensaje: 'La entrega ya salió o se hizo: sus datos ya no se cambian.',
              campo: 'direccion',
            }
          }
          if (ed.entrega.modalidad !== 'recoge' && !ed.entrega.direccion) {
            return {
              ok: false as const,
              mensaje: 'Escribe la dirección de entrega (o escoge que recoge en el taller).',
              campo: 'direccion',
            }
          }
          Object.assign(cambiosEntrega, ed.entrega)
          cambios.push('entrega')
        }
      }
      await tx.update(entregas).set({ ...cambiosEntrega, actualizadoEn: new Date() }).where(eq(entregas.id, ent.id))
    }

    // 5) Fecha prometida: la que puso el admin, o se recalcula si cambiaron los productos
    if (ed.fechaCompromiso) {
      const f = new Date(ed.fechaCompromiso)
      if (!actual.fechaCompromiso || f.getTime() !== actual.fechaCompromiso.getTime()) {
        await tx
          .update(pedidos)
          .set({ fechaCompromiso: f, listoCompromiso: actual.listoCompromiso ?? f })
          .where(eq(pedidos.id, p.id))
        await tx
          .update(entregas)
          .set({ fechaProgramada: f, franja: franjaDe(f.toISOString()) })
          .where(and(eq(entregas.pedidoId, p.id), eq(entregas.estado, 'por_programar')))
        cambios.push('fecha prometida')
      }
    } else if (
      (cambianProductos || (ed.entrega && ed.entrega.modalidad !== actual.modalidad)) &&
      actual.fechaCompromiso
    ) {
      await comprometerPedido(tx, p.id)
    }

    if (!cambios.length) return { ok: true as const, sinCambios: true }
    const totalTxt =
      total !== actual.total
        ? ` Total: $ ${actual.total.toLocaleString('es-CO')} → $ ${total.toLocaleString('es-CO')}.`
        : ''
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota: `El administrador modificó el pedido: ${cambios.join(', ')}.${totalTxt}`,
      usuarioId: u.id,
    })
    await recalcularPedido(tx, p.id, u.id)
    return { ok: true as const, sinCambios: false }
  })
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: 'campo' in r ? r.campo : undefined }, 400)
  return c.json({ ...(await responder(p.id, u)), sinCambios: r.sinCambios })
})

rutasPedidos.post('/subida', vende, (c) => permisoDeSubida(c, SOLO_IMAGENES))
