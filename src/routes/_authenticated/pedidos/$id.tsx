import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { FichaPedido } from '@/features/pedidos/ficha'

export const Route = createFileRoute('/_authenticated/pedidos/$id')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, [
      'admin',
      'comercial',
      'fabricacion',
      'entregas',
    ]),
  component: RutaPedido,
})

function RutaPedido() {
  const { id } = Route.useParams()
  return <FichaPedido key={id} id={Number(id) || 0} />
}
