import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { EnConstruccion } from '@/components/en-construccion'
import { Pagina } from '@/components/layout/pagina'

export const Route = createFileRoute('/_authenticated/taller')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'fabricacion']),
  component: () => (
    <Pagina
      titulo='Taller'
      descripcion='Productos, precios de fábrica y cola de impresión.'
    >
      <EnConstruccion
        fase={2}
        podras={[
          'Subir productos con fotos y archivos 3MF',
          'Calcular el costo y elegir el margen de fábrica (40 % o 50 %)',
          'Ver qué está imprimiendo cada impresora y qué sigue en la cola',
          'Llevar el stock de productos ya impresos',
        ]}
      />
    </Pagina>
  ),
})
