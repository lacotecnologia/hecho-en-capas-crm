import { eq } from 'drizzle-orm'
import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { type Rol } from '../shared/roles.js'
import { COOKIE_SESION, leerSesion } from './auth.js'
import { getDb } from './db/index.js'
import { usuarios } from './db/schema.js'

export type UsuarioSesion = {
  id: number
  nombre: string
  usuario: string
  roles: Rol[]
}

export type Variables = { usuario: UsuarioSesion }

/** Exige una sesión válida y carga a la persona desde la base de datos. */
export const conSesion = createMiddleware<{ Variables: Variables }>(
  async (c, next) => {
    const id = await leerSesion(getCookie(c, COOKIE_SESION))
    if (!id) {
      return c.json({ mensaje: 'Tu sesión terminó. Ingresa de nuevo.' }, 401)
    }
    const [fila] = await getDb()
      .select({
        id: usuarios.id,
        nombre: usuarios.nombre,
        usuario: usuarios.usuario,
        roles: usuarios.roles,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(eq(usuarios.id, id))
      .limit(1)

    if (!fila || !fila.activo) {
      return c.json({ mensaje: 'Tu sesión terminó. Ingresa de nuevo.' }, 401)
    }
    c.set('usuario', {
      id: fila.id,
      nombre: fila.nombre,
      usuario: fila.usuario,
      roles: fila.roles as Rol[],
    })
    await next()
  }
)

/** Permite pasar solo si la persona tiene alguno de los roles indicados. */
export function soloRoles(...permitidos: Rol[]) {
  return createMiddleware<{ Variables: Variables }>(async (c, next) => {
    const { roles } = c.get('usuario')
    if (!roles.some((r) => permitidos.includes(r))) {
      return c.json(
        { mensaje: 'No tienes permiso para hacer esto. Pídeselo al administrador.' },
        403
      )
    }
    await next()
  })
}
