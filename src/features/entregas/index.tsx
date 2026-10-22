import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type EntregaLista } from '@shared/entregas'
import { Truck } from 'lucide-react'
import { tieneRol, useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { consultaEntregas } from './api'
import { TarjetaEntrega } from './entrega'

const finDeHoy = () => {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

const FILTROS = [
  {
    id: 'hoy',
    nombre: 'Hoy',
    vacio: 'No hay entregas para hoy.',
    pasa: (e: EntregaLista) =>
      e.estado === 'en_camino' ||
      (e.estado === 'programada' &&
        !!e.fechaProgramada &&
        new Date(e.fechaProgramada).getTime() <= finDeHoy()),
  },
  {
    id: 'programar',
    nombre: 'Por programar',
    vacio: 'Todo lo listo ya tiene su entrega programada.',
    pasa: (e: EntregaLista) => e.estado === 'por_programar',
  },
  {
    id: 'proximas',
    nombre: 'Próximas',
    vacio: 'No hay entregas programadas para los próximos días.',
    pasa: (e: EntregaLista) =>
      e.estado === 'programada' &&
      !!e.fechaProgramada &&
      new Date(e.fechaProgramada).getTime() > finDeHoy(),
  },
  {
    id: 'entregadas',
    nombre: 'Entregadas',
    vacio: 'Aún no hay entregas hechas en el último mes.',
    pasa: (e: EntregaLista) => e.estado === 'entregada',
  },
]

export function PantallaEntregas() {
  const usuario = useSesion()
  const mensajero =
    tieneRol(usuario, ['entregas']) && !tieneRol(usuario, ['admin'])
  const programa = tieneRol(usuario, ['admin', 'comercial'])
  const { data: lista, isLoading } = useQuery(consultaEntregas)
  const [filtro, setFiltro] = useState<string | null>(null)
  const [soloMias, setSoloMias] = useState(mensajero)

  const base = useMemo(
    () =>
      (lista ?? []).filter(
        (e) =>
          !soloMias ||
          e.mensajero?.id === usuario?.id ||
          e.modalidad === 'recoge'
      ),
    [lista, soloMias, usuario?.id]
  )
  const cuenta = (id: string) =>
    base.filter(FILTROS.find((f) => f.id === id)!.pasa).length
  // Si no se ha elegido, empieza en lo de hoy (o lo que haya que programar)
  const activo =
    filtro ?? (cuenta('hoy') > 0 || !programa ? 'hoy' : 'programar')
  const f = FILTROS.find((x) => x.id === activo)!
  const visibles = base
    .filter(f.pasa)
    .sort((a, b) =>
      activo === 'entregadas'
        ? (b.entregadaEn ?? '').localeCompare(a.entregadaEn ?? '')
        : (a.fechaProgramada ?? '').localeCompare(b.fechaProgramada ?? '')
    )

  return (
    <Pagina
      titulo={mensajero ? 'Mis entregas' : 'Entregas'}
      descripcion={
        mensajero
          ? 'Lo que hay que llevar hoy. Toca la dirección para abrir el mapa.'
          : 'Domicilios, envíos por transportadora y lo que pasan a recoger.'
      }
    >
      <div className='mb-4 flex flex-wrap items-center gap-3'>
        <div className='flex flex-wrap gap-2' role='group' aria-label='Filtrar'>
          {FILTROS.map((x) => (
            <button
              key={x.id}
              type='button'
              aria-pressed={activo === x.id}
              onClick={() => setFiltro(x.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors',
                activo === x.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {x.nombre}
              <span className='ms-1.5 tabular-nums opacity-70'>
                {cuenta(x.id)}
              </span>
            </button>
          ))}
        </div>
        {tieneRol(usuario, ['entregas']) && (
          <div className='flex items-center gap-2'>
            <Checkbox
              id='solo-mias'
              checked={soloMias}
              onCheckedChange={(v) => setSoloMias(v === true)}
            />
            <Label htmlFor='solo-mias' className='font-normal'>
              Solo las que llevo yo
            </Label>
          </div>
        )}
      </div>

      {isLoading && <Skeleton className='h-60 rounded-xl' />}
      {!isLoading && visibles.length === 0 && (
        <Card className='border-dashed'>
          <CardContent className='grid justify-items-center gap-2 py-10 text-center'>
            <Truck className='size-8 text-muted-foreground' />
            <p className='font-medium'>{f.vacio}</p>
            {activo === 'programar' && (
              <p className='max-w-md text-sm text-muted-foreground'>
                Un pedido aparece aquí cuando el taller lo termina.
              </p>
            )}
          </CardContent>
        </Card>
      )}
      <div className='grid gap-4 lg:grid-cols-2'>
        {visibles.map((e) => (
          <TarjetaEntrega key={e.id} e={e} puedeProgramar={programa} />
        ))}
      </div>
    </Pagina>
  )
}
