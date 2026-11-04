import { queryOptions } from '@tanstack/react-query'
import {
  type PagoComisionEntrada,
  type ResumenComisiones,
} from '@shared/comisiones'
import { api } from '@/lib/api'

/** La versión de prueba no maneja comisiones (solo el sistema real). */
export const HAY_COMISIONES = import.meta.env.VITE_DEMO !== '1'

export const consultaMisComisiones = queryOptions({
  queryKey: ['comisiones', 'mias'],
  queryFn: () =>
    api<{ resumen: ResumenComisiones }>('/comisiones/mias').then(
      (r) => r.resumen
    ),
})

export const consultaComisiones = queryOptions({
  queryKey: ['comisiones', 'todas'],
  queryFn: () =>
    api<{ comerciales: ResumenComisiones[] }>('/comisiones').then(
      (r) => r.comerciales
    ),
})

export const pagarComision = (
  comercialId: number,
  datos: PagoComisionEntrada
) =>
  api<{ resumen: ResumenComisiones }>(`/comisiones/${comercialId}/pagar`, {
    method: 'POST',
    body: datos,
  })

export const ajustarComision = (
  comercialId: number,
  datos: { monto: number; nota: string }
) =>
  api<{ resumen: ResumenComisiones }>(`/comisiones/${comercialId}/ajuste`, {
    method: 'POST',
    body: datos,
  })
