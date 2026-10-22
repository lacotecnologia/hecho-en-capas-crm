import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { PantallaCotizacion } from '@/features/cotizar/ver'

export const Route = createFileRoute('/_authenticated/cotizar/$id')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'fabricacion']),
  component: RutaCotizacion,
})

function RutaCotizacion() {
  const { id } = Route.useParams()
  return <PantallaCotizacion key={id} id={id} />
}
