import bcrypt from 'bcryptjs'
import { jwtVerify, SignJWT } from 'jose'

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
