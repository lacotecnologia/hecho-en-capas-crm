import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { FichaCliente } from '@/features/clientes/ficha'

export const Route = createFileRoute('/_authenticated/clientes/$clienteId')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial']),
  component: RutaCliente,
})

function RutaCliente() {
  const { clienteId } = Route.useParams()
  return <FichaCliente key={clienteId} id={Number(clienteId) || 0} />
}
