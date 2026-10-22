import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { PantallaCobros } from '@/features/cobros'

export const Route = createFileRoute('/_authenticated/cobros')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial']),
  component: PantallaCobros,
})
