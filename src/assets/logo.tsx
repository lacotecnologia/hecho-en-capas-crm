import { cn } from '@/lib/utils'

/** Ícono de las capas (sin texto). */
export function LogoIcono({ className }: { className?: string }) {
  return (
    <img
      src='/images/icono.png'
      alt=''
      aria-hidden='true'
      className={cn('size-8 object-contain', className)}
    />
  )
}

/**
 * Logo completo: ícono + "Hecho en Capas" escrito con los colores de la
 * marca. El texto es HTML (no imagen) para que se lea bien en modo oscuro.
 */
export function Logo({
  className,
  tamano = 'md',
}: {
  className?: string
  tamano?: 'md' | 'lg'
}) {
  const grande = tamano === 'lg'
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <LogoIcono className={grande ? 'size-14' : 'size-9'} />
      <span
        aria-hidden='true'
        className={cn(
          'flex flex-col leading-none font-extrabold tracking-tight',
          grande ? 'text-3xl' : 'text-lg'
        )}
        style={{ fontFamily: 'var(--font-titulos)' }}
      >
        <span className='text-foreground'>Hecho</span>
        <span>
          <span className='text-marca-ambar'>en</span>
          <span className='text-marca-verde'>Capas</span>
        </span>
      </span>
      <span className='sr-only'>Hecho en Capas</span>
    </span>
  )
}
