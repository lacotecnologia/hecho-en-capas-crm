import bcrypt from 'bcryptjs'
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose'

export const COOKIE_SESION = 'hec_sesion'
export const DURACION_SESION_SEG = 60 * 60 * 24 * 7 // 7 días
export const MAX_INTENTOS = 5
export const MINUTOS_BLOQUEO = 15

const PIN_VALIDO = /^\d{4,6}$/

export function pinValido(pin: unknown): pin is string {
  return typeof pin === 'string' && PIN_VALIDO.test(pin)
}

export function hashPin(pin: string) {
  return bcrypt.hash(pin, 10)
}

export function verificarPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash)
}

/** Hash de relleno para que un usuario inexistente tarde lo mismo. */
let hashRelleno: Promise<string> | undefined
export function getHashRelleno() {
  hashRelleno ??= bcrypt.hash('relleno-sin-uso', 10)
  return hashRelleno
}

function secreto() {
  const valor = process.env.SESSION_SECRET
  if (!valor || valor.length < 32) {
    throw new Error(
      'Falta SESSION_SECRET (mínimo 32 caracteres). Agrégala en .env o en Vercel.'
    )
  }
  return new TextEncoder().encode(valor)
}

export async function firmarSesion(usuarioId: number) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(usuarioId))
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEG}s`)
    .sign(secreto())
}

export async function leerSesion(token: string | undefined) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secreto(), {
      algorithms: ['HS256'],
    })
    const id = Number(payload.sub)
    return Number.isInteger(id) ? id : null
  } catch {
    return null
  }
}

// ===================== Clientes de la tienda en línea =====================
// Token aparte del de los empleados: se firma con otra llave y lleva otro "público",
// así un token de cliente nunca sirve para entrar al CRM (ni al revés).

export const DURACION_SESION_CLIENTE_SEG = 60 * 60 * 24 * 30 // 30 días
const AUDIENCIA_TIENDA = 'tienda-hec'

function secretoTienda() {
  const valor = process.env.SESSION_SECRET
  if (!valor || valor.length < 32) {
    throw new Error('Falta SESSION_SECRET (mínimo 32 caracteres). Agrégala en .env o en Vercel.')
  }
  return new TextEncoder().encode(`${valor}::tienda`)
}

export async function firmarSesionCliente(clienteId: number) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(clienteId))
    .setAudience(AUDIENCIA_TIENDA)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_CLIENTE_SEG}s`)
    .sign(secretoTienda())
}

export async function leerSesionCliente(token: string | undefined) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretoTienda(), {
      algorithms: ['HS256'],
      audience: AUDIENCIA_TIENDA,
    })
    const id = Number(payload.sub)
    return Number.isInteger(id) ? id : null
  } catch {
    return null
  }
}

// ===================== Google =====================

const JWKS_GOOGLE = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export type CuentaGoogle = { sub: string; email: string; nombre: string }

/** Verifica con Google que la credencial es real, es para esta tienda y no venció. */
export async function verificarCredencialGoogle(credencial: unknown): Promise<CuentaGoogle | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId || typeof credencial !== 'string' || credencial.length > 4000) return null
  try {
    const { payload } = await jwtVerify(credencial, JWKS_GOOGLE, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    })
    if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.sub) return null
    const nombre = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : payload.email
    return { sub: payload.sub, email: payload.email.toLowerCase(), nombre: nombre.slice(0, 120) }
  } catch {
    return null
  }
}
