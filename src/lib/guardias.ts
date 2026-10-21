import { type QueryClient } from '@tanstack/react-query'
import { redirect } from '@tanstack/react-router'
import { type Rol } from '@shared/roles'
import { ApiError } from './api'
import { consultaSesion, tieneRol } from './sesion'

/** Exige sesión abierta; si no hay, lleva a /ingresar y luego regresa aquí. */
export async function exigirSesion(queryClient: QueryClient, href: string) {
  try {
    const { usuario } = await queryClient.ensureQueryData(consultaSesion)
    return usuario
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      throw redirect({ to: '/ingresar', search: { redirect: href } })
    }
    throw error
  }
}

/** Exige que la persona tenga alguno de los roles; si no, muestra el aviso 403. */
export async function exigirRoles(
  queryClient: QueryClient,
  roles: readonly Rol[]
) {
  const { usuario } = await queryClient.ensureQueryData(consultaSesion)
  if (!tieneRol(usuario, roles)) {
    throw redirect({ to: '/403' })
  }
  return usuario
}
