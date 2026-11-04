import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { PantallaComisiones } from '@/features/comisiones'

export const Route = createFileRoute('/_authenticated/comisiones')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial']),
  component: PantallaComisiones,
})
