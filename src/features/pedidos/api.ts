import { queryOptions } from '@tanstack/react-query'
import {
  type OrdenCola,
  type PedidoDetalle,
  type PedidoResumen,
} from '@shared/pedidos'
import { type Impresora } from '@shared/taller'
import { api } from '@/lib/api'

export const consultaPedidos = queryOptions({
  queryKey: ['pedidos'],
  queryFn: () => api<{ pedidos: PedidoResumen[] }>('/pedidos'),
  select: (d) => d.pedidos,
})

export const consultaPedido = (id: number) =>
  queryOptions({
    queryKey: ['pedido', id],
    queryFn: () => api<{ pedido: PedidoDetalle }>(`/pedidos/${id}`),
    select: (d) => d.pedido,
  })

type RespuestaPedido = { pedido: PedidoDetalle }

export const convertirCotizacion = (cotizacionId: number) =>
  api<RespuestaPedido>('/pedidos', { method: 'POST', body: { cotizacionId } })

export const registrarPago = (
  id: number,
  datos: {
    monto: number
    metodo: string
    referencia: string
    comprobanteUrl?: string | null
  }
) =>
  api<RespuestaPedido>(`/pedidos/${id}/pagos`, { method: 'POST', body: datos })

export const devolverPlata = (
  id: number,
  datos: { monto: number; metodo: string; motivo: string }
) =>
  api<RespuestaPedido>(`/pedidos/${id}/reembolso`, {
    method: 'POST',
    body: datos,
  })

export const guardarFactura = (id: number, numeroFactura: string) =>
  api<RespuestaPedido>(`/pedidos/${id}/factura`, {
    method: 'PATCH',
    body: { numeroFactura },
  })

export const producirSinAnticipo = (id: number) =>
  api<RespuestaPedido>(`/pedidos/${id}/producir-sin-anticipo`, {
    method: 'POST',
  })

export const cancelarPedido = (id: number, motivo: string) =>
  api<RespuestaPedido>(`/pedidos/${id}/cancelar`, {
    method: 'POST',
    body: { motivo },
  })

export const agregarNota = (
  id: number,
  nota: string,
  visibleCliente: boolean
) =>
  api<RespuestaPedido>(`/pedidos/${id}/notas`, {
    method: 'POST',
    body: { nota, visibleCliente },
  })

// ---- Cola de impresión ----

export type ImpresoraCola = Pick<
  Impresora,
  'id' | 'nombre' | 'multicolor' | 'activa'
>

export const consultaCola = queryOptions({
  queryKey: ['cola'],
  queryFn: () =>
    api<{ ordenes: OrdenCola[]; impresoras: ImpresoraCola[] }>('/cola'),
  // La pantalla se mantiene al día sola
  refetchInterval: 30_000,
})

type RespuestaOrden = { orden: OrdenCola }

export const accionOrden = (
  id: number,
  accion: 'empezar' | 'terminar' | 'fallo' | 'listo' | 'devolver',
  body?: unknown
) => api<RespuestaOrden>(`/cola/${id}/${accion}`, { method: 'POST', body })

export const ordenParaStock = (productoId: number, cantidad: number) =>
  api<RespuestaOrden>('/cola/stock', {
    method: 'POST',
    body: { productoId, cantidad },
  })

export const quitarOrden = (id: number) =>
  api<{ ok: true }>(`/cola/${id}`, { method: 'DELETE' })
