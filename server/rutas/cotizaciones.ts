import { and, asc, desc, eq, inArray, lt, max, sql } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import {
  type Cargo,
  type CotizacionDetalle,
  type CotizacionEntrada,
  type CotizacionResumen,
  type EstadoCotizacion,
  type LineaCotizacion,
  type Modalidad,
  calcularCotizacion,
  codigoCotizacion,
  leerEntradaCotizacion,
  validarColoresCotizacion,
  validarParaEnviar,
  validarPreciosCotizacion,
} from '../../shared/cotizacion.js'
import { skuDe } from '../../shared/taller.js'
import { getDb } from '../db/index.js'
import {
  clientes,
  cotizacionCargos,
  cotizacionImagenes,
  cotizacionLineas,
  cotizaciones,
  pedidos,
  productoArchivos,
  productos,
  usuarios,
} from '../db/schema.js'
import { conSesion, soloRoles, type UsuarioSesion, type Variables } from '../sesion.js'
import { coloresDe } from '../stock.js'
import { permisoDeSubida, SOLO_IMAGENES, urlDeBlobValida } from '../subidas.js'
import { leerConfiguracion } from './configuracion.js'

export const rutasCotizaciones = new Hono<{ Variables: Variables }>()

rutasCotizaciones.use('*', conSesion)

const vende = soloRoles('admin', 'comercial')
const ve = soloRoles('admin', 'comercial', 'fabricacion')

const NO_EXISTE = 'No encontramos esa cotización.'
const SOLO_BORRADOR =
  'Esta cotización ya se envió y no se puede cambiar. Usa “Hacer cambios” para crear una versión nueva.'

const esAdmin = (u: UsuarioSesion) => u.roles.includes('admin')
const veGanancia = (u: UsuarioSesion) => esAdmin(u) || u.roles.includes('comercial')

function anioBogota() {
  return Number(
    new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric' }).format(
      new Date()
    )
  )
}

/** Las enviadas cuya vigencia pasó quedan vencidas. */
async function marcarVencidas() {
  await getDb()
    .update(cotizaciones)
    .set({ estado: 'vencida', actualizadoEn: new Date() })
    .where(and(eq(cotizaciones.estado, 'enviada'), lt(cotizaciones.venceEn, new Date())))
}

type FilaCot = typeof cotizaciones.$inferSelect

/** Trae la cotización y comprueba que esta persona la pueda ver o cambiar. */
async function cargar(id: number, u: UsuarioSesion, paraCambiar: boolean) {
  const [cot] = await getDb().select().from(cotizaciones).where(eq(cotizaciones.id, id))
  if (!cot) return { error: NO_EXISTE, status: 404 as const }
  const propia = cot.comercialId === u.id
  const soloLee = !esAdmin(u) && !propia
  if (soloLee && (paraCambiar || !u.roles.includes('fabricacion'))) {
    return {
      error: 'Esta cotización es de otro comercial. Solo él o el administrador la pueden cambiar.',
      status: 403 as const,
    }
  }
  return { cot }
}

async function detalle(cot: FilaCot, u: UsuarioSesion): Promise<CotizacionDetalle> {
  const db = getDb()
  const [cliente] = cot.clienteId
    ? await db.select().from(clientes).where(eq(clientes.id, cot.clienteId))
    : []
  const [comercial] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .where(eq(usuarios.id, cot.comercialId))
  const lineas = await db
    .select()
    .from(cotizacionLineas)
    .where(eq(cotizacionLineas.cotizacionId, cot.id))
    .orderBy(asc(cotizacionLineas.orden))
  const cargos = await db
    .select({ concepto: cotizacionCargos.concepto, valor: cotizacionCargos.valor })
    .from(cotizacionCargos)
    .where(eq(cotizacionCargos.cotizacionId, cot.id))
    .orderBy(asc(cotizacionCargos.id))
  const imagenes = await db
    .select({ id: cotizacionImagenes.id, url: cotizacionImagenes.url, nombre: cotizacionImagenes.nombre })
    .from(cotizacionImagenes)
    .where(eq(cotizacionImagenes.cotizacionId, cot.id))
    .orderBy(asc(cotizacionImagenes.id))
  const [siguiente] = await db
    .select({ id: cotizaciones.id })
    .from(cotizaciones)
    .where(eq(cotizaciones.reemplazaId, cot.id))
  const [pedido] = await db
    .select({ id: pedidos.id, codigo: pedidos.codigo })
    .from(pedidos)
    .where(eq(pedidos.cotizacionId, cot.id))
  const config = await leerConfiguracion()
  const lineasOut: LineaCotizacion[] = lineas.map((l) => ({
    productoId: l.productoId,
    nombre: l.nombre,
    descripcion: l.descripcion,
    imagen: l.imagen,
    cantidad: l.cantidad,
    precioFabrica: l.precioFabrica,
    precioVenta: l.precioVenta,
    personalizado: l.personalizado,
    diasFabricacion: l.diasFabricacion,
    desdeStock: l.desdeStock,
    bobinaId: l.bobinaId,
    color: l.color,
    colorHex: l.colorHex,
  }))
  const resumen = calcularCotizacion(
    lineasOut,
    cargos,
    cot.descuento,
    cot.modalidad as Modalidad,
    config
  )
  // Para enviadas, el anticipo y los días quedan como se enviaron.
  if (cot.estado !== 'borrador') {
    resumen.anticipoPct = cot.anticipoPct
    resumen.anticipo = cot.anticipo
    resumen.saldo = cot.total - cot.anticipo
    resumen.diasFabricacion = cot.diasFabricacion
    resumen.diasEnvio = cot.diasEnvio
  }
  const ocultar = !veGanancia(u)
  return {
    id: cot.id,
    codigo: cot.codigo,
    version: cot.version,
    estado: cot.estado as EstadoCotizacion,
    cliente: cliente
      ? {
          id: cliente.id,
          nombre: cliente.nombre,
          whatsapp: cliente.whatsapp,
          email: cliente.email,
          ciudad: cliente.ciudad,
          direccion: cliente.direccion,
          documento: cliente.documento,
        }
      : null,
    comercial: comercial ?? { id: cot.comercialId, nombre: '—' },
    total: resumen.total,
    ganancia: ocultar ? 0 : resumen.ganancia,
    creadaEn: cot.creadoEn.toISOString(),
    enviadaEn: cot.enviadaEn?.toISOString() ?? null,
    venceEn: cot.venceEn?.toISOString() ?? null,
    modalidad: cot.modalidad as Modalidad,
    lineas: ocultar ? lineasOut.map((l) => ({ ...l, precioFabrica: 0 })) : lineasOut,
    cargos,
    notas: cot.notas,
    motivoRechazo: cot.motivoRechazo,
    imagenes,
    resumen: ocultar ? { ...resumen, ganancia: 0 } : resumen,
    reemplazadaPor: siguiente?.id ?? null,
    pedido: pedido ?? null,
  }
}

/**
 * Valida la entrada contra el catálogo actual y arma las líneas con los
 * precios de fábrica de hoy (quedan congelados cuando se envía).
 */
async function armar(entrada: CotizacionEntrada) {
  const db = getDb()
  const config = await leerConfiguracion()
  const ids = [...new Set(entrada.lineas.map((l) => l.productoId))]
  const prods = ids.length
    ? await db.select().from(productos).where(inArray(productos.id, ids))
    : []
  const mapa = new Map(prods.map((p) => [p.id, p]))
  const v = validarPreciosCotizacion(entrada.lineas, mapa, entrada.descuento, config.tope_comercial)
  if (!v.ok) return v
  const colores = await coloresDe(
    db,
    prods.filter((p) => p.escogeColor).map((p) => p.id)
  )
  const vc = validarColoresCotizacion(
    entrada.lineas,
    new Map(
      prods.map((p) => [
        p.id,
        { nombre: p.nombre, escogeColor: p.escogeColor, colores: colores.get(p.id) ?? [] },
      ])
    )
  )
  if (!vc.ok) return vc

  const fotos = ids.length
    ? await db
        .select({ productoId: productoArchivos.productoId, url: productoArchivos.url })
        .from(productoArchivos)
        .where(and(inArray(productoArchivos.productoId, ids), eq(productoArchivos.tipo, 'imagen')))
        .orderBy(desc(productoArchivos.esPortada), asc(productoArchivos.id))
    : []
  const portada = new Map<number, string>()
  for (const f of fotos) if (!portada.has(f.productoId)) portada.set(f.productoId, f.url)

  const lineas: LineaCotizacion[] = entrada.lineas.map((l) => {
    const p = mapa.get(l.productoId)!
    const color = p.escogeColor
      ? (colores.get(p.id) ?? []).find((c) => c.bobinaId === l.bobinaId)
      : undefined
    const stock = p.escogeColor ? (color?.stock ?? 0) : p.stock
    return {
      productoId: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagen: portada.get(p.id) ?? null,
      cantidad: l.cantidad,
      precioFabrica: p.precioFabrica,
      precioVenta: l.precioVenta,
      personalizado: p.tipo === 'personalizado',
      diasFabricacion: p.diasFabricacion,
      desdeStock: stock >= l.cantidad,
      bobinaId: color?.bobinaId ?? null,
      color: color?.color ?? '',
      colorHex: color?.colorHex ?? '',
    }
  })
  const resumen = calcularCotizacion(
    lineas,
    entrada.cargos,
    entrada.descuento,
    entrada.modalidad,
    config
  )
  return { ok: true as const, lineas, resumen, config }
}

async function guardarHijos(
  tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
  cotizacionId: number,
  lineas: LineaCotizacion[],
  cargos: Cargo[]
) {
  await tx.delete(cotizacionLineas).where(eq(cotizacionLineas.cotizacionId, cotizacionId))
  await tx.delete(cotizacionCargos).where(eq(cotizacionCargos.cotizacionId, cotizacionId))
  if (lineas.length) {
    await tx
      .insert(cotizacionLineas)
      .values(lineas.map((l, orden) => ({ ...l, cotizacionId, orden })))
  }
  if (cargos.length) {
    await tx.insert(cotizacionCargos).values(cargos.map((cg) => ({ ...cg, cotizacionId })))
  }
}

const columnasResumen = (r: Awaited<ReturnType<typeof armar>> & { ok: true }) => ({
  subtotal: r.resumen.subtotal,
  totalCargos: r.resumen.cargos,
  total: r.resumen.total,
  ganancia: r.resumen.ganancia,
  anticipoPct: r.resumen.anticipoPct,
  anticipo: r.resumen.anticipo,
  diasFabricacion: r.resumen.diasFabricacion,
  diasEnvio: r.resumen.diasEnvio,
})

// ===================== Rutas =====================

rutasCotizaciones.get('/', ve, async (c) => {
  await marcarVencidas()
  const u = c.get('usuario')
  const db = getDb()
  const soloMias = !esAdmin(u) && !u.roles.includes('fabricacion')
  const filas = await db
    .select({
      cot: cotizaciones,
      clienteNombre: clientes.nombre,
      comercialNombre: usuarios.nombre,
      lineas: sql<number>`(select count(*)::int from cotizacion_lineas l where l.cotizacion_id = ${cotizaciones.id})`,
    })
    .from(cotizaciones)
    .leftJoin(clientes, eq(clientes.id, cotizaciones.clienteId))
    .innerJoin(usuarios, eq(usuarios.id, cotizaciones.comercialId))
    .where(soloMias ? eq(cotizaciones.comercialId, u.id) : undefined)
    .orderBy(desc(cotizaciones.actualizadoEn))
    .limit(300)
  const lista: CotizacionResumen[] = filas.map(({ cot, clienteNombre, comercialNombre, lineas }) => ({
    id: cot.id,
    codigo: cot.codigo,
    version: cot.version,
    estado: cot.estado as EstadoCotizacion,
    cliente: cot.clienteId ? { id: cot.clienteId, nombre: clienteNombre ?? '' } : null,
    comercial: { id: cot.comercialId, nombre: comercialNombre },
    total: cot.total,
    ganancia: veGanancia(u) ? cot.ganancia : 0,
    lineas,
    creadaEn: cot.creadoEn.toISOString(),
    enviadaEn: cot.enviadaEn?.toISOString() ?? null,
    venceEn: cot.venceEn?.toISOString() ?? null,
  }))
  return c.json({ cotizaciones: lista })
})

rutasCotizaciones.get('/:id', ve, async (c) => {
  await marcarVencidas()
  const r = await cargar(Number(c.req.param('id')) || 0, c.get('usuario'), false)
  if ('error' in r) return c.json({ mensaje: r.error }, r.status)
  return c.json({ cotizacion: await detalle(r.cot, c.get('usuario')) })
})

rutasCotizaciones.post('/', vende, async (c) => {
  const e = leerEntradaCotizacion(await c.req.json().catch(() => ({})))
  if (!e.ok) return c.json({ mensaje: e.mensaje, campo: e.campo }, 400)
  const r = await armar(e.datos)
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  const u = c.get('usuario')
  const anio = anioBogota()
  const db = getDb()
  const id = await db.transaction(async (tx) => {
    // Bloquea el consecutivo del año mientras se calcula el siguiente número
    await tx.execute(sql`select pg_advisory_xact_lock(${anio})`)
    const [fila] = await tx
      .select({ ultimo: max(cotizaciones.numero) })
      .from(cotizaciones)
      .where(eq(cotizaciones.anio, anio))
    const numero = (fila?.ultimo ?? 0) + 1
    const [nueva] = await tx
      .insert(cotizaciones)
      .values({
        anio,
        numero,
        version: 1,
        codigo: codigoCotizacion(anio, numero, 1),
        clienteId: e.datos.clienteId,
        comercialId: u.id,
        modalidad: e.datos.modalidad,
        descuento: e.datos.descuento,
        notas: e.datos.notas,
        ...columnasResumen(r),
      })
      .returning({ id: cotizaciones.id })
    await guardarHijos(tx, nueva.id, r.lineas, e.datos.cargos)
    return nueva.id
  })
  const [cot] = await db.select().from(cotizaciones).where(eq(cotizaciones.id, id))
  return c.json({ cotizacion: await detalle(cot, u) }, 201)
})

rutasCotizaciones.patch('/:id', vende, async (c) => {
  const u = c.get('usuario')
  const r0 = await cargar(Number(c.req.param('id')) || 0, u, true)
  if ('error' in r0) return c.json({ mensaje: r0.error }, r0.status)
  if (r0.cot.estado !== 'borrador') return c.json({ mensaje: SOLO_BORRADOR }, 400)
  const e = leerEntradaCotizacion(await c.req.json().catch(() => ({})))
  if (!e.ok) return c.json({ mensaje: e.mensaje, campo: e.campo }, 400)
  const r = await armar(e.datos)
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .update(cotizaciones)
      .set({
        clienteId: e.datos.clienteId,
        modalidad: e.datos.modalidad,
        descuento: e.datos.descuento,
        notas: e.datos.notas,
        ...columnasResumen(r),
        actualizadoEn: new Date(),
      })
      .where(eq(cotizaciones.id, r0.cot.id))
    await guardarHijos(tx, r0.cot.id, r.lineas, e.datos.cargos)
  })
  const [cot] = await db.select().from(cotizaciones).where(eq(cotizaciones.id, r0.cot.id))
  return c.json({ cotizacion: await detalle(cot, u) })
})

rutasCotizaciones.delete('/:id', vende, async (c) => {
  const r = await cargar(Number(c.req.param('id')) || 0, c.get('usuario'), true)
  if ('error' in r) return c.json({ mensaje: r.error }, r.status)
  if (r.cot.estado !== 'borrador') {
    return c.json({ mensaje: 'Solo se pueden borrar cotizaciones que no se han enviado.' }, 400)
  }
  const db = getDb()
  await db.transaction(async (tx) => {
    // Si era una versión nueva, la anterior vuelve a quedar como estaba
    if (r.cot.reemplazaId) {
      await tx
        .update(cotizaciones)
        .set({ estado: 'enviada', actualizadoEn: new Date() })
        .where(and(eq(cotizaciones.id, r.cot.reemplazaId), eq(cotizaciones.estado, 'reemplazada')))
      await marcarVencidas()
    }
    await tx.delete(cotizaciones).where(eq(cotizaciones.id, r.cot.id))
  })
  return c.json({ ok: true })
})

/** El comercial ya le mandó el PDF al cliente: se congelan precios y corre la vigencia. */
rutasCotizaciones.post('/:id/enviar', vende, async (c) => {
  const u = c.get('usuario')
  const r0 = await cargar(Number(c.req.param('id')) || 0, u, true)
  if ('error' in r0) return c.json({ mensaje: r0.error }, r0.status)
  if (r0.cot.estado !== 'borrador') {
    return c.json({ mensaje: 'Esta cotización ya estaba marcada como enviada.' }, 400)
  }
  const db = getDb()
  const lineas = await db
    .select({
      productoId: cotizacionLineas.productoId,
      cantidad: cotizacionLineas.cantidad,
      precioVenta: cotizacionLineas.precioVenta,
      bobinaId: cotizacionLineas.bobinaId,
    })
    .from(cotizacionLineas)
    .where(eq(cotizacionLineas.cotizacionId, r0.cot.id))
    .orderBy(asc(cotizacionLineas.orden))
  const listo = validarParaEnviar({ clienteId: r0.cot.clienteId, lineas })
  if (!listo.ok) return c.json({ mensaje: listo.mensaje, campo: listo.campo }, 400)
  // Se vuelve a validar contra el catálogo de hoy por si el taller cambió precios
  const cargos = await db
    .select({ concepto: cotizacionCargos.concepto, valor: cotizacionCargos.valor })
    .from(cotizacionCargos)
    .where(eq(cotizacionCargos.cotizacionId, r0.cot.id))
  const r = await armar({
    clienteId: r0.cot.clienteId,
    modalidad: r0.cot.modalidad as Modalidad,
    lineas,
    cargos,
    descuento: r0.cot.descuento,
    notas: r0.cot.notas,
  })
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  const ahora = new Date()
  const vence = new Date(ahora.getTime() + r.config.vigencia_cotizacion_dias * 86_400_000)
  await db.transaction(async (tx) => {
    await tx
      .update(cotizaciones)
      .set({
        estado: 'enviada',
        enviadaEn: ahora,
        venceEn: vence,
        ...columnasResumen(r),
        actualizadoEn: ahora,
      })
      .where(eq(cotizaciones.id, r0.cot.id))
    await guardarHijos(tx, r0.cot.id, r.lineas, cargos)
  })
  const [cot] = await db.select().from(cotizaciones).where(eq(cotizaciones.id, r0.cot.id))
  return c.json({ cotizacion: await detalle(cot, u) })
})

async function decidir(
  c: Context<{ Variables: Variables }>,
  estado: 'aprobada' | 'rechazada'
) {
  await marcarVencidas()
  const u = c.get('usuario')
  const r = await cargar(Number(c.req.param('id')) || 0, u, true)
  if ('error' in r) return c.json({ mensaje: r.error }, r.status)
  if (r.cot.estado === 'vencida' && estado === 'aprobada') {
    return c.json(
      {
        mensaje:
          'Esta cotización ya venció. Usa “Hacer cambios” para crear una versión nueva con precios de hoy.',
      },
      400
    )
  }
  if (r.cot.estado !== 'enviada' && !(r.cot.estado === 'vencida' && estado === 'rechazada')) {
    return c.json({ mensaje: 'Solo se puede responder una cotización enviada.' }, 400)
  }
  const cuerpo = await c.req.json().catch(() => ({}))
  const motivo = String(cuerpo.motivo ?? '').trim().slice(0, 300)
  const db = getDb()
  await db
    .update(cotizaciones)
    .set({ estado, motivoRechazo: estado === 'rechazada' ? motivo : '', decididaEn: new Date(), actualizadoEn: new Date() })
    .where(eq(cotizaciones.id, r.cot.id))
  const [cot] = await db.select().from(cotizaciones).where(eq(cotizaciones.id, r.cot.id))
  return c.json({ cotizacion: await detalle(cot, u) })
}

rutasCotizaciones.post('/:id/aprobar', vende, (c) => decidir(c, 'aprobada'))
rutasCotizaciones.post('/:id/rechazar', vende, (c) => decidir(c, 'rechazada'))

/** Copia una cotización ya enviada en un borrador nuevo (versión siguiente). */
rutasCotizaciones.post('/:id/nueva-version', vende, async (c) => {
  await marcarVencidas()
  const u = c.get('usuario')
  const r = await cargar(Number(c.req.param('id')) || 0, u, true)
  if ('error' in r) return c.json({ mensaje: r.error }, r.status)
  if (!['enviada', 'vencida', 'rechazada'].includes(r.cot.estado)) {
    return c.json(
      {
        mensaje:
          r.cot.estado === 'borrador'
            ? 'Esta cotización todavía es un borrador: puedes cambiarla directamente.'
            : 'De esta cotización ya no se pueden hacer versiones nuevas.',
      },
      400
    )
  }
  const db = getDb()
  const anterior = r.cot
  const nuevaId = await db.transaction(async (tx) => {
    const [ultima] = await tx
      .select({ v: max(cotizaciones.version) })
      .from(cotizaciones)
      .where(and(eq(cotizaciones.anio, anterior.anio), eq(cotizaciones.numero, anterior.numero)))
    const version = (ultima?.v ?? anterior.version) + 1
    const [nueva] = await tx
      .insert(cotizaciones)
      .values({
        anio: anterior.anio,
        numero: anterior.numero,
        version,
        codigo: codigoCotizacion(anterior.anio, anterior.numero, version),
        clienteId: anterior.clienteId,
        comercialId: anterior.comercialId,
        modalidad: anterior.modalidad,
        descuento: anterior.descuento,
        notas: anterior.notas,
        subtotal: anterior.subtotal,
        totalCargos: anterior.totalCargos,
        total: anterior.total,
        ganancia: anterior.ganancia,
        anticipoPct: anterior.anticipoPct,
        anticipo: anterior.anticipo,
        diasFabricacion: anterior.diasFabricacion,
        diasEnvio: anterior.diasEnvio,
        reemplazaId: anterior.id,
      })
      .returning({ id: cotizaciones.id })
    const lineas = await tx
      .select()
      .from(cotizacionLineas)
      .where(eq(cotizacionLineas.cotizacionId, anterior.id))
    if (lineas.length) {
      await tx.insert(cotizacionLineas).values(
        lineas.map(({ id: _id, ...l }) => ({ ...l, cotizacionId: nueva.id }))
      )
    }
    const cargos = await tx
      .select()
      .from(cotizacionCargos)
      .where(eq(cotizacionCargos.cotizacionId, anterior.id))
    if (cargos.length) {
      await tx.insert(cotizacionCargos).values(
        cargos.map(({ id: _id, ...cg }) => ({ ...cg, cotizacionId: nueva.id }))
      )
    }
    const imgs = await tx
      .select()
      .from(cotizacionImagenes)
      .where(eq(cotizacionImagenes.cotizacionId, anterior.id))
    if (imgs.length) {
      await tx.insert(cotizacionImagenes).values(
        imgs.map(({ id: _id, creadoEn: _c, ...i }) => ({ ...i, cotizacionId: nueva.id }))
      )
    }
    await tx
      .update(cotizaciones)
      .set({ estado: 'reemplazada', actualizadoEn: new Date() })
      .where(eq(cotizaciones.id, anterior.id))
    return nueva.id
  })
  const [cot] = await db.select().from(cotizaciones).where(eq(cotizaciones.id, nuevaId))
  return c.json({ cotizacion: await detalle(cot, u) }, 201)
})

// ----- Imágenes de referencia -----

rutasCotizaciones.post('/subida', vende, (c) => permisoDeSubida(c, SOLO_IMAGENES))

rutasCotizaciones.post('/:id/imagenes', vende, async (c) => {
  const u = c.get('usuario')
  const r = await cargar(Number(c.req.param('id')) || 0, u, true)
  if ('error' in r) return c.json({ mensaje: r.error }, r.status)
  if (r.cot.estado !== 'borrador') return c.json({ mensaje: SOLO_BORRADOR }, 400)
  const cuerpo = await c.req.json().catch(() => ({}))
  const url = String(cuerpo.url ?? '')
  if (!urlDeBlobValida(url)) {
    return c.json({ mensaje: 'La imagen no se subió bien. Intenta de nuevo.' }, 400)
  }
  const db = getDb()
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(cotizacionImagenes)
    .where(eq(cotizacionImagenes.cotizacionId, r.cot.id))
  if (total >= 8) return c.json({ mensaje: 'Puedes adjuntar hasta 8 imágenes.' }, 400)
  await db.insert(cotizacionImagenes).values({
    cotizacionId: r.cot.id,
    url,
    nombre: String(cuerpo.nombre ?? '').slice(0, 200),
  })
  return c.json({ cotizacion: await detalle(r.cot, u) }, 201)
})

rutasCotizaciones.delete('/:id/imagenes/:imagenId', vende, async (c) => {
  const u = c.get('usuario')
  const r = await cargar(Number(c.req.param('id')) || 0, u, true)
  if ('error' in r) return c.json({ mensaje: r.error }, r.status)
  if (r.cot.estado !== 'borrador') return c.json({ mensaje: SOLO_BORRADOR }, 400)
  await getDb()
    .delete(cotizacionImagenes)
    .where(
      and(
        eq(cotizacionImagenes.id, Number(c.req.param('imagenId')) || 0),
        eq(cotizacionImagenes.cotizacionId, r.cot.id)
      )
    )
  return c.json({ cotizacion: await detalle(r.cot, u) })
})

// ----- Pedir un personalizado al taller -----

rutasCotizaciones.post('/:id/solicitud', vende, async (c) => {
  const u = c.get('usuario')
  const r = await cargar(Number(c.req.param('id')) || 0, u, true)
  if ('error' in r) return c.json({ mensaje: r.error }, r.status)
  const cuerpo = await c.req.json().catch(() => ({}))
  const nombre = String(cuerpo.nombre ?? '').trim().slice(0, 120)
  const descripcion = String(cuerpo.descripcion ?? '').trim().slice(0, 1000)
  if (nombre.length < 2) {
    return c.json({ mensaje: 'Escribe qué quiere el cliente. Ejemplo: Figura de su mascota.', campo: 'nombre' }, 400)
  }
  if (descripcion.length < 10) {
    return c.json(
      { mensaje: 'Cuéntale al taller más detalles: tamaño, colores, para cuándo…', campo: 'descripcion' },
      400
    )
  }
  const db = getDb()
  const [nuevo] = await db
    .insert(productos)
    .values({
      nombre,
      descripcion: `${descripcion}\n\nPedido por ${u.nombre} en ${r.cot.codigo}.`,
      tipo: 'personalizado',
      estado: 'solicitud',
      creadoPor: u.id,
    })
    .returning({ id: productos.id })
  await db.update(productos).set({ sku: skuDe(nuevo.id) }).where(eq(productos.id, nuevo.id))
  return c.json({ productoId: nuevo.id, sku: skuDe(nuevo.id) }, 201)
})
