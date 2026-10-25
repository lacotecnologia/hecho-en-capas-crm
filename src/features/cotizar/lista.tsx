import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type CotizacionResumen } from '@shared/cotizacion'
import { FileText, Plus, Search } from 'lucide-react'
import { tieneRol, useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { formatoPesos } from '@/features/taller/formato'
import { consultaCotizaciones } from './api'
import { EstadoCotizacionBadge, formatoFecha, textoVence } from './estado'

const FILTROS = [
  { id: 'abiertas', nombre: 'Abiertas', estados: ['borrador', 'enviada'] },
  { id: 'borrador', nombre: 'Borradores', estados: ['borrador'] },
  { id: 'enviada', nombre: 'Esperando respuesta', estados: ['enviada'] },
  { id: 'tienda', nombre: 'De la tienda', estados: ['enviada'] },
  { id: 'aprobada', nombre: 'Aprobadas', estados: ['aprobada'] },
  {
    id: 'cerradas',
    nombre: 'Cerradas',
    estados: ['rechazada', 'vencida', 'reemplazada'],
  },
] as const
type Filtro = (typeof FILTROS)[number]['id']

export function ListaCotizaciones() {
  const usuario = useSesion()
  const puedeCrear = tieneRol(usuario, ['admin', 'comercial'])
  const verComercial = tieneRol(usuario, ['admin', 'fabricacion'])
  const { data: lista, isLoading } = useQuery(consultaCotizaciones)
  const [filtro, setFiltro] = useState<Filtro>('abiertas')
  const [busqueda, setBusqueda] = useState('')

  const pasa = (c: CotizacionResumen, f: Filtro) =>
    (FILTROS.find((x) => x.id === f)!.estados as readonly string[]).includes(
      c.estado
    ) &&
    (f !== 'tienda' || c.origen === 'tienda')

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (lista ?? []).filter(
      (c) =>
        pasa(c, filtro) &&
        (!q ||
          c.codigo.toLowerCase().includes(q) ||
          (c.cliente?.nombre ?? '').toLowerCase().includes(q))
    )
  }, [lista, filtro, busqueda])

  return (
    <Pagina
      titulo='Cotizar'
      descripcion='Arma cotizaciones, descarga el PDF y sigue la respuesta de cada cliente.'
      acciones={
        puedeCrear && (
          <Button asChild size='lg'>
            <Link to='/cotizar/$id' params={{ id: 'nueva' }}>
              <Plus /> Nueva cotización
            </Link>
          </Button>
        )
      }
    >
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <div className='relative w-full sm:w-72'>
          <Search className='pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder='Buscar por cliente o código'
            aria-label='Buscar cotizaciones'
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
                {(lista ?? []).filter((c) => pasa(c, f.id)).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Skeleton className='h-60 rounded-xl' />}

      {!isLoading && visibles.length === 0 && (
        <Card className='border-dashed'>
          <CardContent className='grid justify-items-center gap-2 py-10 text-center'>
            <FileText className='size-8 text-muted-foreground' />
            <p className='font-medium'>
              {lista?.length
                ? 'No hay cotizaciones en este grupo.'
                : 'Todavía no hay cotizaciones.'}
            </p>
            {puedeCrear && !lista?.length && (
              <p className='text-sm text-muted-foreground'>
                Usa “Nueva cotización” para hacer la primera.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {visibles.length > 0 && (
        <Card className='py-0'>
          <ul className='divide-y'>
            {visibles.map((c) => {
              const vence =
                c.estado === 'enviada' ? textoVence(c.venceEn) : null
              return (
                <li key={c.id}>
                  <Link
                    to='/cotizar/$id'
                    params={{ id: String(c.id) }}
                    className='flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:bg-accent/50 focus-visible:outline-none'
                  >
                    <div className='min-w-48 flex-1'>
                      <p className='font-semibold'>
                        {c.cliente?.nombre ?? (
                          <span className='text-muted-foreground italic'>
                            Sin cliente
                          </span>
                        )}
                      </p>
                      <p className='text-sm text-muted-foreground'>
                        {c.codigo} · {c.lineas}{' '}
                        {c.lineas === 1 ? 'producto' : 'productos'} ·{' '}
                        {formatoFecha(c.creadaEn)}
                        {verComercial && ` · ${c.comercial.nombre}`}
                      </p>
                    </div>
                    <div className='flex items-center gap-2'>
                      {c.origen === 'tienda' && (
                        <Badge variant='outline'>Tienda</Badge>
                      )}
                      <EstadoCotizacionBadge estado={c.estado} />
                      {vence && (
                        <span
                          className={cn(
                            'text-sm',
                            vence.urgente
                              ? 'font-medium text-marca-naranja'
                              : 'text-muted-foreground'
                          )}
                        >
                          {vence.texto}
                        </span>
                      )}
                    </div>
                    <p className='w-28 text-end text-lg font-semibold tabular-nums'>
                      {formatoPesos(c.total)}
                    </p>
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
