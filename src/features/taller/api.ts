import { queryOptions } from '@tanstack/react-query'
import {
  type Bobina,
  type Impresora,
  type ProductoDetalle,
  type ProductoResumen,
} from '@shared/taller'
import { api } from '@/lib/api'

export const consultaImpresoras = queryOptions({
  queryKey: ['taller', 'impresoras'],
  queryFn: () => api<{ impresoras: Impresora[] }>('/taller/impresoras'),
  select: (d) => d.impresoras,
})

export const consultaBobinas = queryOptions({
  queryKey: ['taller', 'bobinas'],
  queryFn: () => api<{ bobinas: Bobina[] }>('/taller/bobinas'),
  select: (d) => d.bobinas,
})

export const consultaProductos = queryOptions({
  queryKey: ['taller', 'productos'],
  queryFn: () => api<{ productos: ProductoResumen[] }>('/taller/productos'),
  select: (d) => d.productos,
})

export const consultaProducto = (id: number) =>
  queryOptions({
    queryKey: ['taller', 'producto', id],
    queryFn: () =>
      api<{ producto: ProductoDetalle }>(`/taller/productos/${id}`),
    select: (d) => d.producto,
  })

export function guardarImpresora(id: number | null, datos: unknown) {
  return api<{ impresora: Impresora }>(
    id ? `/taller/impresoras/${id}` : '/taller/impresoras',
    { method: id ? 'PATCH' : 'POST', body: datos }
  )
}

export function guardarBobina(id: number | null, datos: unknown) {
  return api<{ bobina: Bobina }>(
    id ? `/taller/bobinas/${id}` : '/taller/bobinas',
    {
      method: id ? 'PATCH' : 'POST',
      body: datos,
    }
  )
}

export function guardarProducto(id: number | null, datos: unknown) {
  return api<{ producto: ProductoDetalle }>(
    id ? `/taller/productos/${id}` : '/taller/productos',
    { method: id ? 'PATCH' : 'POST', body: datos }
  )
}

export function ajustarStock(
  id: number,
  cantidad: number,
  nota: string,
  bobinaId: number | null = null
) {
  return api<{ stock: number }>(`/taller/productos/${id}/stock`, {
    method: 'POST',
    body: { cantidad, nota, bobinaId },
  })
}

export function registrarArchivo(
  id: number,
  datos: { url: string; nombre: string; tipo: string; tamanoBytes: number }
) {
  return api<{ producto: ProductoDetalle }>(
    `/taller/productos/${id}/archivos`,
    {
      method: 'POST',
      body: datos,
    }
  )
}

export function marcarPortada(id: number, archivoId: number) {
  return api<{ producto: ProductoDetalle }>(
    `/taller/productos/${id}/archivos/${archivoId}/portada`,
    { method: 'PATCH' }
  )
}

export function borrarArchivo(id: number, archivoId: number) {
  return api<{ producto: ProductoDetalle }>(
    `/taller/productos/${id}/archivos/${archivoId}`,
    { method: 'DELETE' }
  )
}
