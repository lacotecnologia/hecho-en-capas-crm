/**
 * MODO DEMOSTRACIÓN (solo se incluye cuando VITE_DEMO=1).
 *
 * Imita la API real dentro del navegador, con datos de ejemplo guardados en
 * localStorage, para poder revisar las pantallas sin servidor ni base de
 * datos. Los mensajes y las reglas son los mismos del servidor.
 */
import {
  CAMPOS_CONFIG,
  valoresPorDefecto,
  type ValoresConfig,
} from '@shared/configuracion'
import { esRol, type Rol } from '@shared/roles'
import { ApiError } from '@/lib/api'

type PersonaDemo = {
  id: number
  nombre: string
  usuario: string
  pin: string
  roles: Rol[]
  activo: boolean
  intentosFallidos: number
  bloqueadoHasta: string | null
  creadoEn: string
}

type EstadoDemo = {
  personas: PersonaDemo[]
  config: ValoresConfig
  sesion: number | null
}

const CLAVE = 'hec-demo-v1'
const MAX_INTENTOS = 5
const MINUTOS_BLOQUEO = 15

function inicial(): EstadoDemo {
  const ahora = new Date().toISOString()
  const p = (
    id: number,
    nombre: string,
    usuario: string,
    pin: string,
    roles: Rol[]
  ): PersonaDemo => ({
    id,
    nombre,
    usuario,
    pin,
    roles,
    activo: true,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    creadoEn: ahora,
  })
  return {
    personas: [
      p(1, 'Luis', 'luis', '1234', ['admin']),
      p(2, 'Ana María', 'ana', '4821', ['comercial']),
      p(3, 'Carlos Gómez', 'carlos', '5678', ['fabricacion', 'entregas']),
    ],
    config: valoresPorDefecto(),
    sesion: null,
  }
}

let memoria: EstadoDemo | null = null

function leer(): EstadoDemo {
  if (memoria) return memoria
  try {
    const guardado = localStorage.getItem(CLAVE)
    memoria = guardado ? (JSON.parse(guardado) as EstadoDemo) : inicial()
  } catch {
    memoria = inicial()
  }
  return memoria
}

function guardar(estado: EstadoDemo) {
  memoria = estado
  try {
    localStorage.setItem(CLAVE, JSON.stringify(estado))
  } catch {
    // Sin almacenamiento (ventana privada): los datos viven mientras la página esté abierta.
  }
}

/** Borra los datos de ejemplo y vuelve a empezar. */
export function reiniciarDemo() {
  memoria = null
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // nada que borrar
  }
}

const publica = (p: PersonaDemo) => ({
  id: p.id,
  nombre: p.nombre,
  usuario: p.usuario,
  roles: p.roles,
  activo: p.activo,
  bloqueadoHasta: p.bloqueadoHasta,
  creadoEn: p.creadoEn,
})

const deSesion = (p: PersonaDemo) => ({
  id: p.id,
  nombre: p.nombre,
  usuario: p.usuario,
  roles: p.roles,
})

const fallo = (status: number, mensaje: string, campo?: string): never => {
  throw new ApiError(status, mensaje, campo)
}

function limpiarRoles(valor: unknown): Rol[] | null {
  if (!Array.isArray(valor)) return null
  const roles = [...new Set(valor)].filter(esRol)
  return roles.length > 0 ? roles : null
}

const PIN_VALIDO = /^\d{4,6}$/
const USUARIO_VALIDO = /^[a-z0-9._-]{3,30}$/
const SESION_TERMINADA = 'Tu sesión terminó. Ingresa de nuevo.'
const SIN_PERMISO =
  'No tienes permiso para hacer esto. Pídeselo al administrador.'

function yo(estado: EstadoDemo) {
  const persona = estado.personas.find((p) => p.id === estado.sesion)
  if (!persona || !persona.activo) fallo(401, SESION_TERMINADA)
  return persona!
}

function soloAdmin(estado: EstadoDemo) {
  const persona = yo(estado)
  if (!persona.roles.includes('admin')) fallo(403, SIN_PERMISO)
  return persona
}

type Cuerpo = Record<string, unknown>

export async function apiDemo<T>(
  ruta: string,
  metodo: string,
  cuerpo: Cuerpo = {}
): Promise<T> {
  // Pequeña espera para que la pantalla se comporte como con un servidor real.
  await new Promise((r) => setTimeout(r, 150))
  const estado = structuredClone(leer())
  const resultado = atender(estado, ruta, metodo, cuerpo)
  guardar(estado)
  return resultado as T
}

function atender(estado: EstadoDemo, ruta: string, metodo: string, c: Cuerpo) {
  // ---- Sesión ----
  if (ruta === '/auth/ingresar' && metodo === 'POST') {
    const usuario = String(c.usuario ?? '')
      .trim()
      .toLowerCase()
    const pin = String(c.pin ?? '')
    if (!usuario || !pin) fallo(400, 'Escribe tu usuario y tu PIN.')
    const incorrecto =
      'El usuario o el PIN no coinciden. Revisa e intenta de nuevo.'
    const persona = estado.personas.find((p) => p.usuario === usuario)
    if (!persona || !persona.activo) fallo(401, incorrecto)
    const p = persona!
    const ahora = Date.now()
    if (p.bloqueadoHasta && new Date(p.bloqueadoHasta).getTime() > ahora) {
      const minutos = Math.ceil(
        (new Date(p.bloqueadoHasta).getTime() - ahora) / 60_000
      )
      fallo(
        423,
        `Por seguridad tu usuario quedó bloqueado. Intenta de nuevo en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} o pide al administrador que lo desbloquee.`
      )
    }
    if (p.pin !== pin) {
      p.intentosFallidos += 1
      if (p.intentosFallidos >= MAX_INTENTOS) {
        p.intentosFallidos = 0
        p.bloqueadoHasta = new Date(
          ahora + MINUTOS_BLOQUEO * 60_000
        ).toISOString()
        guardar(estado)
        fallo(
          423,
          `Fallaste el PIN ${MAX_INTENTOS} veces. Por seguridad tu usuario queda bloqueado ${MINUTOS_BLOQUEO} minutos.`
        )
      }
      const quedan = MAX_INTENTOS - p.intentosFallidos
      guardar(estado)
      fallo(
        401,
        `${incorrecto} Te ${quedan === 1 ? 'queda 1 intento' : `quedan ${quedan} intentos`}.`
      )
    }
    p.intentosFallidos = 0
    p.bloqueadoHasta = null
    estado.sesion = p.id
    return { usuario: deSesion(p) }
  }

  if (ruta === '/auth/salir' && metodo === 'POST') {
    estado.sesion = null
    return { ok: true }
  }

  if (ruta === '/auth/yo' && metodo === 'GET') {
    return { usuario: deSesion(yo(estado)) }
  }

  // ---- Configuración ----
  if (ruta === '/configuracion' && metodo === 'GET') {
    yo(estado)
    return { valores: estado.config }
  }

  if (ruta === '/configuracion' && metodo === 'PUT') {
    soloAdmin(estado)
    const entrada = (c.valores ?? {}) as Record<string, unknown>
    let cambios = 0
    for (const campo of CAMPOS_CONFIG) {
      if (!(campo.clave in entrada)) continue
      const valor = Number(entrada[campo.clave])
      if (!Number.isFinite(valor) || valor < campo.min || valor > campo.max) {
        fallo(
          400,
          `"${campo.etiqueta}" debe estar entre ${campo.min} y ${campo.max}.`,
          campo.clave
        )
      }
      estado.config[campo.clave] = valor
      cambios++
    }
    if (cambios === 0) fallo(400, 'No hay cambios para guardar.')
    return { valores: estado.config }
  }

  // ---- Personas ----
  if (ruta === '/usuarios' && metodo === 'GET') {
    soloAdmin(estado)
    return {
      usuarios: [...estado.personas]
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map(publica),
    }
  }

  if (ruta === '/usuarios' && metodo === 'POST') {
    soloAdmin(estado)
    const nombre = String(c.nombre ?? '').trim()
    const usuario = String(c.usuario ?? '')
      .trim()
      .toLowerCase()
    const roles = limpiarRoles(c.roles)
    if (nombre.length < 2) fallo(400, 'Escribe el nombre de la persona.')
    if (!USUARIO_VALIDO.test(usuario)) {
      fallo(
        400,
        'El usuario debe tener entre 3 y 30 letras o números, sin espacios ni tildes. Ejemplo: luis o ana.m'
      )
    }
    if (!PIN_VALIDO.test(String(c.pin ?? ''))) {
      fallo(400, 'El PIN debe tener de 4 a 6 números.')
    }
    if (!roles) fallo(400, 'Elige al menos un rol para esta persona.')
    if (estado.personas.some((p) => p.usuario === usuario)) {
      fallo(409, `Ya hay alguien con el usuario "${usuario}". Elige otro.`)
    }
    const nueva: PersonaDemo = {
      id: Math.max(0, ...estado.personas.map((p) => p.id)) + 1,
      nombre,
      usuario,
      pin: String(c.pin),
      roles: roles!,
      activo: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
      creadoEn: new Date().toISOString(),
    }
    estado.personas.push(nueva)
    return { usuario: publica(nueva) }
  }

  const coincide = ruta.match(/^\/usuarios\/(\d+)$/)
  if (coincide && metodo === 'PATCH') {
    const admin = soloAdmin(estado)
    const id = Number(coincide[1])
    const persona = estado.personas.find((p) => p.id === id)
    if (!persona) fallo(404, 'No encontramos a esa persona.')
    const p = persona!
    if (c.nombre !== undefined) {
      const nombre = String(c.nombre).trim()
      if (nombre.length < 2) fallo(400, 'Escribe el nombre de la persona.')
      p.nombre = nombre
    }
    if (c.roles !== undefined) {
      const roles = limpiarRoles(c.roles)
      if (!roles) fallo(400, 'Elige al menos un rol para esta persona.')
      if (id === admin.id && !roles!.includes('admin')) {
        fallo(
          400,
          'No puedes quitarte a ti mismo el rol de Administrador; te quedarías sin acceso a esta pantalla.'
        )
      }
      p.roles = roles!
    }
    if (c.activo !== undefined) {
      if (id === admin.id && c.activo === false) {
        fallo(400, 'No puedes desactivar tu propio usuario.')
      }
      p.activo = Boolean(c.activo)
    }
    if (c.pin !== undefined) {
      if (!PIN_VALIDO.test(String(c.pin))) {
        fallo(400, 'El PIN debe tener de 4 a 6 números.')
      }
      p.pin = String(c.pin)
      p.intentosFallidos = 0
      p.bloqueadoHasta = null
    }
    if (c.desbloquear === true) {
      p.intentosFallidos = 0
      p.bloqueadoHasta = null
    }
    return { usuario: publica(p) }
  }

  return fallo(404, 'Esta dirección no existe.')
}
