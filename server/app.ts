import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { getDb } from './db/index.js'
import { rutasAuth } from './rutas/auth.js'
import { rutasClientes } from './rutas/clientes.js'
import { rutasCobros } from './rutas/cobros.js'
import { rutasCola } from './rutas/cola.js'
import { rutasConfiguracion } from './rutas/configuracion.js'
import { rutasCotizaciones } from './rutas/cotizaciones.js'
import { rutasEntregas } from './rutas/entregas.js'
import { rutasInicio } from './rutas/inicio.js'
import { rutasPapelera } from './rutas/papelera.js'
import { rutasPedidos } from './rutas/pedidos.js'
import { rutasReportes } from './rutas/reportes.js'
import { rutasSeguimiento } from './rutas/seguimiento.js'
import { rutasTaller } from './rutas/taller.js'
import { rutasTienda } from './rutas/tienda.js'
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
app.route('/clientes', rutasClientes)
app.route('/cotizaciones', rutasCotizaciones)
app.route('/pedidos', rutasPedidos)
app.route('/cola', rutasCola)
app.route('/entregas', rutasEntregas)
app.route('/cobros', rutasCobros)
app.route('/seguimiento', rutasSeguimiento)
app.route('/reportes', rutasReportes)
app.route('/inicio', rutasInicio)
app.route('/papelera', rutasPapelera)
app.route('/tienda', rutasTienda)

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
