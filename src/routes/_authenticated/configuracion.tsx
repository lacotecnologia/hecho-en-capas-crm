import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { Configuracion } from '@/features/configuracion'

export const Route = createFileRoute('/_authenticated/configuracion')({
  beforeLoad: ({ context }) => exigirRoles(context.queryClient, ['admin']),
  component: Configuracion,
})
