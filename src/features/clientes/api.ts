import { queryOptions } from '@tanstack/react-query'
import { type Cliente } from '@shared/cotizacion'
import { api } from '@/lib/api'

export type ClienteLista = Cliente & {
  etapa: 'prospecto' | 'cliente'
  origen: 'crm' | 'tienda'
  creadoEn: string
}

export const consultaListaClientes = (
  etapa: 'todos' | 'prospecto' | 'cliente'
) =>
  queryOptions({
    queryKey: ['clientes', 'lista', etapa],
    queryFn: () =>
      api<{ clientes: ClienteLista[] }>(
        etapa === 'todos' ? '/clientes' : `/clientes?etapa=${etapa}`
      ),
    select: (d) => d.clientes,
  })
