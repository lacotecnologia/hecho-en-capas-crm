/**
 * Comisiones: el comercial ve las suyas; el administrador ve las de todos,
 * las paga (liquida todo lo pendiente) y hace ajustes.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  ganaComision,
  type ResumenComisiones,
  saldoPendiente,
  validarAjusteComision,
  validarPagoComision,
} from '../../shared/comisiones.js'
import { resumenComisiones } from '../comisiones.js'
import { getDb } from '../db/index.js'
import { comisiones, pagosComision, usuarios } from '../db/schema.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'
import { permisoDeSubida, SOLO_IMAGENES, urlDeBlobValida } from '../subidas.js'

export const rutasComisiones = new Hono<{ Variables: Variables }>()

rutasComisiones.use('*', conSesion)

const soloAdmin = soloRoles('admin')

/** Comerciales con comisión: los que la ganan hoy, más quien tenga algo pendiente. */
async function comerciales() {
  const db = getDb()
  const todos = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      roles: usuarios.roles,
      activo: usuarios.activo,
      pendientes: sql<number>`(select count(*)::int from comisiones c where c.comercial_id = "usuarios"."id" and c.pago_id is null)`,
    })
    .from(usuarios)
    .orderBy(asc(usuarios.nombre))
  return todos.filter((u) => ganaComision(u.roles) || u.pendientes > 0)
}

// El comercial: lo suyo
rutasComisiones.get('/mias', soloRoles('comercial'), async (c) => {
  const u = c.get('usuario')
  const resumen = await resumenComisiones(getDb(), { id: u.id, nombre: u.nombre, activo: true })
  return c.json({ resumen })
})

// El administrador: todos los comerciales
rutasComisiones.get('/', soloAdmin, async (c) => {
  const db = getDb()
  const lista: ResumenComisiones[] = []
  for (const u of await comerciales()) {
    lista.push(await resumenComisiones(db, { id: u.id, nombre: u.nombre, activo: u.activo }))
  }
  return c.json({ comerciales: lista })
})

/** Pagar: liquida TODO lo pendiente de ese comercial, en una sola operación. */
rutasComisiones.post('/:comercialId/pagar', soloAdmin, async (c) => {
  const admin = c.get('usuario')
  const comercialId = Number(c.req.param('comercialId')) || 0
  const cuerpo = await c.req.json().catch(() => ({}))
  if (cuerpo.comprobanteUrl && !urlDeBlobValida(String(cuerpo.comprobanteUrl))) {
    return c.json({ mensaje: 'La foto del comprobante no se subió bien. Intenta de nuevo.' }, 400)
  }
  const db = getDb()
  const r = await db.transaction(async (tx) => {
    // Un pago a la vez por comercial: nunca se paga dos veces lo mismo
    await tx.execute(sql`select pg_advisory_xact_lock(${300_000 + comercialId})`)
    const movs = await tx
      .select({ id: comisiones.id, monto: comisiones.monto, pagoId: comisiones.pagoId })
      .from(comisiones)
      .where(and(eq(comisiones.comercialId, comercialId), isNull(comisiones.pagoId)))
    const v = validarPagoComision(cuerpo, saldoPendiente(movs))
    if (!v.ok) return v
    const [pago] = await tx
      .insert(pagosComision)
      .values({
        comercialId,
        total: v.datos.total,
        metodo: v.datos.metodo,
        referencia: v.datos.referencia,
        comprobanteUrl: v.datos.comprobanteUrl,
        nota: v.datos.nota,
        porFuera: v.datos.metodo === 'por_fuera',
        pagadoPor: admin.id,
      })
      .returning({ id: pagosComision.id })
    await tx
      .update(comisiones)
      .set({ pagoId: pago.id })
      .where(and(eq(comisiones.comercialId, comercialId), isNull(comisiones.pagoId)))
    return { ok: true as const }
  })
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  const [u] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, activo: usuarios.activo })
    .from(usuarios)
    .where(eq(usuarios.id, comercialId))
  return c.json({ resumen: await resumenComisiones(db, u) }, 201)
})

/** Ajuste a mano (a favor o en contra), con su motivo. */
rutasComisiones.post('/:comercialId/ajuste', soloAdmin, async (c) => {
  const comercialId = Number(c.req.param('comercialId')) || 0
  const v = validarAjusteComision(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const db = getDb()
  const [u] = await db
    .select({ id: usuarios.id, nombre: usuarios.nombre, activo: usuarios.activo, roles: usuarios.roles })
    .from(usuarios)
    .where(eq(usuarios.id, comercialId))
  if (!u) return c.json({ mensaje: 'No encontramos a esa persona.' }, 404)
  await db.insert(comisiones).values({
    comercialId,
    tipo: 'ajuste',
    monto: v.datos.monto,
    nota: v.datos.nota,
    creadoPor: c.get('usuario').id,
  })
  return c.json({ resumen: await resumenComisiones(db, u) }, 201)
})

rutasComisiones.post('/subida', soloAdmin, (c) => permisoDeSubida(c, SOLO_IMAGENES))
