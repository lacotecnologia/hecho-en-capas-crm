import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { EnConstruccion } from '@/components/en-construccion'
import { Pagina } from '@/components/layout/pagina'

export const Route = createFileRoute('/_authenticated/cotizar')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial']),
  component: () => (
    <Pagina
      titulo='Cotizar'
      descripcion='Arma una cotización y descarga el PDF para el cliente.'
    >
      <EnConstruccion
        fase={3}
        podras={[
          'Elegir el cliente y los productos del catálogo',
          'Poner tu precio de venta: el sistema te muestra el precio de fábrica y el máximo permitido',
          'Sumar envío y otros cargos, y ver el total, el anticipo y la fecha de entrega',
          'Descargar el PDF con imágenes para enviarlo al cliente',
          'Convertir la cotización en pedido cuando el cliente acepte',
        ]}
      />
    </Pagina>
  ),
})
