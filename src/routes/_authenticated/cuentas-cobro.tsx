import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { PantallaCuentasCobro } from '@/features/cuentas-cobro'

export const Route = createFileRoute('/_authenticated/cuentas-cobro')({
  beforeLoad: ({ context }) => exigirRoles(context.queryClient, ['admin']),
  component: PantallaCuentasCobro,
})
