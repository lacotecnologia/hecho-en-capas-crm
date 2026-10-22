import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { PantallaReportes } from '@/features/reportes'

export const Route = createFileRoute('/_authenticated/reportes')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial']),
  component: PantallaReportes,
})
