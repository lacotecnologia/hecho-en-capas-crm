import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { esRol, type Rol } from '../../shared/roles.js'
import { hashPin, pinValido } from '../auth.js'
import { getDb } from '../db/index.js'
import { usuarios } from '../db/schema.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'

export const rutasUsuarios = new Hono<{ Variables: Variables }>()

rutasUsuarios.use('*', conSesion, soloRoles('admin'))

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/

const columnasPublicas = {
  id: usuarios.id,
  nombre: usuarios.nombre,
  usuario: usuarios.usuario,
  roles: usuarios.roles,
  activo: usuarios.activo,
  bloqueadoHasta: usuarios.bloqueadoHasta,
  creadoEn: usuarios.creadoEn,
}

function limpiarRoles(valor: unknown): Rol[] | null {
  if (!Array.isArray(valor)) return null
  const roles = [...new Set(valor)].filter(esRol)
  return roles.length > 0 ? roles : null
}

rutasUsuarios.get('/', async (c) => {
  const lista = await getDb()
    .select(columnasPublicas)
    .from(usuarios)
    .orderBy(asc(usuarios.nombre))
  return c.json({ usuarios: lista })
})

rutasUsuarios.post('/', async (c) => {
  const cuerpo = await c.req.json().catch(() => ({}))
  const nombre = String(cuerpo.nombre ?? '').trim()
  const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase()
  const roles = limpiarRoles(cuerpo.roles)

  if (nombre.length < 2) {
    return c.json({ mensaje: 'Escribe el nombre de la persona.' }, 400)
  }
  if (!USUARIO_VALIDO.test(usuario)) {
    return c.json(
      {
        mensaje:
          'El usuario debe tener entre 3 y 30 letras o números, sin espacios ni tildes. Ejemplo: luis o ana.m',
      },
      400
    )
  }
  if (!pinValido(cuerpo.pin)) {
    return c.json({ mensaje: 'El PIN debe tener de 4 a 6 números.' }, 400)
  }
  if (!roles) {
    return c.json({ mensaje: 'Elige al menos un rol para esta persona.' }, 400)
  }

  const db = getDb()
  const [existe] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.usuario, usuario))
    .limit(1)
  if (existe) {
    return c.json(
      { mensaje: `Ya hay alguien con el usuario "${usuario}". Elige otro.` },
      409
    )
  }

  const [creado] = await db
    .insert(usuarios)
    .values({ nombre, usuario, roles, pinHash: await hashPin(cuerpo.pin) })
    .returning(columnasPublicas)

  return c.json({ usuario: creado }, 201)
})

rutasUsuarios.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const yo = c.get('usuario')
  const cuerpo = await c.req.json().catch(() => ({}))
  const cambios: Partial<typeof usuarios.$inferInsert> = {}

  if (cuerpo.nombre !== undefined) {
    const nombre = String(cuerpo.nombre).trim()
    if (nombre.length < 2) {
      return c.json({ mensaje: 'Escribe el nombre de la persona.' }, 400)
    }
    cambios.nombre = nombre
  }

  if (cuerpo.roles !== undefined) {
    const roles = limpiarRoles(cuerpo.roles)
    if (!roles) {
      return c.json({ mensaje: 'Elige al menos un rol para esta persona.' }, 400)
    }
    if (id === yo.id && !roles.includes('admin')) {
      return c.json(
        {
          mensaje:
            'No puedes quitarte a ti mismo el rol de Administrador; te quedarías sin acceso a esta pantalla.',
        },
        400
      )
    }
    cambios.roles = roles
  }

  if (cuerpo.activo !== undefined) {
    if (id === yo.id && cuerpo.activo === false) {
      return c.json({ mensaje: 'No puedes desactivar tu propio usuario.' }, 400)
    }
    cambios.activo = Boolean(cuerpo.activo)
  }

  if (cuerpo.pin !== undefined) {
    if (!pinValido(cuerpo.pin)) {
      return c.json({ mensaje: 'El PIN debe tener de 4 a 6 números.' }, 400)
    }
    cambios.pinHash = await hashPin(cuerpo.pin)
    cambios.intentosFallidos = 0
    cambios.bloqueadoHasta = null
  }

  if (cuerpo.desbloquear === true) {
    cambios.intentosFallidos = 0
    cambios.bloqueadoHasta = null
  }

  if (Object.keys(cambios).length === 0) {
    return c.json({ mensaje: 'No hay cambios para guardar.' }, 400)
  }

  const [actualizado] = await getDb()
    .update(usuarios)
    .set({ ...cambios, actualizadoEn: new Date() })
    .where(eq(usuarios.id, id))
    .returning(columnasPublicas)

  if (!actualizado) {
    return c.json({ mensaje: 'No encontramos a esa persona.' }, 404)
  }
  return c.json({ usuario: actualizado })
})
