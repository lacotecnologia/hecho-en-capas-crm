import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { exigirRoles } from '@/lib/guardias'
import { PantallaCotizacion } from '@/features/cotizar/ver'

export const Route = createFileRoute('/_authenticated/cotizar/$id')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'fabricacion']),
  // ?cliente=12 al venir desde la ficha del cliente
  validateSearch: z.object({ cliente: z.coerce.number().int().positive().optional() }),
  component: RutaCotizacion,
})

function RutaCotizacion() {
  const { id } = Route.useParams()
  const { cliente } = Route.useSearch()
  return <PantallaCotizacion key={id} id={id} clienteId={cliente} />
}
