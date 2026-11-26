import { queryOptions } from '@tanstack/react-query'
import { type ClienteFicha, type ClienteFila } from '@shared/clientes'
import { type Cliente } from '@shared/cotizacion'
import { api } from '@/lib/api'

export type DatosCliente = Omit<Cliente, 'id'>

export const consultaListaClientes = queryOptions({
  queryKey: ['clientes', 'lista'],
  queryFn: () => api<{ clientes: ClienteFila[] }>('/clientes/lista'),
  select: (d) => d.clientes,
})

export const consultaFichaCliente = (id: number) =>
  queryOptions({
    queryKey: ['clientes', 'ficha', id],
    queryFn: () => api<ClienteFicha>(`/clientes/${id}`),
  })

export const crearCliente = (datos: DatosCliente) =>
  api<{ cliente: Cliente }>('/clientes', { method: 'POST', body: datos })

export const editarCliente = (id: number, datos: DatosCliente) =>
  api<{ cliente: Cliente }>(`/clientes/${id}`, { method: 'PATCH', body: datos })

export const pasarCliente = (id: number, comercialId: number) =>
  api<ClienteFicha>(`/clientes/${id}/comercial`, {
    method: 'POST',
    body: { comercialId },
  })

export const borrarCliente = (id: number) =>
  api<{ ok: true }>(`/clientes/${id}/borrar`, { method: 'POST' })

export const clienteVacio = (nombre = ''): DatosCliente => ({
  nombre,
  whatsapp: '',
  email: '',
  ciudad: 'Pereira',
  direccion: '',
  documento: '',
})
