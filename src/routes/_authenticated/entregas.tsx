import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { PantallaEntregas } from '@/features/entregas'

export const Route = createFileRoute('/_authenticated/entregas')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'entregas']),
  component: PantallaEntregas,
})
