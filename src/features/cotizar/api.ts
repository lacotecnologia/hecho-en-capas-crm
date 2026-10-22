import { queryOptions } from '@tanstack/react-query'
import {
  type Cliente,
  type CotizacionDetalle,
  type CotizacionEntrada,
  type CotizacionResumen,
} from '@shared/cotizacion'
import { api } from '@/lib/api'

export const consultaCotizaciones = queryOptions({
  queryKey: ['cotizaciones'],
  queryFn: () => api<{ cotizaciones: CotizacionResumen[] }>('/cotizaciones'),
  select: (d) => d.cotizaciones,
})

export const consultaCotizacion = (id: number) =>
  queryOptions({
    queryKey: ['cotizacion', id],
    queryFn: () =>
      api<{ cotizacion: CotizacionDetalle }>(`/cotizaciones/${id}`),
    select: (d) => d.cotizacion,
  })

export const consultaClientes = (q: string) =>
  queryOptions({
    queryKey: ['clientes', q],
    queryFn: () =>
      api<{ clientes: Cliente[] }>(`/clientes?q=${encodeURIComponent(q)}`),
    select: (d) => d.clientes,
    staleTime: 30_000,
  })

export function crearCliente(datos: Omit<Cliente, 'id'>) {
  return api<{ cliente: Cliente }>('/clientes', { method: 'POST', body: datos })
}

export function guardarCotizacion(id: number | null, datos: CotizacionEntrada) {
  return api<{ cotizacion: CotizacionDetalle }>(
    id ? `/cotizaciones/${id}` : '/cotizaciones',
    { method: id ? 'PATCH' : 'POST', body: datos }
  )
}

type Accion = 'enviar' | 'aprobar' | 'rechazar' | 'nueva-version'

export function accionCotizacion(id: number, accion: Accion, body?: unknown) {
  return api<{ cotizacion: CotizacionDetalle }>(
    `/cotizaciones/${id}/${accion}`,
    {
      method: 'POST',
      body,
    }
  )
}

export function borrarCotizacion(id: number) {
  return api<{ ok: true }>(`/cotizaciones/${id}`, { method: 'DELETE' })
}

export function pedirPersonalizado(
  id: number,
  datos: { nombre: string; descripcion: string }
) {
  return api<{ productoId: number; sku: string }>(
    `/cotizaciones/${id}/solicitud`,
    {
      method: 'POST',
      body: datos,
    }
  )
}

export function agregarImagen(
  id: number,
  datos: { url: string; nombre: string }
) {
  return api<{ cotizacion: CotizacionDetalle }>(
    `/cotizaciones/${id}/imagenes`,
    {
      method: 'POST',
      body: datos,
    }
  )
}

export function quitarImagen(id: number, imagenId: number) {
  return api<{ cotizacion: CotizacionDetalle }>(
    `/cotizaciones/${id}/imagenes/${imagenId}`,
    { method: 'DELETE' }
  )
}
