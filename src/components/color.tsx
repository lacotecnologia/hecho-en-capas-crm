import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Circulito con el color de la bobina. */
export function PuntoColor({
  hex,
  className,
}: {
  hex: string
  className?: string
}) {
  return (
    <span
      aria-hidden='true'
      className={cn(
        'inline-block size-4 shrink-0 rounded-full border border-black/20 dark:border-white/30',
        className
      )}
      style={{ backgroundColor: hex || '#999999' }}
    />
  )
}

/** "● Azul" para mostrar el color escogido en listas y tarjetas. */
export function EtiquetaColor({
  color,
  colorHex,
  className,
}: {
  color: string
  colorHex: string
  className?: string
}) {
  if (!color) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      <PuntoColor hex={colorHex} className='size-3' />
      {color}
    </span>
  )
}

export type OpcionColor = {
  bobinaId: number
  color: string
  colorHex: string
  /** Texto pequeño debajo del nombre (material, stock…). */
  detalle?: string
  deshabilitado?: boolean
}

/**
 * Botones de color grandes (fáciles de tocar en el celular).
 * Con `multiple` se marcan varios; sin él, se escoge uno.
 */
export function BotonesColor({
  opciones,
  seleccion,
  onChange,
  multiple = false,
  etiqueta,
  invalido = false,
}: {
  opciones: OpcionColor[]
  seleccion: number[]
  onChange: (ids: number[]) => void
  multiple?: boolean
  etiqueta: string
  invalido?: boolean
}) {
  return (
    <div
      role={multiple ? 'group' : 'radiogroup'}
      aria-label={etiqueta}
      aria-invalid={invalido || undefined}
      className='flex flex-wrap gap-2'
    >
      {opciones.map((o) => {
        const activo = seleccion.includes(o.bobinaId)
        return (
          <button
            key={o.bobinaId}
            type='button'
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={activo}
            disabled={o.deshabilitado}
            onClick={() =>
              onChange(
                multiple
                  ? activo
                    ? seleccion.filter((x) => x !== o.bobinaId)
                    : [...seleccion, o.bobinaId]
                  : [o.bobinaId]
              )
            }
            className={cn(
              'flex min-h-11 items-center gap-2 rounded-lg border px-3 py-1.5 text-start text-sm transition-colors disabled:opacity-50',
              activo
                ? 'border-primary bg-primary/10 ring-1 ring-primary'
                : 'hover:bg-accent',
              invalido && !activo && 'border-destructive/60'
            )}
          >
            <PuntoColor hex={o.colorHex} className='size-5' />
            <span className='grid leading-tight'>
              <span className='font-medium'>{o.color}</span>
              {o.detalle && (
                <span className='text-xs text-muted-foreground'>{o.detalle}</span>
              )}
            </span>
            {activo && <Check className='ms-1 size-4 text-primary' />}
          </button>
        )
      })}
    </div>
  )
}

/** Fila de puntos con los colores preaprobados: "● ● ● 3 colores". */
export function PuntosColores({
  colores,
}: {
  colores: { bobinaId: number; color: string; colorHex: string }[]
}) {
  if (colores.length === 0) return null
  return (
    <p
      className='flex items-center gap-1 text-xs text-muted-foreground'
      title={colores.map((c) => c.color).join(', ')}
    >
      <span className='flex -space-x-1'>
        {colores.slice(0, 6).map((c) => (
          <PuntoColor
            key={c.bobinaId}
            hex={c.colorHex}
            className='size-3.5 ring-2 ring-background'
          />
        ))}
      </span>
      <span className='ms-1'>
        {colores.length} {colores.length === 1 ? 'color' : 'colores'}
      </span>
    </p>
  )
}
