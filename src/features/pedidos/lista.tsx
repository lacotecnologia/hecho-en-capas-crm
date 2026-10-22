import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type EstadoPedido, type PedidoResumen } from '@shared/pedidos'
import { ClipboardList, Search } from 'lucide-react'
import { tieneRol, useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { formatoPesos } from '@/features/taller/formato'
import { consultaPedidos } from './api'
import { EstadoPedidoBadge } from './estado'
import { textoCompromiso } from './fechas'

const FILTROS: { id: string; nombre: string; estados: EstadoPedido[] }[] = [
  {
    id: 'curso',
    nombre: 'En curso',
    estados: ['confirmado', 'en_produccion', 'listo', 'en_entrega'],
  },
  { id: 'anticipo', nombre: 'Esperando anticipo', estados: ['confirmado'] },
  { id: 'produccion', nombre: 'En producción', estados: ['en_produccion'] },
  { id: 'listo', nombre: 'Listos', estados: ['listo'] },
  {
    id: 'terminados',
    nombre: 'Terminados',
    estados: ['entregado', 'cerrado', 'cancelado'],
  },
]

export function ListaPedidos() {
  const usuario = useSesion()
  const verDinero = tieneRol(usuario, ['admin', 'comercial'])
  const verComercial = tieneRol(usuario, ['admin', 'fabricacion'])
  const { data: lista, isLoading } = useQuery(consultaPedidos)
  const [filtro, setFiltro] = useState('curso')
  const [busqueda, setBusqueda] = useState('')

  const pasa = (p: PedidoResumen, f: string) =>
    FILTROS.find((x) => x.id === f)!.estados.includes(p.estado)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (lista ?? [])
      .filter(
        (p) =>
          pasa(p, filtro) &&
          (!q ||
            [p.codigo, p.seguimiento, p.cliente.nombre].some((t) =>
              t.toLowerCase().includes(q)
            ))
      )
      .sort((a, b) =>
        (a.fechaCompromiso ?? '9').localeCompare(b.fechaCompromiso ?? '9')
      )
  }, [lista, filtro, busqueda])

  return (
    <Pagina
      titulo='Pedidos'
      descripcion='Mira en qué va cada pedido. Los primeros son los que hay que entregar antes.'
    >
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <div className='relative w-full sm:w-72'>
          <Search className='pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder='Buscar por cliente o código'
            aria-label='Buscar pedidos'
            className='ps-9'
          />
        </div>
        <div className='flex flex-wrap gap-2' role='group' aria-label='Filtrar'>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type='button'
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                filtro === f.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {f.nombre}
              <span className='ms-1.5 tabular-nums opacity-70'>
                {(lista ?? []).filter((p) => pasa(p, f.id)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Skeleton className='h-60 rounded-xl' />}

      {!isLoading && visibles.length === 0 && (
        <Card className='border-dashed'>
          <CardContent className='grid justify-items-center gap-2 py-10 text-center'>
            <ClipboardList className='size-8 text-muted-foreground' />
            <p className='font-medium'>
              {lista?.length
                ? 'No hay pedidos en este grupo.'
                : 'Todavía no hay pedidos.'}
            </p>
            {!lista?.length && (
              <p className='max-w-md text-sm text-muted-foreground'>
                Un pedido nace cuando el cliente acepta una cotización: ábrela
                en Cotizar y usa “Convertir en pedido”.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {visibles.length > 0 && (
        <Card className='py-0'>
          <ul className='divide-y'>
            {visibles.map((p) => {
              const compromiso = [
                'confirmado',
                'en_produccion',
                'listo',
              ].includes(p.estado)
                ? textoCompromiso(p.fechaCompromiso)
                : null
              const falta = p.total - p.pagado
              return (
                <li key={p.id}>
                  <Link
                    to='/pedidos/$id'
                    params={{ id: String(p.id) }}
                    className='flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none md:grid md:grid-cols-[minmax(0,1fr)_9rem_18rem_8rem]'
                  >
                    <div className='min-w-48 flex-1'>
                      <p className='font-semibold'>{p.cliente.nombre}</p>
                      <p className='text-sm text-muted-foreground'>
                        {p.codigo}
                        {verComercial && ` · ${p.comercial.nombre}`}
                      </p>
                    </div>
                    <div className='grid w-36 gap-1 md:w-auto'>
                      <div className='flex justify-between text-xs text-muted-foreground'>
                        <span>Productos listos</span>
                        <span className='tabular-nums'>
                          {p.avance.listas} de {p.avance.total}
                        </span>
                      </div>
                      <div
                        className='h-1.5 overflow-hidden rounded-full bg-muted'
                        role='progressbar'
                        aria-valuenow={p.avance.listas}
                        aria-valuemax={p.avance.total}
                        aria-label='Productos listos'
                      >
                        <div
                          className='h-full rounded-full bg-primary'
                          style={{
                            width: `${p.avance.total ? (p.avance.listas / p.avance.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <EstadoPedidoBadge estado={p.estado} />
                      {compromiso && (
                        <span
                          className={cn(
                            'text-sm',
                            compromiso.tono === 'tarde'
                              ? 'font-medium text-destructive'
                              : compromiso.tono === 'pronto'
                                ? 'font-medium text-marca-naranja'
                                : 'text-muted-foreground'
                          )}
                        >
                          {compromiso.texto}
                        </span>
                      )}
                    </div>
                    {verDinero && (
                      <div className='ms-auto w-32 text-end'>
                        <p className='text-lg font-semibold tabular-nums'>
                          {formatoPesos(p.total)}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                          {p.estado === 'cancelado'
                            ? 'Cancelado'
                            : falta > 0
                              ? `Falta ${formatoPesos(falta)}`
                              : 'Pagado completo'}
                        </p>
                      </div>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </Pagina>
  )
}
