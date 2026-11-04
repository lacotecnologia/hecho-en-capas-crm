/**
 * Modo práctica: el recorrido guiado del comercial pasa en un mundo de
 * ejemplo que vive solo en este navegador (el mismo motor de la versión de
 * prueba). Mientras dura, todas las llamadas a /api van a ese mundo, menos
 * la sesión (/auth), que sigue siendo la real.
 */
import { useSyncExternalStore } from 'react'

const CLAVE = 'hec-practica'

export type EstadoPractica = {
  /** De quién es la práctica (si entra otra persona, no aplica). */
  usuarioId: number
  /** Paso del recorrido en el que va. */
  paso: number
  /** true = la está repitiendo por su cuenta (puede salir cuando quiera). */
  voluntaria: boolean
}

function leerGuardada(): EstadoPractica | null {
  try {
    const t = localStorage.getItem(CLAVE)
    return t ? (JSON.parse(t) as EstadoPractica) : null
  } catch {
    return null
  }
}

let estado: EstadoPractica | null = leerGuardada()
const oyentes = new Set<() => void>()

function cambiar(nuevo: EstadoPractica | null) {
  estado = nuevo
  try {
    if (nuevo) localStorage.setItem(CLAVE, JSON.stringify(nuevo))
    else localStorage.removeItem(CLAVE)
  } catch {
    // Sin almacenamiento: la práctica vive mientras la página esté abierta
  }
  for (const o of oyentes) o()
}

export const practicaActual = () => estado

/** ¿Está practicando ahora? (para las llamadas a la API y las subidas) */
export const enPractica = () => estado !== null

/** Versión de prueba publicada o práctica: nada se guarda en el servidor. */
export const esModoPrueba = () =>
  import.meta.env.VITE_DEMO === '1' || enPractica()

export async function empezarPractica(
  usuario: { id: number; nombre: string },
  voluntaria: boolean
) {
  cambiar({ usuarioId: usuario.id, paso: 0, voluntaria })
  const { prepararPractica } = await import('@/demo/api-demo')
  prepararPractica(usuario.nombre, usuario.id)
}

export function irAPaso(paso: number) {
  if (estado) cambiar({ ...estado, paso })
}

export function terminarPractica() {
  cambiar(null)
}

export function usePractica() {
  return useSyncExternalStore(
    (cb) => {
      oyentes.add(cb)
      return () => oyentes.delete(cb)
    },
    () => estado,
    () => null
  )
}
