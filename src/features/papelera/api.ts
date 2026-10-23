import { queryOptions } from '@tanstack/react-query'
import { type ElementoPapelera, type TipoPapelera } from '@shared/papelera'
import { api } from '@/lib/api'

/** La versión de prueba no tiene papelera (solo el sistema real). */
export const HAY_PAPELERA = import.meta.env.VITE_DEMO !== '1'

export const consultaPapelera = queryOptions({
  queryKey: ['papelera'],
  queryFn: () =>
    api<{ elementos: ElementoPapelera[] }>('/papelera').then(
      (r) => r.elementos
    ),
})

export const borrar = (tipo: TipoPapelera, id: number) =>
  api<{ ok: true }>(`/papelera/${tipo}/${id}/borrar`, { method: 'POST' })

export const recuperar = (tipo: TipoPapelera, id: number) =>
  api<{ ok: true }>(`/papelera/${tipo}/${id}/recuperar`, { method: 'POST' })
