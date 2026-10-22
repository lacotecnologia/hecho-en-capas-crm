import { del } from '@vercel/blob'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { calcularCosto } from '../../shared/costos.js'
import {
  type ArchivoProducto,
  type ProductoCosto,
  type ProductoDetalle,
  type ProductoEntrada,
  type ProductoResumen,
  skuDe,
  validarBobina,
  validarImpresora,
  validarPrecio,
  validarProducto,
} from '../../shared/taller.js'
import { getDb } from '../db/index.js'
import {
  bobinas,
  impresoras,
  movimientosStock,
  productoArchivos,
  productos,
} from '../db/schema.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'
import { permisoDeSubida, urlDeBlobValida } from '../subidas.js'
import { leerConfiguracion } from './configuracion.js'

export const rutasTaller = new Hono<{ Variables: Variables }>()

rutasTaller.use('*', conSesion)

const deTaller = soloRoles('admin', 'fabricacion')
const veCatalogo = soloRoles('admin', 'fabricacion', 'comercial')

const idDe = (v: string) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : 0
}

const NO_EXISTE_PRODUCTO = 'No encontramos ese producto. Puede que lo hayan borrado.'

// ===================== Impresoras =====================

rutasTaller.get('/impresoras', deTaller, async (c) => {
  const lista = await getDb()
    .select()
    .from(impresoras)
    .orderBy(desc(impresoras.activa), asc(impresoras.id))
  return c.json({ impresoras: lista })
})

rutasTaller.post('/impresoras', deTaller, async (c) => {
  const v = validarImpresora(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const [nueva] = await getDb().insert(impresoras).values(v.datos).returning()
  return c.json({ impresora: nueva }, 201)
})

rutasTaller.patch('/impresoras/:id', deTaller, async (c) => {
  const v = validarImpresora(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const [act] = await getDb()
    .update(impresoras)
    .set({ ...v.datos, actualizadoEn: new Date() })
    .where(eq(impresoras.id, idDe(c.req.param('id'))))
    .returning()
  if (!act) return c.json({ mensaje: 'No encontramos esa impresora.' }, 404)
  return c.json({ impresora: act })
})

// ===================== Bobinas =====================

rutasTaller.get('/bobinas', deTaller, async (c) => {
  const lista = await getDb()
    .select()
    .from(bobinas)
    .orderBy(desc(bobinas.activa), asc(bobinas.material), asc(bobinas.color))
  return c.json({ bobinas: lista })
})

rutasTaller.post('/bobinas', deTaller, async (c) => {
  const v = validarBobina(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const [nueva] = await getDb().insert(bobinas).values(v.datos).returning()
  return c.json({ bobina: nueva }, 201)
})

rutasTaller.patch('/bobinas/:id', deTaller, async (c) => {
  const v = validarBobina(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const [act] = await getDb()
    .update(bobinas)
    .set({ ...v.datos, actualizadoEn: new Date() })
    .where(eq(bobinas.id, idDe(c.req.param('id'))))
    .returning()
  if (!act) return c.json({ mensaje: 'No encontramos esa bobina.' }, 404)
  return c.json({ bobina: act })
})

// ===================== Productos =====================

type FilaProducto = typeof productos.$inferSelect

async function portadas(ids: number[]) {
  if (ids.length === 0) return new Map<number, string>()
  const filas = await getDb()
    .select({
      productoId: productoArchivos.productoId,
      url: productoArchivos.url,
      esPortada: productoArchivos.esPortada,
    })
    .from(productoArchivos)
    .where(
      and(
        eq(productoArchivos.tipo, 'imagen'),
        inArray(productoArchivos.productoId, ids)
      )
    )
    .orderBy(desc(productoArchivos.esPortada), asc(productoArchivos.id))
  const mapa = new Map<number, string>()
  for (const f of filas) if (!mapa.has(f.productoId)) mapa.set(f.productoId, f.url)
  return mapa
}

function resumen(p: FilaProducto, portada: string | null): ProductoResumen {
  return {
    id: p.id,
    sku: p.sku ?? skuDe(p.id),
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    tipo: p.tipo as ProductoResumen['tipo'],
    estado: p.estado as ProductoResumen['estado'],
    multicolor: p.multicolor,
    precioFabrica: p.precioFabrica,
    diasFabricacion: p.diasFabricacion,
    stock: p.stock,
    portada,
    actualizadoEn: p.actualizadoEn.toISOString(),
  }
}

function costos(p: FilaProducto): ProductoCosto {
  return {
    impresoraId: p.impresoraId,
    bobinaId: p.bobinaId,
    gramos: p.gramos,
    horas: p.horas,
    unidadesPorCama: p.unidadesPorCama,
    minPreparacion: p.minPreparacion,
    minPostproceso: p.minPostproceso,
    horasDiseno: p.horasDiseno,
    unidadesLote: p.unidadesLote,
    empaque: p.empaque,
    margenPct: p.margenPct,
    costo: p.costo,
    precioCalculado: p.precioCalculado,
    precioManual: p.precioManual,
    notaAjuste: p.notaAjuste,
  }
}

async function detalle(id: number, verCostos: boolean) {
  const db = getDb()
  const [p] = await db.select().from(productos).where(eq(productos.id, id))
  if (!p) return null
  const archivos = await db
    .select()
    .from(productoArchivos)
    .where(eq(productoArchivos.productoId, id))
    .orderBy(desc(productoArchivos.esPortada), asc(productoArchivos.id))
  const lista: ArchivoProducto[] = archivos.map((a) => ({
    id: a.id,
    tipo: a.tipo as ArchivoProducto['tipo'],
    nombre: a.nombre,
    url: a.url,
    tamanoBytes: a.tamanoBytes,
    esPortada: a.esPortada,
  }))
  const portada = lista.find((a) => a.tipo === 'imagen')?.url ?? null
  const datos: ProductoDetalle = { ...resumen(p, portada), archivos: lista }
  if (verCostos) datos.costos = costos(p)
  return datos
}

/** Calcula costo y precio con la configuración actual y valida las reglas. */
async function prepararProducto(cuerpo: Record<string, unknown>) {
  const config = await leerConfiguracion()
  const margenes = [config.margen_fabrica_bajo, config.margen_fabrica_alto]
  const v = validarProducto(cuerpo, { margenes })
  if (!v.ok) return v

  const db = getDb()
  const e: ProductoEntrada = v.datos
  const [imp] = e.impresoraId
    ? await db.select().from(impresoras).where(eq(impresoras.id, e.impresoraId))
    : []
  const [bob] = e.bobinaId
    ? await db.select().from(bobinas).where(eq(bobinas.id, e.bobinaId))
    : []

  const calculo = calcularCosto({
    gramos: e.gramos,
    precioRollo: bob?.precioRollo ?? 0,
    pesoRolloG: bob?.pesoG ?? 0,
    horas: e.horas,
    potenciaW: imp ? imp.potenciaW : 0,
    precioImpresora: imp?.precioCompra ?? 0,
    vidaUtilH: imp?.vidaUtilH ?? 0,
    minPreparacion: e.minPreparacion,
    minPostproceso: e.minPostproceso,
    horasDiseno: e.horasDiseno,
    unidadesLote: e.unidadesLote,
    empaque: e.empaque,
    margenPct: e.margenPct,
    tarifaKwh: config.tarifa_kwh,
    tarifaHora: config.tarifa_hora_mano_obra,
    tarifaDiseno: config.tarifa_hora_diseno,
    fallaPct: config.porcentaje_falla,
  })

  const precio = validarPrecio(e, calculo.precioCalculado, imp ?? null)
  if (!precio.ok) return precio

  return {
    ok: true as const,
    fila: {
      ...e,
      precioManual:
        e.precioManual !== null && e.precioManual > calculo.precioCalculado
          ? e.precioManual
          : null,
      notaAjuste:
        e.precioManual !== null && e.precioManual > calculo.precioCalculado
          ? e.notaAjuste
          : '',
      costo: calculo.costo,
      precioCalculado: calculo.precioCalculado,
      precioFabrica: precio.datos,
    },
  }
}

rutasTaller.get('/productos', veCatalogo, async (c) => {
  const lista = await getDb()
    .select()
    .from(productos)
    .orderBy(desc(productos.actualizadoEn))
  const fotos = await portadas(lista.map((p) => p.id))
  return c.json({
    productos: lista.map((p) => resumen(p, fotos.get(p.id) ?? null)),
  })
})

rutasTaller.get('/productos/:id', veCatalogo, async (c) => {
  const { roles } = c.get('usuario')
  const verCostos = roles.includes('admin') || roles.includes('fabricacion')
  const datos = await detalle(idDe(c.req.param('id')), verCostos)
  if (!datos) return c.json({ mensaje: NO_EXISTE_PRODUCTO }, 404)
  return c.json({ producto: datos })
})

rutasTaller.post('/productos', deTaller, async (c) => {
  const r = await prepararProducto(await c.req.json().catch(() => ({})))
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  const db = getDb()
  const [nuevo] = await db
    .insert(productos)
    .values({ ...r.fila, creadoPor: c.get('usuario').id })
    .returning({ id: productos.id })
  await db
    .update(productos)
    .set({ sku: skuDe(nuevo.id) })
    .where(eq(productos.id, nuevo.id))
  return c.json({ producto: await detalle(nuevo.id, true) }, 201)
})

rutasTaller.patch('/productos/:id', deTaller, async (c) => {
  const id = idDe(c.req.param('id'))
  const r = await prepararProducto(await c.req.json().catch(() => ({})))
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  const [act] = await getDb()
    .update(productos)
    .set({ ...r.fila, actualizadoEn: new Date() })
    .where(eq(productos.id, id))
    .returning({ id: productos.id })
  if (!act) return c.json({ mensaje: NO_EXISTE_PRODUCTO }, 404)
  return c.json({ producto: await detalle(id, true) })
})

rutasTaller.post('/productos/:id/stock', deTaller, async (c) => {
  const id = idDe(c.req.param('id'))
  const cuerpo = await c.req.json().catch(() => ({}))
  const cantidad = Number(cuerpo.cantidad)
  const nota = String(cuerpo.nota ?? '').trim().slice(0, 200)
  if (!Number.isInteger(cantidad) || cantidad === 0 || Math.abs(cantidad) > 10_000) {
    return c.json(
      { mensaje: 'Escribe cuántas unidades entran (ej. 10) o salen (ej. -2).' },
      400
    )
  }
  const db = getDb()
  const resultado = await db.transaction(async (tx) => {
    const [p] = await tx
      .select({ stock: productos.stock })
      .from(productos)
      .where(eq(productos.id, id))
      .for('update')
    if (!p) return { error: NO_EXISTE_PRODUCTO, status: 404 as const }
    if (p.stock + cantidad < 0) {
      return {
        error: `No puedes sacar ${Math.abs(cantidad)}: solo hay ${p.stock} en stock.`,
        status: 400 as const,
      }
    }
    await tx
      .update(productos)
      .set({ stock: p.stock + cantidad, actualizadoEn: new Date() })
      .where(eq(productos.id, id))
    await tx.insert(movimientosStock).values({
      productoId: id,
      tipo: cantidad > 0 ? 'produccion' : 'ajuste',
      cantidad,
      nota,
      usuarioId: c.get('usuario').id,
    })
    return { stock: p.stock + cantidad }
  })
  if ('error' in resultado) {
    return c.json({ mensaje: resultado.error }, resultado.status)
  }
  return c.json(resultado)
})

// ===================== Archivos =====================

rutasTaller.post('/subida', deTaller, (c) => permisoDeSubida(c))

rutasTaller.post('/productos/:id/archivos', deTaller, async (c) => {
  const id = idDe(c.req.param('id'))
  const cuerpo = await c.req.json().catch(() => ({}))
  const url = String(cuerpo.url ?? '')
  const tipo = ['imagen', '3mf', 'stl', 'otro'].includes(cuerpo.tipo)
    ? cuerpo.tipo
    : 'otro'
  if (!urlDeBlobValida(url)) {
    return c.json({ mensaje: 'El archivo no se subió bien. Intenta de nuevo.' }, 400)
  }
  const db = getDb()
  const [p] = await db.select({ id: productos.id }).from(productos).where(eq(productos.id, id))
  if (!p) return c.json({ mensaje: NO_EXISTE_PRODUCTO }, 404)

  let esPortada = false
  if (tipo === 'imagen') {
    const [hay] = await db
      .select({ id: productoArchivos.id })
      .from(productoArchivos)
      .where(and(eq(productoArchivos.productoId, id), eq(productoArchivos.tipo, 'imagen')))
      .limit(1)
    esPortada = !hay
  }
  await db.insert(productoArchivos).values({
    productoId: id,
    tipo,
    nombre: String(cuerpo.nombre ?? 'archivo').slice(0, 200),
    url,
    tamanoBytes: Math.max(0, Math.round(Number(cuerpo.tamanoBytes) || 0)),
    esPortada,
  })
  await db.update(productos).set({ actualizadoEn: new Date() }).where(eq(productos.id, id))
  return c.json({ producto: await detalle(id, true) }, 201)
})

rutasTaller.patch('/productos/:id/archivos/:archivoId/portada', deTaller, async (c) => {
  const id = idDe(c.req.param('id'))
  const archivoId = idDe(c.req.param('archivoId'))
  const db = getDb()
  await db.transaction(async (tx) => {
    await tx
      .update(productoArchivos)
      .set({ esPortada: false })
      .where(eq(productoArchivos.productoId, id))
    await tx
      .update(productoArchivos)
      .set({ esPortada: true })
      .where(and(eq(productoArchivos.id, archivoId), eq(productoArchivos.productoId, id)))
  })
  return c.json({ producto: await detalle(id, true) })
})

rutasTaller.delete('/productos/:id/archivos/:archivoId', deTaller, async (c) => {
  const id = idDe(c.req.param('id'))
  const archivoId = idDe(c.req.param('archivoId'))
  const db = getDb()
  const [archivo] = await db
    .delete(productoArchivos)
    .where(and(eq(productoArchivos.id, archivoId), eq(productoArchivos.productoId, id)))
    .returning()
  if (!archivo) return c.json({ mensaje: 'Ese archivo ya no existe.' }, 404)
  if (archivo.esPortada) {
    const [otra] = await db
      .select({ id: productoArchivos.id })
      .from(productoArchivos)
      .where(and(eq(productoArchivos.productoId, id), eq(productoArchivos.tipo, 'imagen')))
      .limit(1)
    if (otra) {
      await db
        .update(productoArchivos)
        .set({ esPortada: true })
        .where(eq(productoArchivos.id, otra.id))
    }
  }
  if (process.env.BLOB_READ_WRITE_TOKEN && urlDeBlobValida(archivo.url)) {
    await del(archivo.url).catch((error) => console.error('[borrar archivo]', error))
  }
  return c.json({ producto: await detalle(id, true) })
})
