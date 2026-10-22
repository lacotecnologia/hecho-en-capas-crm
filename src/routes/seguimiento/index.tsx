import { createFileRoute } from '@tanstack/react-router'
import { BuscarPedido } from '@/features/seguimiento'

// Página pública: no pide sesión.
export const Route = createFileRoute('/seguimiento/')({
  component: BuscarPedido,
})
