import { queryOptions } from '@tanstack/react-query'
import {
  type Entrega,
  type EntregaLista,
  type ResumenCobros,
} from '@shared/entregas'
import { api } from '@/lib/api'

export const consultaEntregas = queryOptions({
  queryKey: ['entregas'],
  queryFn: () => api<{ entregas: EntregaLista[] }>('/entregas'),
  select: (d) => d.entregas,
  refetchInterval: 60_000,
})

export const consultaMensajeros = queryOptions({
  queryKey: ['entregas', 'mensajeros'],
  queryFn: () =>
    api<{ mensajeros: { id: number; nombre: string }[] }>(
      '/entregas/mensajeros'
    ),
  select: (d) => d.mensajeros,
  staleTime: 5 * 60_000,
})

type RespuestaEntrega = { entrega: Entrega }

export const accionEntrega = (
  id: number,
  accion: 'programar' | 'salir' | 'entregada' | 'novedad',
  body: unknown
) =>
  api<RespuestaEntrega>(`/entregas/${id}/${accion}`, { method: 'POST', body })

export const consultaCobros = queryOptions({
  queryKey: ['cobros'],
  queryFn: () => api<ResumenCobros>('/cobros'),
})
