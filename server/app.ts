import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { getDb } from './db/index.js'
import { rutasAuth } from './rutas/auth.js'
import { rutasConfiguracion } from './rutas/configuracion.js'
import { rutasTaller } from './rutas/taller.js'
import { rutasUsuarios } from './rutas/usuarios.js'
import { type Variables } from './sesion.js'

/**
 * Toda la API vive en una sola función de Vercel (api/index.ts).
 * Las rutas se definen aquí con Hono.
 */
export const app = new Hono<{ Variables: Variables }>().basePath('/api')

app.get('/salud', async (c) => {
  try {
    await getDb().execute(sql`select 1`)
    return c.json({ ok: true, baseDeDatos: 'conectada' })
  } catch (error) {
    console.error('[salud]', error)
    return c.json({ ok: false, baseDeDatos: 'sin conexión' }, 503)
  }
})

app.route('/auth', rutasAuth)
app.route('/usuarios', rutasUsuarios)
app.route('/configuracion', rutasConfiguracion)
app.route('/taller', rutasTaller)

app.notFound((c) => c.json({ mensaje: 'Esta dirección no existe.' }, 404))

app.onError((error, c) => {
  console.error('[api]', error)
  return c.json(
    {
      mensaje:
        'Algo salió mal en el servidor. Intenta de nuevo; si sigue pasando, avisa al administrador.',
    },
    500
  )
})
