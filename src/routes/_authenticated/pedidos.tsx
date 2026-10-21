import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { EnConstruccion } from '@/components/en-construccion'
import { Pagina } from '@/components/layout/pagina'

export const Route = createFileRoute('/_authenticated/pedidos')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'fabricacion']),
  component: () => (
    <Pagina titulo='Pedidos' descripcion='Mira en qué va cada pedido.'>
      <EnConstruccion
        fase={4}
        podras={[
          'Ver todos los pedidos y en qué paso está cada uno',
          'Saber qué falta y quién lo tiene que hacer',
          'Copiar el enlace de seguimiento para enviarlo al cliente por WhatsApp',
        ]}
      />
    </Pagina>
  ),
})
