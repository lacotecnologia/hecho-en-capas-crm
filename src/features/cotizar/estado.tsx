import { type EstadoCotizacion, ESTADOS_COT_INFO } from '@shared/cotizacion'
import { Badge } from '@/components/ui/badge'

const COLOR: Record<EstadoCotizacion, string> = {
  borrador: 'bg-muted text-foreground',
  enviada: 'bg-marca-ambar/30 text-foreground',
  aprobada: 'bg-primary text-primary-foreground',
  rechazada: 'bg-destructive/15 text-destructive',
  vencida: 'bg-marca-naranja/25 text-foreground',
  reemplazada: 'bg-muted text-muted-foreground',
}

export function EstadoCotizacionBadge({
  estado,
}: {
  estado: EstadoCotizacion
}) {
  return (
    <Badge className={COLOR[estado]}>{ESTADOS_COT_INFO[estado].nombre}</Badge>
  )
}

/** "vence en 3 días", "vence hoy", "venció" */
export function textoVence(venceEn: string | null) {
  if (!venceEn) return null
  const dias = Math.ceil(
    (new Date(venceEn).getTime() - Date.now()) / 86_400_000
  )
  if (dias < 0) return { texto: 'venció', urgente: true }
  if (dias === 0) return { texto: 'vence hoy', urgente: true }
  if (dias === 1) return { texto: 'vence mañana', urgente: true }
  return { texto: `vence en ${dias} días`, urgente: dias <= 2 }
}

const fechaCorta = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const fechaLarga = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export const formatoFecha = (d: string | Date) => fechaCorta.format(new Date(d))
export const formatoFechaLarga = (d: string | Date) =>
  fechaLarga.format(new Date(d))
