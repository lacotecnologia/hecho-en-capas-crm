import { Link } from '@tanstack/react-router'
import { ArrowRight, CalendarCheck } from 'lucide-react'
import { useSesion } from '@/lib/sesion'
import { Card, CardContent } from '@/components/ui/card'
import { menuPara } from '@/components/layout/data/navegacion'
import { Pagina } from '@/components/layout/pagina'

function saludo() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function Inicio() {
  const usuario = useSesion()
  const primerNombre = usuario.nombre.split(' ')[0]
  const accesos = menuPara(usuario.roles)
    .flatMap((g) => g.items)
    .filter((item) => item.url !== '/')

  return (
    <Pagina
      titulo={`${saludo()}, ${primerNombre}`}
      descripcion='¿Qué vas a hacer hoy? Elige una opción.'
    >
      <Card className='mb-6 bg-accent/60'>
        <CardContent className='flex items-start gap-4'>
          <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'>
            <CalendarCheck className='size-5' />
          </div>
          <div className='space-y-1'>
            <h2 className='font-semibold'>Tus pendientes de hoy</h2>
            <p className='text-muted-foreground'>
              Aquí verás lo que te toca hoy: cotizaciones por vencer,
              impresiones por iniciar, cobros y entregas. Se irá llenando a
              medida que estén listas las secciones.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        {accesos.map((item) => (
          <Link
            key={item.url}
            to={item.url}
            className='group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring'
          >
            <Card className='h-full transition-colors group-hover:border-primary'>
              <CardContent className='flex items-start gap-4'>
                <div className='flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary'>
                  <item.icono className='size-5' />
                </div>
                <div className='flex-1 space-y-1'>
                  <h2 className='flex items-center gap-1 text-lg font-semibold'>
                    {item.titulo}
                    <ArrowRight className='size-4 opacity-0 transition-opacity group-hover:opacity-100' />
                  </h2>
                  <p className='text-sm text-muted-foreground'>
                    {item.descripcion}
                  </p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </Pagina>
  )
}
