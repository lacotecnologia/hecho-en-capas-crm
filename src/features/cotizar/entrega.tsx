import { useState } from 'react'
import { horaDe, momento, nombreDelDia, type Promesa } from '@shared/promesa'
import { ChevronDown, Clock, Printer, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export function TarjetaEntrega({
  promesa,
  cargando,
  error,
  conAnticipo,
}: {
  promesa: Promesa | null
  cargando: boolean
  error: boolean
  conAnticipo: boolean
}) {
  const [verPorque, setVerPorque] = useState(false)
  if (cargando) return <Skeleton className='h-28 rounded-xl' />
  if (error) {
    return (
      <p className='rounded-xl border border-dashed p-3 text-sm text-muted-foreground'>
        No se pudo revisar el taller para calcular la entrega. Revisa el
        internet.
      </p>
    )
  }
  if (!promesa) {
    return (
      <p className='rounded-xl border border-dashed p-3 text-sm text-muted-foreground'>
        Agrega productos para ver cuándo se entrega.
      </p>
    )
  }
  if (!promesa.ok) {
    return (
      <p className='rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm'>
        {promesa.mensaje}
      </p>
    )
  }
  const ahora = promesa.desde
  return (
    <section
      aria-label='Cuándo se entrega'
      className='grid gap-2 rounded-xl border-2 border-primary/30 bg-accent/40 p-4'
    >
      <p className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
        <Truck className='size-4' /> Cuándo se entrega
      </p>
      <p className='text-sm'>
        {conAnticipo
          ? 'Si paga el anticipo ahora, '
          : 'Si el cliente confirma ahora, '}
        {promesa.regla.accion.tipo === 'listo'
          ? 'puede recogerlo'
          : 'se entrega'}
      </p>
      <p className='text-xl leading-tight font-bold first-letter:uppercase'>
        {promesa.frase}
      </p>
      {promesa.validaHasta && (
        <p className='flex items-center gap-1.5 text-sm text-marca-naranja'>
          <Clock className='size-4 shrink-0' />
          Vale si confirma antes de las {horaDe(promesa.validaHasta)} Después
          pasa al siguiente día hábil.
        </p>
      )}
      {promesa.impresoras.length > 0 && (
        <p className='flex items-start gap-1.5 text-xs text-muted-foreground'>
          <Printer className='mt-0.5 size-3.5 shrink-0' />
          <span>
            {promesa.impresoras
              .map((i) =>
                i.libreEn
                  ? `${i.nombre} libre ${nombreDelDia(i.libreEn, ahora) === 'hoy' ? `a las ${horaDe(i.libreEn)}` : momento(i.libreEn, ahora)}`
                  : `${i.nombre} libre ahora`
              )
              .join(' · ')}
          </span>
        </p>
      )}
      <button
        type='button'
        onClick={() => setVerPorque((v) => !v)}
        aria-expanded={verPorque}
        className='flex items-center gap-1 justify-self-start text-sm font-medium text-primary underline-offset-2 hover:underline'
      >
        ¿Por qué esta hora?
        <ChevronDown
          className={cn(
            'size-4 transition-transform',
            verPorque && 'rotate-180'
          )}
        />
      </button>
      {verPorque && (
        <ol className='grid list-decimal gap-1 ps-5 text-sm text-muted-foreground'>
          {promesa.pasos.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ol>
      )}
    </section>
  )
}
