import { createFileRoute } from '@tanstack/react-router'
import { exigirSesion } from '@/lib/guardias'
import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) =>
    exigirSesion(context.queryClient, location.href),
  component: AuthenticatedLayout,
})
