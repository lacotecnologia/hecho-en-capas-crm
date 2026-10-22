import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { MODALIDADES_INFO } from '@shared/cotizacion'
import {
  ESTADO_PARA_CLIENTE,
  type EstadoLineaCliente,
  normalizarCodigo,
  PASOS_CLIENTE,
  type SeguimientoPublico,
} from '@shared/seguimiento'
import {
  Ban,
  Box,
  Check,
  Mail,
  MessageCircle,
  Search,
  Truck,
} from 'lucide-react'
import { Logo } from '@/assets/logo'
import { api, mensajeDeError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { formatoFechaLarga } from '@/features/cotizar/estado'
import { enlaceWhatsapp } from '@/features/entregas/entrega'
import { formatoDiaHora } from '@/features/pedidos/fechas'
import { formatoPesos } from '@/features/taller/formato'

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-svh bg-muted/40'>
      <header className='border-b bg-background'>
        <div className='mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-3'>
          <Logo />
          <span className='text-sm text-muted-foreground'>
            Seguimiento de pedidos
          </span>
        </div>
      </header>
      <main className='mx-auto grid max-w-xl gap-4 px-4 py-6'>{children}</main>
      <footer className='mx-auto max-w-xl px-4 pb-8 text-center text-xs text-muted-foreground'>
        Hecho en Capas · Impresión 3D
      </footer>
    </div>
  )
}

function FormBuscar({
  inicial = '',
  error,
}: {
  inicial?: string
  error?: string
}) {
  const navigate = useNavigate()
  const [codigo, setCodigo] = useState(inicial)
  const [aviso, setAviso] = useState<string | null>(null)
  return (
    <form
      className='grid gap-3'
      onSubmit={(e) => {
        e.preventDefault()
        const limpio = normalizarCodigo(codigo)
        if (!limpio) {
          setAviso(
            'El código tiene 6 letras y números después de “HC-”. Ejemplo: HC-7K4P2Q'
          )
          return
        }
        setAviso(null)
        navigate({ to: '/seguimiento/$codigo', params: { codigo: limpio } })
      }}
    >
      <Label htmlFor='codigo'>Código de tu pedido</Label>
      <div className='flex gap-2'>
        <Input
          id='codigo'
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder='HC-7K4P2Q'
          autoCapitalize='characters'
          autoComplete='off'
          className='h-11 font-mono text-base tracking-wider uppercase'
          aria-invalid={!!(aviso || error)}
        />
        <Button type='submit' size='lg' className='h-11'>
          <Search /> Ver
        </Button>
      </div>
      {(aviso || error) && (
        <p className='text-sm font-medium text-destructive' role='alert'>
          {aviso || error}
        </p>
      )}
    </form>
  )
}

/** /seguimiento: el cliente escribe su código. */
export function BuscarPedido() {
  return (
    <Marco>
      <Card>
        <CardHeader>
          <CardTitle className='text-xl'>¿En qué va tu pedido?</CardTitle>
          <p className='text-muted-foreground'>
            Escribe el código que te enviamos por WhatsApp. No necesitas cuenta
            ni contraseña.
          </p>
        </CardHeader>
        <CardContent>
          <FormBuscar />
        </CardContent>
      </Card>
    </Marco>
  )
}

const ESTADO_LINEA: Record<
  EstadoLineaCliente,
  { texto: string; clase: string }
> = {
  esperando: {
    texto: 'Espera el anticipo',
    clase: 'bg-marca-ambar/30 text-foreground',
  },
  fabricando: {
    texto: 'Fabricando',
    clase: 'bg-marca-lima/35 text-foreground',
  },
  listo: { texto: 'Listo', clase: 'bg-primary text-primary-foreground' },
}

/** /seguimiento/HC-XXXXXX */
export function SeguimientoPedido({ codigo }: { codigo: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['seguimiento', codigo],
    queryFn: () =>
      api<{ pedido: SeguimientoPublico }>(
        `/seguimiento/${encodeURIComponent(codigo)}`
      ),
    select: (d) => d.pedido,
    retry: false,
    refetchInterval: 120_000,
  })
  if (isLoading) {
    return (
      <Marco>
        <Skeleton className='h-64 rounded-xl' />
        <Skeleton className='h-40 rounded-xl' />
      </Marco>
    )
  }
  if (!data) {
    return (
      <Marco>
        <Card>
          <CardHeader>
            <CardTitle className='text-xl'>No encontramos ese pedido</CardTitle>
          </CardHeader>
          <CardContent>
            <FormBuscar inicial={codigo} error={mensajeDeError(error)} />
          </CardContent>
        </Card>
      </Marco>
    )
  }
  return <Vista p={data} />
}

function Vista({ p }: { p: SeguimientoPublico }) {
  const cancelado = p.estado === 'cancelado'
  const actual = PASOS_CLIENTE.findIndex(
    (x) => x.estado === (p.estado === 'cerrado' ? 'entregado' : p.estado)
  )
  const info = ESTADO_PARA_CLIENTE[p.estado]
  const e = p.entrega
  const mensaje = `Hola, quiero saber de mi pedido ${p.seguimiento}.`

  return (
    <Marco>
      <Card className='overflow-hidden pt-0'>
        <div
          className={cn(
            'px-6 py-5',
            cancelado
              ? 'bg-destructive/10'
              : 'bg-primary text-primary-foreground'
          )}
        >
          <p className='text-sm opacity-90'>
            Hola{p.cliente && `, ${p.cliente}`}
          </p>
          <h1 className='text-2xl font-bold'>{info.titulo}</h1>
          <p className='opacity-90'>{info.texto}</p>
        </div>
        <CardContent className='grid gap-5'>
          <p className='text-sm text-muted-foreground'>
            Pedido {p.codigo} · código{' '}
            <span className='font-mono font-semibold'>{p.seguimiento}</span>
          </p>
          {cancelado ? (
            <p className='flex items-center gap-2 text-destructive'>
              <Ban className='size-5' /> Este pedido no sigue.
            </p>
          ) : (
            <ol className='grid gap-0' aria-label='Pasos de tu pedido'>
              {PASOS_CLIENTE.map((paso, i) => {
                const hecho = i < actual || p.estado === 'cerrado'
                const ahora = i === actual && p.estado !== 'cerrado'
                return (
                  <li
                    key={paso.estado}
                    className='grid grid-cols-[2rem_1fr] gap-3'
                  >
                    <div className='flex flex-col items-center'>
                      <span
                        className={cn(
                          'flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold',
                          hecho &&
                            'border-primary bg-primary text-primary-foreground',
                          ahora &&
                            'border-primary text-primary ring-4 ring-primary/15',
                          !hecho &&
                            !ahora &&
                            'border-border text-muted-foreground'
                        )}
                        aria-current={ahora ? 'step' : undefined}
                      >
                        {hecho ? <Check className='size-4' /> : i + 1}
                      </span>
                      {i < PASOS_CLIENTE.length - 1 && (
                        <span
                          className={cn(
                            'min-h-5 w-0.5 flex-1',
                            hecho ? 'bg-primary' : 'bg-border'
                          )}
                        />
                      )}
                    </div>
                    <p
                      className={cn(
                        'pt-1 pb-4',
                        ahora
                          ? 'font-semibold'
                          : !hecho && 'text-muted-foreground'
                      )}
                    >
                      {paso.nombre}
                    </p>
                  </li>
                )
              })}
            </ol>
          )}

          {!cancelado && (
            <div className='rounded-xl bg-muted p-4'>
              {e?.estado === 'entregada' ? (
                <p>
                  <span className='text-sm text-muted-foreground'>
                    Entregado
                  </span>
                  <span className='block font-semibold'>
                    {e.entregadaEn && formatoFechaLarga(e.entregadaEn)}
                    {e.recibidoPor && ` · recibió ${e.recibidoPor}`}
                  </span>
                </p>
              ) : e?.fechaProgramada ? (
                <p>
                  <span className='text-sm text-muted-foreground'>
                    {p.modalidad === 'recoge'
                      ? 'Puedes recogerlo'
                      : p.modalidad === 'nacional'
                        ? e.estado === 'en_camino'
                          ? 'Despachado'
                          : 'Se despacha'
                        : 'Te lo llevamos'}
                  </span>
                  <span className='block font-semibold'>
                    {formatoFechaLarga(e.fechaProgramada)}
                    {e.franja && ` · ${e.franja}`}
                  </span>
                  {e.transportadora && (
                    <span className='mt-1 flex items-center gap-1.5 text-sm'>
                      <Truck className='size-4' /> {e.transportadora}
                      {e.guia && ` · guía ${e.guia}`}
                    </span>
                  )}
                </p>
              ) : p.fechaCompromiso ? (
                <p>
                  <span className='text-sm text-muted-foreground'>
                    Fecha estimada de entrega
                  </span>
                  <span className='block font-semibold'>
                    {formatoFechaLarga(p.fechaCompromiso)}
                  </span>
                  <span className='text-sm text-muted-foreground'>
                    {MODALIDADES_INFO[p.modalidad].nombre}
                  </span>
                </p>
              ) : (
                <p className='text-sm'>
                  La fecha de entrega se fija cuando recibamos el anticipo.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!cancelado && p.dinero.falta > 0 && (
        <Card className='border-marca-ambar'>
          <CardContent className='grid gap-2'>
            {p.dinero.anticipoPendiente > 0 ? (
              <>
                <p className='text-sm text-muted-foreground'>
                  Para empezar a fabricarlo falta el anticipo
                </p>
                <p className='text-2xl font-bold tabular-nums'>
                  {formatoPesos(p.dinero.anticipoPendiente)}
                </p>
              </>
            ) : (
              <>
                <p className='text-sm text-muted-foreground'>Falta por pagar</p>
                <p className='text-2xl font-bold tabular-nums'>
                  {formatoPesos(p.dinero.falta)}
                </p>
              </>
            )}
            <p className='text-sm text-muted-foreground'>
              Total {formatoPesos(p.dinero.total)} · ya pagaste{' '}
              {formatoPesos(p.dinero.pagado)}
            </p>
            {p.negocio.datosPago && (
              <div className='mt-1 rounded-lg bg-muted p-3 text-sm whitespace-pre-line'>
                <p className='mb-1 font-medium'>Cómo pagar</p>
                {p.negocio.datosPago}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {!cancelado && p.dinero.falta === 0 && (
        <p className='flex items-center justify-center gap-2 rounded-xl bg-primary/10 p-3 text-sm font-medium text-primary'>
          <Check className='size-4' /> Pagado completo. ¡Gracias!
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Tu pedido</CardTitle>
        </CardHeader>
        <CardContent className='grid gap-3'>
          {p.lineas.map((l, i) => (
            <div key={i} className='flex items-center gap-3'>
              <div className='size-14 shrink-0 overflow-hidden rounded-lg bg-muted'>
                {l.imagen ? (
                  <img
                    src={l.imagen}
                    alt=''
                    className='size-full object-contain p-1'
                  />
                ) : (
                  <Box className='m-auto mt-4 size-5 text-muted-foreground' />
                )}
              </div>
              <div className='min-w-0 flex-1'>
                <p className='font-medium'>{l.nombre}</p>
                <p className='text-sm text-muted-foreground'>
                  {l.cantidad} {l.cantidad === 1 ? 'unidad' : 'unidades'}
                </p>
              </div>
              {!cancelado && (
                <Badge className={ESTADO_LINEA[l.estado].clase}>
                  {ESTADO_LINEA[l.estado].texto}
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {p.eventos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-lg'>Novedades</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className='grid gap-3'>
              {p.eventos.map((ev, i) => (
                <li key={i} className='grid grid-cols-[auto_1fr] gap-3 text-sm'>
                  <span
                    className={cn(
                      'mt-1.5 size-2 rounded-full',
                      i === 0 ? 'bg-primary' : 'bg-border'
                    )}
                  />
                  <div>
                    <p className={cn(i === 0 && 'font-medium')}>{ev.texto}</p>
                    <p className='text-xs text-muted-foreground'>
                      {formatoDiaHora(ev.fecha)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {(p.negocio.whatsapp || p.negocio.email) && (
        <Card>
          <CardContent className='grid gap-3'>
            <p className='font-medium'>¿Tienes alguna pregunta?</p>
            <div className='flex flex-wrap gap-2'>
              {p.negocio.whatsapp && (
                <Button asChild size='lg'>
                  <a
                    href={enlaceWhatsapp(p.negocio.whatsapp, mensaje)}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <MessageCircle /> Escríbenos por WhatsApp
                  </a>
                </Button>
              )}
              {p.negocio.email && (
                <Button asChild variant='outline' size='lg'>
                  <a
                    href={`mailto:${p.negocio.email}?subject=${encodeURIComponent(`Pedido ${p.seguimiento}`)}`}
                  >
                    <Mail /> {p.negocio.email}
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <p className='text-center text-sm'>
        <Link to='/seguimiento' className='text-primary underline'>
          Consultar otro pedido
        </Link>
      </p>
    </Marco>
  )
}
