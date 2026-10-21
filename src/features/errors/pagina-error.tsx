import { useNavigate, useRouter } from '@tanstack/react-router'
import { LogoIcono } from '@/assets/logo'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

type PaginaErrorProps = {
  codigo?: string
  titulo: string
  explicacion: string
  minimal?: boolean
  className?: string
}

/** Pantalla de error en palabras sencillas, siempre con una salida clara. */
export function PaginaError({
  codigo,
  titulo,
  explicacion,
  minimal = false,
  className,
}: PaginaErrorProps) {
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className={cn('h-svh w-full', className)}>
      <div className='m-auto flex h-full w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center'>
        {!minimal && <LogoIcono className='size-16' />}
        {!minimal && codigo && (
          <span className='text-sm font-medium text-muted-foreground'>
            Código {codigo}
          </span>
        )}
        <h1 className='text-2xl font-bold'>{titulo}</h1>
        <p className='text-muted-foreground'>{explicacion}</p>
        {!minimal && (
          <div className='mt-4 flex flex-wrap justify-center gap-3'>
            <Button variant='outline' onClick={() => history.go(-1)}>
              Volver atrás
            </Button>
            <Button onClick={() => navigate({ to: '/' })}>Ir al inicio</Button>
          </div>
        )}
      </div>
    </div>
  )
}
