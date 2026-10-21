import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import {
  COOKIE_SESION,
  DURACION_SESION_SEG,
  firmarSesion,
  getHashRelleno,
  MAX_INTENTOS,
  MINUTOS_BLOQUEO,
  verificarPin,
} from '../auth.js'
import { getDb } from '../db/index.js'
import { usuarios } from '../db/schema.js'
import { conSesion, type Variables } from '../sesion.js'

export const rutasAuth = new Hono<{ Variables: Variables }>()

const MENSAJE_INCORRECTO = 'El usuario o el PIN no coinciden. Revisa e intenta de nuevo.'

rutasAuth.post('/ingresar', async (c) => {
  const cuerpo = await c.req.json().catch(() => ({}))
  const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase()
  const pin = String(cuerpo.pin ?? '')

  if (!usuario || !pin) {
    return c.json({ mensaje: 'Escribe tu usuario y tu PIN.' }, 400)
  }

  const db = getDb()
  const [persona] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.usuario, usuario))
    .limit(1)

  // Si la persona no existe se compara contra un hash de relleno,
  // para que la respuesta tarde lo mismo y no revele qué usuarios existen.
  if (!persona || !persona.activo) {
    await verificarPin(pin, await getHashRelleno())
    return c.json({ mensaje: MENSAJE_INCORRECTO }, 401)
  }

  const ahora = new Date()
  if (persona.bloqueadoHasta && persona.bloqueadoHasta > ahora) {
    const minutos = Math.ceil(
      (persona.bloqueadoHasta.getTime() - ahora.getTime()) / 60_000
    )
    return c.json(
      {
        mensaje: `Por seguridad tu usuario quedó bloqueado. Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} o pide al administrador que lo desbloquee.`,
      },
      423
    )
  }

  const correcto = await verificarPin(pin, persona.pinHash)

  if (!correcto) {
    const intentos = persona.intentosFallidos + 1
    const bloquear = intentos >= MAX_INTENTOS
    await db
      .update(usuarios)
      .set({
        intentosFallidos: bloquear ? 0 : intentos,
        bloqueadoHasta: bloquear
          ? new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000)
          : persona.bloqueadoHasta,
      })
      .where(eq(usuarios.id, persona.id))

    if (bloquear) {
      return c.json(
        {
          mensaje: `Fallaste el PIN ${MAX_INTENTOS} veces. Por seguridad tu usuario queda bloqueado ${MINUTOS_BLOQUEO} minutos.`,
        },
        423
      )
    }
    const quedan = MAX_INTENTOS - intentos
    return c.json(
      {
        mensaje: `${MENSAJE_INCORRECTO} Te ${quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`}.`,
      },
      401
    )
  }

  await db
    .update(usuarios)
    .set({ intentosFallidos: 0, bloqueadoHasta: null })
    .where(eq(usuarios.id, persona.id))

  setCookie(c, COOKIE_SESION, await firmarSesion(persona.id), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: DURACION_SESION_SEG,
  })

  return c.json({
    usuario: {
      id: persona.id,
      nombre: persona.nombre,
      usuario: persona.usuario,
      roles: persona.roles,
    },
  })
})

rutasAuth.post('/salir', (c) => {
  deleteCookie(c, COOKIE_SESION, { path: '/' })
  return c.json({ ok: true })
})

rutasAuth.get('/yo', conSesion, (c) => c.json({ usuario: c.get('usuario') }))
