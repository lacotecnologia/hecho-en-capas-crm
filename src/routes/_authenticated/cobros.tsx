import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { EnConstruccion } from '@/components/en-construccion'
import { Pagina } from '@/components/layout/pagina'

export const Route = createFileRoute('/_authenticated/cobros')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial']),
  component: () => (
    <Pagina
      titulo='Cobros'
      descripcion='Anticipos, abonos y saldos por cobrar.'
    >
      <EnConstruccion
        fase={5}
        podras={[
          'Registrar pagos con su comprobante (Nequi, Daviplata, transferencia, efectivo)',
          'Ver cuánto debe cada cliente',
          'Ver las ventas del mes y la ganancia de cada comercial',
        ]}
      />
    </Pagina>
  ),
})
