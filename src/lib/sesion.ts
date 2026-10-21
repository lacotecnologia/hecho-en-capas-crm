import { queryOptions, useQuery } from '@tanstack/react-query'
import { type Rol } from '@shared/roles'
import { api } from './api'

export type UsuarioSesion = {
  id: number
  nombre: string
  usuario: string
  roles: Rol[]
}

export const consultaSesion = queryOptions({
  queryKey: ['sesion'],
  queryFn: () => api<{ usuario: UsuarioSesion }>('/auth/yo'),
  staleTime: 5 * 60 * 1000,
  retry: false,
})

/** Persona que tiene la sesión abierta (solo dentro de las páginas privadas). */
export function useSesion() {
  const { data } = useQuery(consultaSesion)
  if (!data) throw new Error('useSesion se usó fuera de una página privada')
  return data.usuario
}

export function tieneRol(usuario: UsuarioSesion, roles: readonly Rol[]) {
  return usuario.roles.some((r) => roles.includes(r))
}
