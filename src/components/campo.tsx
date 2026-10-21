import { type ReactNode, useId } from 'react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type CampoProps = {
  etiqueta: string
  ayuda?: ReactNode
  error?: string
  className?: string
  children: (id: string, describedBy: string) => ReactNode
}

/** Etiqueta + control + línea de ayuda + error, siempre en el mismo orden. */
export function Campo({
  etiqueta,
  ayuda,
  error,
  className,
  children,
}: CampoProps) {
  const id = useId()
  const ayudaId = `${id}-ayuda`
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children(id, ayudaId)}
      {ayuda && (
        <p id={ayudaId} className='text-sm text-muted-foreground'>
          {ayuda}
        </p>
      )}
      {error && (
        <p className='text-sm font-medium text-destructive' role='alert'>
          {error}
        </p>
      )}
    </div>
  )
}

type CampoNumeroProps = {
  etiqueta: string
  ayuda?: ReactNode
  error?: string
  unidad?: string
  valor: string
  onChange: (valor: string) => void
  decimales?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

/** Campo numérico con la unidad a la derecha y teclado numérico en celular. */
export function CampoNumero({
  etiqueta,
  ayuda,
  error,
  unidad,
  valor,
  onChange,
  decimales = false,
  placeholder,
  className,
  disabled,
}: CampoNumeroProps) {
  return (
    <Campo
      etiqueta={etiqueta}
      ayuda={ayuda}
      error={error}
      className={className}
    >
      {(id, ayudaId) => (
        <div className='relative'>
          <Input
            id={id}
            inputMode={decimales ? 'decimal' : 'numeric'}
            value={valor}
            placeholder={placeholder}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={ayuda ? ayudaId : undefined}
            onChange={(e) =>
              onChange(
                decimales
                  ? e.target.value.replace(/[^\d.,]/g, '')
                  : e.target.value.replace(/[^\d-]/g, '')
              )
            }
            className={cn('text-base tabular-nums', unidad && 'pe-16')}
          />
          {unidad && (
            <span className='pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
              {unidad}
            </span>
          )}
        </div>
      )}
    </Campo>
  )
}
