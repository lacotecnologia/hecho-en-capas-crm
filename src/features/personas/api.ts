import { queryOptions } from '@tanstack/react-query'
import { type Rol } from '@shared/roles'
import { api } from '@/lib/api'

export type Persona = {
  id: number
  nombre: string
  usuario: string
  roles: Rol[]
  activo: boolean
  bloqueadoHasta: string | null
  /** Cuándo terminó el recorrido de práctica (null = aún no). */
  recorridoEn: string | null
  creadoEn: string
}

/** Quien vende (y no es administrador) debe hacer el recorrido. */
export const haceRecorrido = (p: Persona) =>
  p.roles.includes('comercial') && !p.roles.includes('admin')

export function repetirRecorrido(id: number) {
  return api<{ usuario: Persona }>(`/usuarios/${id}/repetir-recorrido`, {
    method: 'POST',
  })
}

export const consultaPersonas = queryOptions({
  queryKey: ['personas'],
  queryFn: () => api<{ usuarios: Persona[] }>('/usuarios'),
  select: (datos) => datos.usuarios,
})

export function crearPersona(datos: {
  nombre: string
  usuario: string
  pin: string
  roles: Rol[]
}) {
  return api<{ usuario: Persona }>('/usuarios', { method: 'POST', body: datos })
}

export function actualizarPersona(
  id: number,
  cambios: Partial<{
    nombre: string
    roles: Rol[]
    activo: boolean
    pin: string
    desbloquear: boolean
  }>
) {
  return api<{ usuario: Persona }>(`/usuarios/${id}`, {
    method: 'PATCH',
    body: cambios,
  })
}

export function estaBloqueada(persona: Persona) {
  return (
    !!persona.bloqueadoHasta && new Date(persona.bloqueadoHasta) > new Date()
  )
}
