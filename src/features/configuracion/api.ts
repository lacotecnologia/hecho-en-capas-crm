import { queryOptions } from '@tanstack/react-query'
import { type ValoresConfig } from '@shared/configuracion'
import { api } from '@/lib/api'

export const consultaConfiguracion = queryOptions({
  queryKey: ['configuracion'],
  queryFn: () => api<{ valores: ValoresConfig }>('/configuracion'),
  select: (d) => d.valores,
})
