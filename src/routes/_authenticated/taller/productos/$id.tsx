import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { ProductoFicha } from '@/features/taller/producto-ficha'

export const Route = createFileRoute('/_authenticated/taller/productos/$id')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'fabricacion']),
  component: RutaProducto,
})

function RutaProducto() {
  const { id } = Route.useParams()
  return <ProductoFicha id={id} />
}
