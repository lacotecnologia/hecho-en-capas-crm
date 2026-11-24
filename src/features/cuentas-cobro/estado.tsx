import {
  type EstadoCuenta,
  type EstadoEnvio,
  ESTADOS_ENVIO,
} from '@shared/cuenta-cobro'
import { Check, Download, Eye, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { formatoDiaHora } from '@/features/pedidos/fechas'

const COLOR: Record<EstadoEnvio, string> = {
  por_enviar: 'bg-marca-ambar/30 text-foreground',
  enviada: 'bg-muted text-foreground',
  recibida: 'bg-marca-lima/35 text-foreground',
  aceptada: 'bg-primary text-primary-foreground',
}

export function EstadoCuentaBadge({
  estado,
  envio,
  className,
}: {
  estado: EstadoCuenta
  envio: EstadoEnvio
  className?: string
}) {
  if (estado === 'anulada') {
    return (
      <Badge className={cn('bg-destructive/15 text-destructive', className)}>
        Anulada
      </Badge>
    )
  }
  return (
    <Badge className={cn(COLOR[envio], className)}>
      {ESTADOS_ENVIO[envio].etiqueta}
    </Badge>
  )
}

/** Los tres pasos con el cliente: enviada, recibida (abrió), aceptada (descargó). */
export function PasosEnvio({
  enviadaEn,
  recibidaEn,
  aceptadaEn,
  angosto = false,
}: {
  enviadaEn: string | null
  recibidaEn: string | null
  aceptadaEn: string | null
  /** En columnas angostas va uno debajo del otro. */
  angosto?: boolean
}) {
  const pasos = [
    { icono: Send, nombre: 'Enviada', ayuda: 'Se le mandó el enlace', en: enviadaEn },
    { icono: Eye, nombre: 'Recibida', ayuda: 'Abrió el enlace', en: recibidaEn },
    { icono: Download, nombre: 'Aceptada', ayuda: 'La descargó', en: aceptadaEn },
  ]
  if (angosto) {
    return (
      <ol className='grid gap-1.5' aria-label='Camino con el cliente'>
        {pasos.map((p) => (
          <li key={p.nombre} className='flex items-center gap-2 text-sm'>
            <span
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                p.en ? 'bg-primary text-primary-foreground' : 'border border-dashed text-muted-foreground'
              )}
            >
              {p.en ? <Check className='size-3.5' /> : <p.icono className='size-3.5' />}
            </span>
            <span className={cn('font-medium', !p.en && 'text-muted-foreground')}>
              {p.nombre}
            </span>
            <span className='ms-auto text-xs text-muted-foreground'>
              {p.en ? formatoDiaHora(p.en) : p.ayuda}
            </span>
          </li>
        ))}
      </ol>
    )
  }
  return (
    <ol className='grid grid-cols-3 gap-2' aria-label='Camino con el cliente'>
      {pasos.map((p) => (
        <li
          key={p.nombre}
          className={cn(
            'grid content-start gap-0.5 rounded-lg border p-2.5 text-sm',
            p.en ? 'border-primary/40 bg-primary/5' : 'border-dashed'
          )}
        >
          <span
            className={cn(
              'flex items-center gap-1.5 font-medium',
              !p.en && 'text-muted-foreground'
            )}
          >
            {p.en ? (
              <Check className='size-4 text-primary' />
            ) : (
              <p.icono className='size-4' />
            )}
            {p.nombre}
          </span>
          <span className='text-xs text-muted-foreground'>
            {p.en ? formatoDiaHora(p.en) : p.ayuda}
          </span>
        </li>
      ))}
    </ol>
  )
}
