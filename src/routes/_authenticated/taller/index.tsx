import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { exigirRoles } from '@/lib/guardias'
import { Taller } from '@/features/taller'

export const Route = createFileRoute('/_authenticated/taller/')({
  validateSearch: z.object({
    pestana: z.enum(['productos', 'impresoras', 'bobinas']).optional(),
  }),
  beforeLoad: ({ context }) =>
    exigirRoles(context.queryClient, ['admin', 'comercial', 'fabricacion']),
  component: Taller,
})
