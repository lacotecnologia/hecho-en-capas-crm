import { app } from '../server/app.js'

/**
 * Única función de Vercel. vercel.json redirige todo /api/* aquí
 * y Hono decide qué ruta atiende cada petición.
 */
export default {
  fetch(request: Request) {
    return app.fetch(request)
  },
}
