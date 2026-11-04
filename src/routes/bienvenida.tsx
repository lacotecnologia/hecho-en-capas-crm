import { createFileRoute, redirect } from '@tanstack/react-router'
import { ApiError } from '@/lib/api'
import { consultaSesion } from '@/lib/sesion'
import { Bienvenida } from '@/features/recorrido/bienvenida'

export const Route = createFileRoute('/bienvenida')({
  beforeLoad: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(consultaSesion)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw redirect({ to: '/ingresar' })
      }
      throw error
    }
  },
  component: Bienvenida,
})
