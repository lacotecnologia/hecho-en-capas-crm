import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { PantallaPapelera } from '@/features/papelera'

export const Route = createFileRoute('/_authenticated/papelera')({
  beforeLoad: ({ context }) => exigirRoles(context.queryClient, ['admin']),
  component: PantallaPapelera,
})
