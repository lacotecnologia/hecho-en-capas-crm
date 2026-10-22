import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { ColaImpresion } from '@/features/cola'

export const Route = createFileRoute('/_authenticated/cola')({
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'fabricacion', 'comercial']),
  component: ColaImpresion,
})
