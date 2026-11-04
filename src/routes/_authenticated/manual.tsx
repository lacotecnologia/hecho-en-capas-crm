import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { Manual } from '@/features/manual'

export const Route = createFileRoute('/_authenticated/manual')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial']),
  component: Manual,
})
