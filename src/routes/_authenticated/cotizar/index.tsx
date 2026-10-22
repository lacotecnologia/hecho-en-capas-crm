import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { ListaCotizaciones } from '@/features/cotizar/lista'

export const Route = createFileRoute('/_authenticated/cotizar/')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'fabricacion']),
  component: ListaCotizaciones,
})
