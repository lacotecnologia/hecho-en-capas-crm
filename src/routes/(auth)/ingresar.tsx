import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { consultaSesion } from '@/lib/sesion'
import { Ingresar } from '@/features/auth/ingresar'

const busqueda = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/ingresar')({
  validateSearch: busqueda,
  // Si ya hay sesión abierta, no tiene sentido volver a pedir el PIN.
  beforeLoad: async ({ context }) => {
    const sesion = await context.queryClient
      .fetchQuery(consultaSesion)
      .catch(() => null)
    if (sesion) throw redirect({ to: '/' })
  },
  component: Ingresar,
})
