import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ESTADOS_INFO,
  type EstadoProducto,
  type ProductoResumen,
} from '@shared/taller'
import { Box, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PuntosColores } from '@/components/color'
import { consultaProductos } from './api'
import { formatoPesos } from './formato'

const COLOR_ESTADO: Record<EstadoProducto, string> = {
  solicitud: 'bg-marca-amarillo/40 text-foreground',
  diseno: 'bg-marca-ambar/30 text-foreground',
  costeo: 'bg-marca-naranja/25 text-foreground',
  activo: 'bg-primary text-primary-foreground',
  inactivo: 'bg-muted text-muted-foreground',
}

export function EstadoProductoBadge({ estado }: { estado: EstadoProducto }) {
  return (
    <Badge className={COLOR_ESTADO[estado]}>
      {ESTADOS_INFO[estado].nombre}
    </Badge>
  )
}

const FILTROS = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'activo', nombre: 'Listos para vender' },
  { id: 'proceso', nombre: 'En proceso' },
  { id: 'inactivo', nombre: 'Retirados' },
] as const
type Filtro = (typeof FILTROS)[number]['id']

function pasaFiltro(p: ProductoResumen, filtro: Filtro) {
  if (filtro === 'todos') return p.estado !== 'inactivo'
  if (filtro === 'proceso')
    return ['solicitud', 'diseno', 'costeo'].includes(p.estado)
  return p.estado === filtro
}

export function ProductosLista({ puedeEditar }: { puedeEditar: boolean }) {
  const { data: productos, isLoading } = useQuery(consultaProductos)
  const [filtro, setFiltro] = useState<Filtro>(puedeEditar ? 'todos' : 'activo')
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (productos ?? []).filter(
      (p) =>
        pasaFiltro(p, filtro) &&
        (!q ||
          [p.nombre, p.sku, p.categoria].some((t) =>
            t.toLowerCase().includes(q)
          ))
    )
  }, [productos, filtro, busqueda])

  const cuenta = (f: Filtro) =>
    (productos ?? []).filter((p) => pasaFiltro(p, f)).length

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='relative w-full sm:w-72'>
          <Search className='pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder='Buscar por nombre, código o categoría'
            aria-label='Buscar productos'
            className='ps-9'
          />
        </div>
        <div
          className='flex flex-wrap gap-2'
          role='group'
          aria-label='Filtrar por estado'
        >
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type='button'
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                filtro === f.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {f.nombre}
              <span className='ms-1.5 tabular-nums opacity-70'>
                {cuenta(f.id)}
              </span>
            </button>
          ))}
        </div>
        {puedeEditar && (
          <Button asChild className='sm:ms-auto'>
            <Link to='/taller/productos/$id' params={{ id: 'nuevo' }}>
              <Plus /> Nuevo producto
            </Link>
          </Button>
        )}
      </div>

      {isLoading && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='aspect-[4/5] rounded-xl' />
          ))}
        </div>
      )}

      {!isLoading && visibles.length === 0 && (
        <Card className='border-dashed'>
          <CardContent className='grid justify-items-center gap-2 py-8 text-center'>
            <Box className='size-8 text-muted-foreground' />
            <p className='font-medium'>
              {productos?.length
                ? 'Ningún producto coincide con la búsqueda.'
                : 'Todavía no hay productos en el catálogo.'}
            </p>
            {puedeEditar && !productos?.length && (
              <p className='text-sm text-muted-foreground'>
                Usa “Nuevo producto” para agregar el primero.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {visibles.map((p) => (
          <Link
            key={p.id}
            to='/taller/productos/$id'
            params={{ id: String(p.id) }}
            className='group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring'
          >
            <Card className='h-full gap-0 overflow-hidden py-0 transition-colors group-hover:border-primary'>
              <div className='aspect-[4/3] bg-muted'>
                {p.portada ? (
                  <img
                    src={p.portada}
                    alt={p.nombre}
                    loading='lazy'
                    className='size-full object-contain p-2'
                  />
                ) : (
                  <div className='flex size-full items-center justify-center text-muted-foreground'>
                    <Box className='size-10 opacity-50' />
                  </div>
                )}
              </div>
              <CardContent className='grid gap-2 p-4'>
                <div className='flex items-start justify-between gap-2'>
                  <h3 className='leading-snug font-semibold'>{p.nombre}</h3>
                </div>
                <p className='text-xs text-muted-foreground'>
                  {p.sku}
                  {p.categoria && ` · ${p.categoria}`}
                  {p.tipo === 'personalizado' && ' · Personalizado'}
                </p>
                {p.escogeColor && <PuntosColores colores={p.colores} />}
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <span className='flex flex-wrap items-center gap-1.5'>
                    <EstadoProductoBadge estado={p.estado} />
                    {p.enTienda && <Badge variant='outline'>En tienda</Badge>}
                  </span>
                  <span className='text-sm text-muted-foreground tabular-nums'>
                    {p.stock > 0 ? `${p.stock} en stock` : 'Sin stock'}
                  </span>
                </div>
                <p className='text-lg font-semibold tabular-nums'>
                  {p.precioFabrica > 0 ? (
                    <>
                      {formatoPesos(p.precioFabrica)}
                      <span className='ms-1 text-xs font-normal text-muted-foreground'>
                        precio de fábrica
                      </span>
                    </>
                  ) : (
                    <span className='text-sm font-normal text-muted-foreground'>
                      Aún sin precio
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
