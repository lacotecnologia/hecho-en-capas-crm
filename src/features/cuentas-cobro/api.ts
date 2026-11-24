import { queryOptions } from '@tanstack/react-query'
import {
  type CuentaCobro,
  type CuentaPublica,
  type CuentaResumen,
  type CuentasDelPedido,
  type DatosCobrador,
  type Pagador,
} from '@shared/cuenta-cobro'
import { api } from '@/lib/api'

export type RespuestaDatos = { datos: DatosCobrador; falta: string[] }

export const consultaDatosCobrador = queryOptions({
  queryKey: ['cuentas-cobro', 'datos'],
  queryFn: () => api<RespuestaDatos>('/cuentas-cobro/datos'),
})

export const guardarDatosCobrador = (datos: DatosCobrador) =>
  api<RespuestaDatos>('/cuentas-cobro/datos', { method: 'PUT', body: datos })

export const consultaCuentas = queryOptions({
  queryKey: ['cuentas-cobro', 'lista'],
  queryFn: () => api<{ cuentas: CuentaResumen[] }>('/cuentas-cobro'),
  select: (d) => d.cuentas,
})

export const consultaCuentasPedido = (pedidoId: number) =>
  queryOptions({
    queryKey: ['cuentas-cobro', 'pedido', pedidoId],
    queryFn: () => api<CuentasDelPedido>(`/cuentas-cobro/pedido/${pedidoId}`),
  })

export const consultaCuenta = (id: number) =>
  queryOptions({
    queryKey: ['cuentas-cobro', 'una', id],
    queryFn: () =>
      api<{ cuenta: CuentaCobro; whatsapp: string }>(`/cuentas-cobro/${id}`),
  })

export const hacerCuenta = (pedidoId: number, pagador: Pagador, concepto: string) =>
  api<{ cuenta: CuentaCobro }>('/cuentas-cobro', {
    method: 'POST',
    body: { pedidoId, pagador, concepto },
  })

export const marcarEnviada = (id: number) =>
  api<{ cuenta: CuentaCobro }>(`/cuentas-cobro/${id}/enviada`, { method: 'POST' })

export const anularCuenta = (id: number, motivo: string) =>
  api<{ cuenta: CuentaCobro }>(`/cuentas-cobro/${id}/anular`, {
    method: 'POST',
    body: { motivo },
  })

// ---------- Enlace del cliente ----------

export type RespuestaPublica =
  | { anulada: true; codigo: string }
  | { anulada: false; cuenta: CuentaPublica }

export const consultaCuentaPublica = (token: string) =>
  queryOptions({
    queryKey: ['cuenta-publica', token],
    queryFn: () => api<RespuestaPublica>(`/cuenta-de-cobro/${token}`),
    retry: false,
    staleTime: Infinity,
  })

export const avisarDescarga = (token: string) =>
  api<{ ok: true }>(`/cuenta-de-cobro/${token}/descarga`, { method: 'POST' })
