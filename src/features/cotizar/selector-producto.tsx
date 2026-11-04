import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type ProductoResumen } from '@shared/taller'
import { Box, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PuntoColor } from '@/components/color'
import { consultaProductos } from '@/features/taller/api'
import { formatoPesos } from '@/features/taller/formato'

type Props = {
  abierto: boolean
  onCerrar: () => void
  onElegir: (p: ProductoResumen) => void
  yaAgregados: number[]
}

/** Catálogo para elegir productos: solo los listos para vender. */
export function SelectorProducto({
  abierto,
  onCerrar,
  onElegir,
  yaAgregados,
}: Props) {
  const { data: productos, isLoading } = useQuery({
    ...consultaProductos,
    enabled: abierto,
  })
  const [busqueda, setBusqueda] = useState('')

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (productos ?? [])
      .filter((p) => p.estado === 'activo')
      .filter(
        (p) =>
          !q ||
          [p.nombre, p.sku, p.categoria].some((t) =>
            t.toLowerCase().includes(q)
          )
      )
  }, [productos, busqueda])

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='max-h-[90svh] overflow-hidden sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>Agregar producto</DialogTitle>
          <DialogDescription>
            Solo aparecen los productos que el taller ya dejó listos para
            vender.
          </DialogDescription>
        </DialogHeader>
        <div className='relative'>
          <Search className='pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder='Buscar por nombre, código o categoría'
            aria-label='Buscar productos'
            className='ps-9'
            autoFocus
          />
        </div>
        <div className='-mx-1 grid max-h-[55svh] gap-3 overflow-y-auto px-1 pb-1 sm:grid-cols-2'>
          {isLoading &&
            [0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className='h-24 rounded-xl' />
            ))}
          {!isLoading && visibles.length === 0 && (
            <p className='py-6 text-center text-muted-foreground sm:col-span-2'>
              No hay productos listos con esa búsqueda.
            </p>
          )}
          {visibles.map((p) => {
            const agregado = yaAgregados.includes(p.id)
            return (
              <button
                key={p.id}
                type='button'
                onClick={() => onElegir(p)}
                className='flex items-center gap-3 rounded-xl border p-2.5 text-start transition-colors hover:border-primary hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
              >
                <div className='size-16 shrink-0 overflow-hidden rounded-lg bg-muted'>
                  {p.portada ? (
                    <img
                      src={p.portada}
                      alt=''
                      className='size-full object-contain p-1'
                    />
                  ) : (
                    <Box className='m-auto mt-5 size-6 text-muted-foreground' />
                  )}
                </div>
                <div className='grid min-w-0 flex-1 gap-0.5'>
                  <p className='leading-snug font-medium'>{p.nombre}</p>
                  <p className='flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground'>
                    {p.sku}
                    <span
                      className={cn(
                        'rounded px-1.5 py-px font-medium',
                        p.stock > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-marca-ambar/20 text-foreground'
                      )}
                    >
                      {p.stock > 0 ? `Hay ${p.stock} listos` : 'Se fabrica'}
                    </span>
                  </p>
                  {p.escogeColor && (
                    <p className='flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground'>
                      {p.colores.map((c) => (
                        <span
                          key={c.bobinaId}
                          className='inline-flex items-center gap-1'
                        >
                          <PuntoColor hex={c.colorHex} className='size-3' />
                          {c.color} {c.stock}
                        </span>
                      ))}
                    </p>
                  )}
                  <p className='text-xs text-muted-foreground'>
                    {tiempoImpresion(p.tiempos.horasPorUnidad)} por unidad
                    {p.tiempos.unidadesPorCama > 1 &&
                      ` · ${p.tiempos.unidadesPorCama} por cama`}
                    {p.multicolor && ' · solo en impresora multicolor'}
                    {p.personalizacion.activa && ' · acepta nombre'}
                  </p>
                  <p className='text-sm font-semibold tabular-nums'>
                    {formatoPesos(p.precioFabrica)}
                    <span className='ms-1 text-xs font-normal text-muted-foreground'>
                      fábrica
                    </span>
                  </p>
                </div>
                {agregado ? (
                  <Badge variant='secondary'>
                    <Check /> Ya está
                  </Badge>
                ) : (
                  p.tipo === 'personalizado' && (
                    <Badge variant='outline'>Personalizado</Badge>
                  )
                )}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** 0.8 → "48 min"; 1.5 → "1 h 30 min" */
function tiempoImpresion(horas: number) {
  const min = Math.round(horas * 60)
  if (min === 0) return 'Sin tiempo de impresión'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}
