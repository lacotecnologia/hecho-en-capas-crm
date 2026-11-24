import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { type EstadoEnvio, ESTADOS_ENVIO } from '@shared/cuenta-cobro'
import { ChevronRight, FileSignature, Search, Settings } from 'lucide-react'
import { mensajeDeError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { formatoDiaHora } from '@/features/pedidos/fechas'
import { formatoPesos } from '@/features/taller/formato'
import { consultaCuentas, consultaDatosCobrador } from './api'
import { EstadoCuentaBadge } from './estado'
import { fechaCuenta } from './fechas'
import { VistaCuenta } from './vista'

type Filtro = 'todas' | EstadoEnvio | 'anulada'

const FILTROS: { valor: Filtro; nombre: string }[] = [
  { valor: 'todas', nombre: 'Todas' },
  { valor: 'por_enviar', nombre: ESTADOS_ENVIO.por_enviar.etiqueta },
  { valor: 'enviada', nombre: ESTADOS_ENVIO.enviada.etiqueta },
  { valor: 'recibida', nombre: ESTADOS_ENVIO.recibida.etiqueta },
  { valor: 'aceptada', nombre: ESTADOS_ENVIO.aceptada.etiqueta },
  { valor: 'anulada', nombre: 'Anuladas' },
]

const textoEnvio: Record<EstadoEnvio, string> = {
  por_enviar: '',
  enviada: 'Enviada',
  recibida: 'Abierta',
  aceptada: 'Descargada',
}

export function PantallaCuentasCobro() {
  const { data: cuentas, isLoading, isError, error } = useQuery(consultaCuentas)
  const { data: datos } = useQuery(consultaDatosCobrador)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [viendo, setViendo] = useState<number | null>(null)

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (cuentas ?? []).filter((c) => {
      if (filtro === 'anulada' && c.estado !== 'anulada') return false
      if (filtro !== 'todas' && filtro !== 'anulada') {
        if (c.estado === 'anulada' || c.envio !== filtro) return false
      }
      if (!q) return true
      return [c.codigo, c.pagador, c.pedido.codigo].some((x) =>
        x.toLowerCase().includes(q)
      )
    })
  }, [cuentas, buscar, filtro])

  const cuantas = (f: Filtro) =>
    (cuentas ?? []).filter((c) =>
      f === 'todas'
        ? true
        : f === 'anulada'
          ? c.estado === 'anulada'
          : c.estado === 'vigente' && c.envio === f
    ).length

  return (
    <Pagina
      titulo='Cuentas de cobro'
      descripcion='Se hacen desde la ficha de cada pedido. Aquí ves todas y si el cliente ya la abrió o la descargó.'
    >
      {datos && datos.falta.length > 0 && (
        <div className='mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-marca-ambar/15 p-4 text-sm'>
          <p className='me-auto'>
            Antes de hacer la primera, llena tus datos: falta{' '}
            {datos.falta.join(', ')}.
          </p>
          <Button size='sm' asChild>
            <Link to='/configuracion' search={{ pestana: 'cuenta-cobro' }}>
              <Settings /> Llenar mis datos
            </Link>
          </Button>
        </div>
      )}

      <div className='mb-4 grid gap-3'>
        <div className='relative'>
          <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder='Buscar por número, cliente o pedido'
            className='ps-9'
            aria-label='Buscar cuentas de cobro'
          />
        </div>
        <div className='flex flex-wrap gap-2' role='group' aria-label='Filtrar'>
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type='button'
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm',
                filtro === f.valor
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {f.nombre}{' '}
              <span className='opacity-70 tabular-nums'>{cuantas(f.valor)}</span>
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className='grid gap-2'>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-20 w-full rounded-xl' />
          ))}
        </div>
      )}
      {isError && <p className='text-destructive'>{mensajeDeError(error)}</p>}
      {cuentas && cuentas.length === 0 && (
        <Card>
          <CardContent className='grid justify-items-center gap-2 py-12 text-center'>
            <FileSignature className='size-10 text-muted-foreground' />
            <p className='font-medium'>Todavía no hay cuentas de cobro.</p>
            <p className='max-w-md text-sm text-muted-foreground'>
              Cuando un cliente la pida, abre su pedido y toca “Hacer cuenta de
              cobro”.
            </p>
            <Button variant='outline' asChild className='mt-2'>
              <Link to='/pedidos'>Ir a pedidos</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {cuentas && cuentas.length > 0 && lista.length === 0 && (
        <p className='py-8 text-center text-muted-foreground'>
          No hay cuentas de cobro con ese filtro.
        </p>
      )}

      <ul className='grid gap-2'>
        {lista.map((c) => (
          <li key={c.id}>
            <button
              type='button'
              onClick={() => setViendo(c.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-start transition-colors hover:bg-accent/50',
                c.estado === 'anulada' && 'opacity-70'
              )}
            >
              <span className='grid min-w-0 flex-1 gap-0.5'>
                <span className='flex flex-wrap items-center gap-2'>
                  <strong>{c.codigo}</strong>
                  <EstadoCuentaBadge estado={c.estado} envio={c.envio} />
                </span>
                <span className='truncate text-sm'>{c.pagador}</span>
                <span className='text-xs text-muted-foreground'>
                  {fechaCuenta(c.fecha)} · pedido {c.pedido.codigo}
                  {c.estado === 'vigente' && c.envioEn && (
                    <>
                      {' '}
                      · {textoEnvio[c.envio]} {formatoDiaHora(c.envioEn)}
                    </>
                  )}
                </span>
              </span>
              <span className='text-end font-semibold tabular-nums'>
                {formatoPesos(c.total)}
              </span>
              <ChevronRight className='size-4 shrink-0 text-muted-foreground' />
            </button>
          </li>
        ))}
      </ul>

      <VistaCuenta id={viendo} onCerrar={() => setViendo(null)} />
    </Pagina>
  )
}
