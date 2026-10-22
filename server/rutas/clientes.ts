import { asc, eq, ilike, or } from 'drizzle-orm'
import { Hono } from 'hono'
import { validarCliente } from '../../shared/cotizacion.js'
import { getDb } from '../db/index.js'
import { clientes } from '../db/schema.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'

export const rutasClientes = new Hono<{ Variables: Variables }>()

rutasClientes.use('*', conSesion, soloRoles('admin', 'comercial'))

const columnas = {
  id: clientes.id,
  nombre: clientes.nombre,
  whatsapp: clientes.whatsapp,
  email: clientes.email,
  ciudad: clientes.ciudad,
  direccion: clientes.direccion,
  documento: clientes.documento,
}

rutasClientes.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim()
  const db = getDb()
  const filtro = q
    ? or(
        ilike(clientes.nombre, `%${q}%`),
        ilike(clientes.whatsapp, `%${q}%`),
        ilike(clientes.documento, `%${q}%`)
      )
    : undefined
  const lista = await db
    .select(columnas)
    .from(clientes)
    .where(filtro)
    .orderBy(asc(clientes.nombre))
    .limit(50)
  return c.json({ clientes: lista })
})

rutasClientes.post('/', async (c) => {
  const v = validarCliente(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const [nuevo] = await getDb()
    .insert(clientes)
    .values({ ...v.datos, creadoPor: c.get('usuario').id })
    .returning(columnas)
  return c.json({ cliente: nuevo }, 201)
})

rutasClientes.patch('/:id', async (c) => {
  const v = validarCliente(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const [act] = await getDb()
    .update(clientes)
    .set({ ...v.datos, actualizadoEn: new Date() })
    .where(eq(clientes.id, Number(c.req.param('id')) || 0))
    .returning(columnas)
  if (!act) return c.json({ mensaje: 'No encontramos ese cliente.' }, 404)
  return c.json({ cliente: act })
})
