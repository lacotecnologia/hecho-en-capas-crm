import {
  type EstadoOrden,
  ESTADOS_ORDEN_INFO,
  ESTADOS_PEDIDO_INFO,
  type EstadoPedido,
} from '@shared/pedidos'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const COLOR_PEDIDO: Record<EstadoPedido, string> = {
  confirmado: 'bg-marca-ambar/30 text-foreground',
  en_produccion: 'bg-marca-lima/35 text-foreground',
  listo: 'bg-primary text-primary-foreground',
  en_entrega: 'bg-marca-naranja/30 text-foreground',
  entregado: 'bg-primary/15 text-primary',
  cerrado: 'bg-muted text-muted-foreground',
  cancelado: 'bg-destructive/15 text-destructive',
}

const COLOR_ORDEN: Record<EstadoOrden, string> = {
  espera_anticipo: 'bg-marca-ambar/30 text-foreground',
  en_cola: 'bg-muted text-foreground',
  imprimiendo: 'bg-marca-lima/35 text-foreground',
  postproceso: 'bg-marca-amarillo/40 text-foreground',
  listo: 'bg-primary text-primary-foreground',
  cancelada: 'bg-destructive/15 text-destructive',
}

export function EstadoPedidoBadge({
  estado,
  className,
}: {
  estado: EstadoPedido
  className?: string
}) {
  return (
    <Badge className={cn(COLOR_PEDIDO[estado], className)}>
      {ESTADOS_PEDIDO_INFO[estado].nombre}
    </Badge>
  )
}

export function EstadoOrdenBadge({ estado }: { estado: EstadoOrden }) {
  return (
    <Badge className={COLOR_ORDEN[estado]}>
      {ESTADOS_ORDEN_INFO[estado].nombre}
    </Badge>
  )
}
