import { createHash, timingSafeEqual } from 'node:crypto'
import { count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import {
  COOKIE_SESION,
  DURACION_SESION_SEG,
  firmarSesion,
  getHashRelleno,
  hashPin,
  MAX_INTENTOS,
  MINUTOS_BLOQUEO,
  pinValido,
  verificarPin,
} from '../auth.js'
import { getDb } from '../db/index.js'
import { usuarios } from '../db/schema.js'
import { conSesion, type Variables } from '../sesion.js'

export const rutasAuth = new Hono<{ Variables: Variables }>()

const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/

/** Quita espacios y guiones para comparar el código como sea que se escriba. */
function limpiarCodigo(texto: unknown) {
  return String(texto ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/** Compara sin revelar por el tiempo de respuesta cuántas letras coinciden. */
function mismoCodigo(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

async function hayUsuarios() {
  const [fila] = await getDb().select({ total: count() }).from(usuarios)
  return (fila?.total ?? 0) > 0
}

/**
 * Primer ingreso: solo sirve mientras no exista ninguna persona.
 * Pide el código de instalación (variable CODIGO_INSTALACION en Vercel)
 * para que nadie más pueda adelantarse a crear la cuenta.
 */
rutasAuth.get('/primer-ingreso', async (c) => {
  return c.json({ necesario: !(await hayUsuarios()) })
})

rutasAuth.post('/primer-ingreso', async (c) => {
  const cuerpo = await c.req.json().catch(() => ({}))
  const esperado = limpiarCodigo(process.env.CODIGO_INSTALACION)
  if (esperado.length < 8) {
    return c.json(
      {
        mensaje:
          'Falta el código de instalación en Vercel (variable CODIGO_INSTALACION). Pídeselo a quien instaló el sistema.',
      },
      503
    )
  }

  const nombre = String(cuerpo.nombre ?? '').trim()
  const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase()
  const pin = cuerpo.pin

  if (!mismoCodigo(limpiarCodigo(cuerpo.codigo), esperado)) {
    return c.json(
      {
        mensaje:
          'El código de instalación no coincide. Cópialo de nuevo, letra por letra (los guiones no importan).',
      },
      403
    )
  }
  if (nombre.length < 2) {
    return c.json({ mensaje: 'Escribe tu nombre.' }, 400)
  }
  if (!USUARIO_VALIDO.test(usuario)) {
    return c.json(
      {
        mensaje:
          'El usuario debe tener entre 3 y 30 letras o números, sin espacios ni tildes. Ejemplo: luis',
      },
      400
    )
  }
  if (!pinValido(pin)) {
    return c.json(
      { mensaje: 'El PIN tiene de 4 a 6 números, sin letras ni espacios.' },
      400
    )
  }

  const pinHash = await hashPin(pin)
  const creado = await getDb().transaction(async (tx) => {
    // Bloquea la tabla para que dos personas no creen la cuenta a la vez.
    await tx.execute(sql`lock table ${usuarios} in exclusive mode`)
    const [fila] = await tx.select({ total: count() }).from(usuarios)
    if ((fila?.total ?? 0) > 0) return null
    const [nuevo] = await tx
      .insert(usuarios)
      .values({ nombre, usuario, pinHash, roles: ['admin'] })
      .returning()
    return nuevo
  })

  if (!creado) {
    return c.json(
      {
        mensaje:
          'El administrador ya fue creado. Entra con tu usuario y tu PIN.',
      },
      409
    )
  }

  setCookie(c, COOKIE_SESION, await firmarSesion(creado.id), {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: DURACION_SESION_SEG,
  })

  return c.json(
    {
      usuario: {
        id: creado.id,
        nombre: creado.nombre,
        usuario: creado.usuario,
        roles: creado.roles,
      },
    },
    201
  )
})

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
