import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { ListaPedidos } from '@/features/pedidos/lista'

export const Route = createFileRoute('/_authenticated/pedidos/')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, [
      'admin',
      'comercial',
      'fabricacion',
      'entregas',
    ]),
  component: ListaPedidos,
})
