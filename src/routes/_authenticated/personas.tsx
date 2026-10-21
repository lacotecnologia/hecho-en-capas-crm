import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { Personas } from '@/features/personas'

export const Route = createFileRoute('/_authenticated/personas')({
  beforeLoad: ({ context }) => exigirRoles(context.queryClient, ['admin']),
  component: Personas,
})
