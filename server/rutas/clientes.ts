import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  type ClienteFicha,
  type ClienteFila,
  type MovimientoCliente,
  TIENE_PEDIDOS,
} from '../../shared/clientes.js'
import { validarCliente } from '../../shared/cotizacion.js'
import { getDb } from '../db/index.js'
import { clientes, cotizaciones, pedidos, usuarios } from '../db/schema.js'
import { conSesion, soloRoles, type UsuarioSesion, type Variables } from '../sesion.js'

export const rutasClientes = new Hono<{ Variables: Variables }>()

rutasClientes.use('*', conSesion, soloRoles('admin', 'comercial'))

const NO_EXISTE = 'No encontramos ese cliente. Puede que lo hayan borrado.'

/** El admin ve todos los clientes; el comercial, solo los suyos. */
const veTodos = (u: UsuarioSesion) => u.roles.includes('admin')

/** Condición "clientes que esta persona puede ver" (sin los borrados). */
export function clientesDe(u: UsuarioSesion) {
  return and(
    isNull(clientes.borradoEn),
    veTodos(u) ? undefined : eq(clientes.comercialId, u.id)
  )
}

/** ¿Esta persona puede usar ese cliente? (cotizaciones, pedidos...) */
export async function puedeUsarCliente(u: UsuarioSesion, clienteId: number) {
  const [f] = await getDb()
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), clientesDe(u)))
  return !!f
}

/** Lo que impide borrar un cliente (también lo usa la Papelera del admin). */
export async function impedimentoCliente(clienteId: number): Promise<string | null> {
  const [p] = await getDb()
    .select({ id: pedidos.id })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.clienteId, clienteId),
        ne(pedidos.estado, 'cancelado'),
        isNull(pedidos.borradoEn)
      )
    )
    .limit(1)
  return p ? TIENE_PEDIDOS : null
}

const columnas = {
  id: clientes.id,
  nombre: clientes.nombre,
  whatsapp: clientes.whatsapp,
  email: clientes.email,
  ciudad: clientes.ciudad,
  direccion: clientes.direccion,
  documento: clientes.documento,
}

// ===================== Buscar (selector de la cotización) =====================

rutasClientes.get('/', async (c) => {
  const u = c.get('usuario')
  const q = (c.req.query('q') ?? '').trim()
  const filtro = q
    ? or(
        ilike(clientes.nombre, `%${q}%`),
        ilike(clientes.whatsapp, `%${q}%`),
        ilike(clientes.documento, `%${q}%`)
      )
    : undefined
  const lista = await getDb()
    .select(columnas)
    .from(clientes)
    .where(and(clientesDe(u), filtro))
    .orderBy(asc(clientes.nombre))
    .limit(50)
  return c.json({ clientes: lista })
})

// ===================== Lista completa (pantalla Clientes) =====================

rutasClientes.get('/lista', async (c) => {
  const u = c.get('usuario')
  const db = getDb()
  const filas = await db
    .select({
      ...columnas,
      comercialId: clientes.comercialId,
      comercialNombre: usuarios.nombre,
      creadoEn: clientes.creadoEn,
    })
    .from(clientes)
    .leftJoin(usuarios, eq(usuarios.id, clientes.comercialId))
    .where(clientesDe(u))
    .orderBy(asc(clientes.nombre))
    .limit(2000)
  const ids = filas.map((f) => f.id)
  // El comercial solo cuenta lo suyo; el admin, todo
  const deQuien = (col: typeof cotizaciones.comercialId | typeof pedidos.comercialId) =>
    veTodos(u) ? undefined : eq(col, u.id)
  const cots = ids.length
    ? await db
        .select({
          clienteId: cotizaciones.clienteId,
          n: sql<number>`count(*)::int`,
          ultimo: sql<string | null>`max(${cotizaciones.creadoEn})`,
        })
        .from(cotizaciones)
        .where(
          and(
            inArray(cotizaciones.clienteId, ids),
            isNull(cotizaciones.borradoEn),
            deQuien(cotizaciones.comercialId)
          )
        )
        .groupBy(cotizaciones.clienteId)
    : []
  const peds = ids.length
    ? await db
        .select({
          clienteId: pedidos.clienteId,
          n: sql<number>`count(*) filter (where ${pedidos.estado} <> 'cancelado')::int`,
          comprado: sql<number>`coalesce(sum(${pedidos.total}) filter (where ${pedidos.estado} <> 'cancelado'), 0)::int`,
          ultimo: sql<string | null>`max(${pedidos.creadoEn})`,
        })
        .from(pedidos)
        .where(
          and(
            inArray(pedidos.clienteId, ids),
            isNull(pedidos.borradoEn),
            deQuien(pedidos.comercialId)
          )
        )
        .groupBy(pedidos.clienteId)
    : []
  const mapaC = new Map(cots.map((x) => [x.clienteId, x]))
  const mapaP = new Map(peds.map((x) => [x.clienteId, x]))
  const iso = (v: string | Date | null | undefined) =>
    v ? new Date(v).toISOString() : null
  const lista: ClienteFila[] = filas.map((f) => {
    const cc = mapaC.get(f.id)
    const pp = mapaP.get(f.id)
    const fechas = [iso(cc?.ultimo), iso(pp?.ultimo)].filter(Boolean) as string[]
    return {
      id: f.id,
      nombre: f.nombre,
      whatsapp: f.whatsapp,
      email: f.email,
      ciudad: f.ciudad,
      direccion: f.direccion,
      documento: f.documento,
      comercial: f.comercialId ? { id: f.comercialId, nombre: f.comercialNombre ?? '' } : null,
      cotizaciones: cc?.n ?? 0,
      pedidos: pp?.n ?? 0,
      comprado: pp?.comprado ?? 0,
      ultimoMovimiento: fechas.sort().at(-1) ?? null,
    }
  })
  return c.json({ clientes: lista })
})

// ===================== Ficha =====================

async function comercialesActivos() {
  return getDb()
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .where(
      and(
        eq(usuarios.activo, true),
        sql`('comercial' = any(${usuarios.roles}) or 'admin' = any(${usuarios.roles}))`
      )
    )
    .orderBy(asc(usuarios.nombre))
}

async function ficha(u: UsuarioSesion, id: number): Promise<ClienteFicha | null> {
  const db = getDb()
  const [f] = await db
    .select({
      ...columnas,
      comercialId: clientes.comercialId,
      comercialNombre: usuarios.nombre,
      creadoEn: clientes.creadoEn,
    })
    .from(clientes)
    .leftJoin(usuarios, eq(usuarios.id, clientes.comercialId))
    .where(and(eq(clientes.id, id), clientesDe(u)))
  if (!f) return null
  const nombres = new Map(
    (await db.select({ id: usuarios.id, nombre: usuarios.nombre }).from(usuarios)).map((x) => [
      x.id,
      x.nombre,
    ])
  )
  const mov = (x: {
    id: number
    codigo: string
    estado: string
    total: number
    creadoEn: Date
    comercialId: number
  }): MovimientoCliente => ({
    id: x.id,
    codigo: x.codigo,
    estado: x.estado,
    total: x.total,
    creadoEn: x.creadoEn.toISOString(),
    comercial: veTodos(u) ? (nombres.get(x.comercialId) ?? '') : '',
  })
  const cots = await db
    .select({
      id: cotizaciones.id,
      codigo: cotizaciones.codigo,
      estado: cotizaciones.estado,
      total: cotizaciones.total,
      creadoEn: cotizaciones.creadoEn,
      comercialId: cotizaciones.comercialId,
    })
    .from(cotizaciones)
    .where(
      and(
        eq(cotizaciones.clienteId, id),
        isNull(cotizaciones.borradoEn),
        veTodos(u) ? undefined : eq(cotizaciones.comercialId, u.id)
      )
    )
    .orderBy(desc(cotizaciones.creadoEn))
    .limit(100)
  const peds = await db
    .select({
      id: pedidos.id,
      codigo: pedidos.codigo,
      estado: pedidos.estado,
      total: pedidos.total,
      creadoEn: pedidos.creadoEn,
      comercialId: pedidos.comercialId,
    })
    .from(pedidos)
    .where(
      and(
        eq(pedidos.clienteId, id),
        isNull(pedidos.borradoEn),
        veTodos(u) ? undefined : eq(pedidos.comercialId, u.id)
      )
    )
    .orderBy(desc(pedidos.creadoEn))
    .limit(100)
  return {
    cliente: {
      id: f.id,
      nombre: f.nombre,
      whatsapp: f.whatsapp,
      email: f.email,
      ciudad: f.ciudad,
      direccion: f.direccion,
      documento: f.documento,
    },
    comercial: f.comercialId ? { id: f.comercialId, nombre: f.comercialNombre ?? '' } : null,
    creadoEn: f.creadoEn.toISOString(),
    cotizaciones: cots.map(mov),
    pedidos: peds.map(mov),
    comprado: peds.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + p.total, 0),
    noSePuedeBorrar: await impedimentoCliente(id),
    comerciales: veTodos(u) ? await comercialesActivos() : [],
  }
}

rutasClientes.get('/:id', async (c) => {
  const r = await ficha(c.get('usuario'), Number(c.req.param('id')) || 0)
  if (!r) return c.json({ mensaje: NO_EXISTE }, 404)
  return c.json(r)
})

// ===================== Crear / editar =====================

rutasClientes.post('/', async (c) => {
  const yo = c.get('usuario')
  const v = validarCliente(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const [nuevo] = await getDb()
    .insert(clientes)
    .values({ ...v.datos, creadoPor: yo.id, comercialId: yo.id })
    .returning(columnas)
  return c.json({ cliente: nuevo }, 201)
})

rutasClientes.patch('/:id', async (c) => {
  const u = c.get('usuario')
  const id = Number(c.req.param('id')) || 0
  const v = validarCliente(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const [act] = await getDb()
    .update(clientes)
    .set({ ...v.datos, actualizadoEn: new Date() })
    .where(and(eq(clientes.id, id), clientesDe(u)))
    .returning(columnas)
  if (!act) return c.json({ mensaje: NO_EXISTE }, 404)
  return c.json({ cliente: act })
})

/** Solo el admin: pasar el cliente a otro comercial. */
rutasClientes.post('/:id/comercial', async (c) => {
  const u = c.get('usuario')
  if (!veTodos(u)) {
    return c.json({ mensaje: 'Solo el administrador puede pasar un cliente a otro comercial.' }, 403)
  }
  const id = Number(c.req.param('id')) || 0
  const cuerpo = await c.req.json().catch(() => ({}))
  const destino = Number(cuerpo.comercialId) || 0
  const permitidos = await comercialesActivos()
  const quien = permitidos.find((p) => p.id === destino)
  if (!quien) {
    return c.json({ mensaje: 'Escoge un comercial activo de la lista.', campo: 'comercialId' }, 400)
  }
  const [act] = await getDb()
    .update(clientes)
    .set({ comercialId: destino, actualizadoEn: new Date() })
    .where(and(eq(clientes.id, id), isNull(clientes.borradoEn)))
    .returning({ id: clientes.id })
  if (!act) return c.json({ mensaje: NO_EXISTE }, 404)
  return c.json(await ficha(u, id))
})

// ===================== Borrar =====================

/** Borrar (va a la Papelera del admin). No se puede si tiene pedidos. */
rutasClientes.post('/:id/borrar', async (c) => {
  const u = c.get('usuario')
  const id = Number(c.req.param('id')) || 0
  if (!(await puedeUsarCliente(u, id))) return c.json({ mensaje: NO_EXISTE }, 404)
  const motivo = await impedimentoCliente(id)
  if (motivo) return c.json({ mensaje: motivo }, 409)
  await getDb()
    .update(clientes)
    .set({ borradoEn: new Date(), borradoPor: u.id })
    .where(and(eq(clientes.id, id), isNull(clientes.borradoEn)))
  return c.json({ ok: true })
})

