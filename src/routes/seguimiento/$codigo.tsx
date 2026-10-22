import { createFileRoute } from '@tanstack/react-router'
import { SeguimientoPedido } from '@/features/seguimiento'

// Página pública: el cliente ve su pedido con el código, sin login.
export const Route = createFileRoute('/seguimiento/$codigo')({
  component: RutaSeguimiento,
})

function RutaSeguimiento() {
  const { codigo } = Route.useParams()
  return <SeguimientoPedido key={codigo} codigo={codigo} />
}
