import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Mail, MapPin, MessageCircle, Search, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { formatoFecha } from '@/features/cotizar/estado'
import { enlaceWhatsapp } from '@/features/entregas/entrega'
import { consultaListaClientes } from './api'

const FILTROS = [
  { id: 'prospecto', nombre: 'Prospectos' },
  { id: 'cliente', nombre: 'Clientes' },
  { id: 'todos', nombre: 'Todos' },
] as const
type Filtro = (typeof FILTROS)[number]['id']

export function PantallaClientes() {
  const [filtro, setFiltro] = useState<Filtro>('prospecto')
  const [busqueda, setBusqueda] = useState('')
  const { data: lista, isLoading } = useQuery(consultaListaClientes(filtro))
  // Los números de cada grupo salen de la lista completa.
  const { data: todos } = useQuery(consultaListaClientes('todos'))

  const cuenta = (id: Filtro) =>
    (todos ?? []).filter((c) => id === 'todos' || c.etapa === id).length

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (lista ?? []).filter(
      (c) =>
        !q ||
        c.nombre.toLowerCase().includes(q) ||
        c.whatsapp.includes(q) ||
        c.email.toLowerCase().includes(q)
    )
  }, [lista, busqueda])

  return (
    <Pagina
      titulo='Clientes'
      descripcion='Las personas que se registran en la tienda llegan aquí como prospectos. Cuando hacen un pedido pasan a ser clientes.'
    >
      <div className='mb-4 grid gap-3'>
        <div className='relative max-w-md'>
          <Search className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder='Buscar por nombre, WhatsApp o correo'
            className='ps-9'
            aria-label='Buscar cliente'
          />
        </div>
        <div className='flex flex-wrap gap-2'>
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type='button'
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                filtro === f.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {f.nombre}
              <span className='ms-1.5 tabular-nums opacity-70'>
                {cuenta(f.id)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && <Skeleton className='h-60 rounded-xl' />}

      {!isLoading && visibles.length === 0 && (
        <Card className='border-dashed'>
          <CardContent className='grid justify-items-center gap-2 py-10 text-center'>
            <UserRound className='size-8 text-muted-foreground' />
            <p className='font-medium'>
              {filtro === 'prospecto'
                ? 'Todavía no hay prospectos nuevos.'
                : 'No hay personas en este grupo.'}
            </p>
          </CardContent>
        </Card>
      )}

      {visibles.length > 0 && (
        <Card className='py-0'>
          <ul className='divide-y'>
            {visibles.map((c) => (
              <li
                key={c.id}
                className='flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3'
              >
                <div className='min-w-52 flex-1'>
                  <p className='flex flex-wrap items-center gap-2 font-semibold'>
                    {c.nombre}
                    {c.etapa === 'prospecto' && (
                      <Badge className='bg-marca-ambar/30 text-foreground'>
                        Prospecto
                      </Badge>
                    )}
                    {c.origen === 'tienda' && (
                      <Badge variant='outline'>Vino de la tienda</Badge>
                    )}
                  </p>
                  <p className='mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground'>
                    {c.email && (
                      <span className='inline-flex items-center gap-1'>
                        <Mail className='size-3.5' />
                        {c.email}
                      </span>
                    )}
                    {c.ciudad && (
                      <span className='inline-flex items-center gap-1'>
                        <MapPin className='size-3.5' />
                        {c.ciudad}
                      </span>
                    )}
                    <span>Desde {formatoFecha(c.creadoEn)}</span>
                  </p>
                </div>
                {c.whatsapp ? (
                  <a
                    href={enlaceWhatsapp(
                      c.whatsapp,
                      `Hola ${c.nombre.split(' ')[0]}, te escribimos de Hecho en Capas.`
                    )}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium text-primary hover:bg-accent'
                  >
                    <MessageCircle className='size-4' />
                    Escribir por WhatsApp
                  </a>
                ) : (
                  <span className='text-sm text-muted-foreground'>
                    Aún no dejó su WhatsApp
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Pagina>
  )
}
