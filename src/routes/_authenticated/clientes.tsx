import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { PantallaClientes } from '@/features/clientes'

export const Route = createFileRoute('/_authenticated/clientes')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial']),
  component: PantallaClientes,
})
