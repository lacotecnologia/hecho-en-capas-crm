import { FlaskConical, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const ES_PRUEBA = import.meta.env.VITE_DEMO === '1'

const USUARIOS_PRUEBA = [
  { usuario: 'luis', pin: '1234', rol: 'Administrador' },
  { usuario: 'ana', pin: '4821', rol: 'Comercial' },
  { usuario: 'carlos', pin: '5678', rol: 'Taller y Entregas' },
]

async function reiniciar() {
  const { reiniciarDemo } = await import('./api-demo')
  reiniciarDemo()
  window.location.reload()
}

/** Tarjeta en la pantalla de ingreso con los usuarios de ejemplo. */
export function AvisoPruebaIngreso({
  onElegir,
}: {
  onElegir: (usuario: string, pin: string) => void
}) {
  if (!ES_PRUEBA) return null
  return (
    <Card className='border-dashed border-marca-ambar bg-marca-amarillo/10'>
      <CardContent className='grid gap-3'>
        <p className='flex items-center gap-2 font-semibold'>
          <FlaskConical className='size-4 text-marca-naranja' />
          Versión de prueba
        </p>
        <p className='text-sm text-muted-foreground'>
          Los datos son de ejemplo y se guardan solo en este navegador. Toca un
          usuario para llenar el formulario:
        </p>
        <div className='grid gap-2'>
          {USUARIOS_PRUEBA.map((u) => (
            <Button
              key={u.usuario}
              type='button'
              variant='outline'
              className='h-auto justify-between py-2'
              onClick={() => onElegir(u.usuario, u.pin)}
            >
              <span className='font-medium'>{u.rol}</span>
              <span className='text-muted-foreground tabular-nums'>
                {u.usuario} · PIN {u.pin}
              </span>
            </Button>
          ))}
        </div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='justify-self-start text-muted-foreground'
          onClick={reiniciar}
        >
          <RotateCcw /> Borrar cambios y empezar de nuevo
        </Button>
      </CardContent>
    </Card>
  )
}

/** Etiqueta pequeña en el encabezado de cada pantalla. */
export function EtiquetaPrueba() {
  if (!ES_PRUEBA) return null
  return (
    <span className='hidden items-center gap-1.5 rounded-full bg-marca-amarillo/30 px-3 py-1 text-xs font-medium sm:inline-flex'>
      <FlaskConical className='size-3.5' /> Versión de prueba
    </span>
  )
}
