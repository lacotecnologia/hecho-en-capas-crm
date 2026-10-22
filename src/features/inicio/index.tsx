import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type Pendiente } from '@shared/inicio'
import { ArrowRight, CalendarCheck, PartyPopper } from 'lucide-react'
import { api } from '@/lib/api'
import { useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
      <Pendientes />

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

/** Lo que le toca hoy a esta persona, según sus roles. */
function Pendientes() {
  const { data, isLoading } = useQuery({
    queryKey: ['inicio'],
    queryFn: () => api<{ pendientes: Pendiente[] }>('/inicio'),
    select: (d) => d.pendientes,
    refetchInterval: 120_000,
  })
  return (
    <Card className='mb-6 bg-accent/60'>
      <CardContent className='flex items-start gap-4'>
        <div className='flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground'>
          <CalendarCheck className='size-5' />
        </div>
        <div className='grid min-w-0 flex-1 gap-2'>
          <h2 className='font-semibold'>Tus pendientes de hoy</h2>
          {isLoading && <Skeleton className='h-16 rounded-lg' />}
          {data && data.length === 0 && (
            <p className='flex items-center gap-2 text-muted-foreground'>
              <PartyPopper className='size-4' /> No tienes nada pendiente. ¡Todo
              al día!
            </p>
          )}
          {data && data.length > 0 && (
            <ul className='grid gap-1.5'>
              {data.map((p) => (
                <li key={p.texto}>
                  <Link
                    to={p.url}
                    className='group flex items-center gap-3 rounded-lg bg-background/70 px-3 py-2 transition-colors hover:bg-background'
                  >
                    <span
                      className={cn(
                        'flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-bold tabular-nums',
                        p.tono === 'urgente'
                          ? 'bg-marca-naranja text-white'
                          : 'bg-primary/15 text-primary'
                      )}
                    >
                      {p.cantidad}
                    </span>
                    <span className='flex-1'>{p.texto}</span>
                    <ArrowRight className='size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
