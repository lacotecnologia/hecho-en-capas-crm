import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { EnConstruccion } from '@/components/en-construccion'
import { Pagina } from '@/components/layout/pagina'

export const Route = createFileRoute('/_authenticated/entregas')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'entregas']),
  component: () => (
    <Pagina
      titulo='Entregas'
      descripcion='Domicilios y envíos por transportadora.'
    >
      <EnConstruccion
        fase={5}
        podras={[
          'Programar domicilios o envíos con número de guía',
          'Ver las entregas de hoy desde el celular',
          'Marcar como entregado con foto y cobrar contra entrega',
        ]}
      />
    </Pagina>
  ),
})
