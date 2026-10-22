import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  type CotizacionDetalle,
  MODALIDADES_INFO,
  sumarDiasHabiles,
} from '@shared/cotizacion'
import {
  Box,
  CheckCircle2,
  FileText,
  Loader2,
  PencilLine,
  ThumbsDown,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { mensajeDeError } from '@/lib/api'
import { tieneRol, useSesion } from '@/lib/sesion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Campo } from '@/components/campo'
import { Pagina } from '@/components/layout/pagina'
import { ConvertirEnPedido } from '@/features/pedidos/convertir'
import { formatoPesos } from '@/features/taller/formato'
import { accionCotizacion, consultaCotizacion } from './api'
import { EditorCotizacion, Volver } from './editor'
import {
  EstadoCotizacionBadge,
  formatoFecha,
  formatoFechaLarga,
  textoVence,
} from './estado'
import { VistaPdf } from './vista-pdf'

/** Decide qué mostrar: el editor (borrador) o la cotización ya enviada. */
export function PantallaCotizacion({ id }: { id: string }) {
  const usuario = useSesion()
  const puedeEditar = tieneRol(usuario, ['admin', 'comercial'])
  const nueva = id === 'nueva'
  const { data, isLoading, error } = useQuery({
    ...consultaCotizacion(Number(id)),
    enabled: !nueva,
  })

  if (nueva) return <EditorCotizacion key='nueva' cotizacion={null} />
  if (isLoading) {
    return (
      <Pagina titulo='Cotización'>
        <Skeleton className='h-96 rounded-xl' />
      </Pagina>
    )
  }
  if (!data) {
    return (
      <Pagina titulo='Cotización'>
        <Volver />
        <p className='text-destructive'>{mensajeDeError(error)}</p>
      </Pagina>
    )
  }
  if (data.estado === 'borrador' && puedeEditar) {
    return <EditorCotizacion key={data.id} cotizacion={data} />
  }
  return <VerCotizacion cotizacion={data} />
}

const AVISO: Record<string, { texto: string; clase: string }> = {
  borrador: {
    texto: 'Borrador: aún no se ha enviado al cliente.',
    clase: 'bg-muted',
  },
  enviada: {
    texto: 'Enviada. Cuando el cliente responda, marca si aceptó o no.',
    clase: 'bg-marca-ambar/20',
  },
  aprobada: {
    texto:
      '¡El cliente aceptó! Conviértela en pedido para que el taller empiece.',
    clase: 'bg-primary/10',
  },
  rechazada: {
    texto: 'El cliente no aceptó esta cotización.',
    clase: 'bg-destructive/10',
  },
  vencida: {
    texto:
      'Pasaron los días de vigencia sin respuesta. Si el cliente aún la quiere, haz una nueva versión con los precios de hoy.',
    clase: 'bg-marca-naranja/15',
  },
  reemplazada: {
    texto: 'Esta versión se cambió por una más nueva.',
    clase: 'bg-muted',
  },
}

function VerCotizacion({ cotizacion: c }: { cotizacion: CotizacionDetalle }) {
  const usuario = useSesion()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const puedeDecidir = tieneRol(usuario, ['admin', 'comercial'])
  const verGanancia = tieneRol(usuario, ['admin', 'comercial'])
  const [pdf, setPdf] = useState(false)
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const vence = c.estado === 'enviada' ? textoVence(c.venceEn) : null

  const accion = useMutation({
    mutationFn: (a: {
      tipo: 'aprobar' | 'rechazar' | 'nueva-version'
      body?: unknown
    }) => accionCotizacion(c.id, a.tipo, a.body),
    onSuccess: ({ cotizacion: nueva }, a) => {
      queryClient.setQueryData(['cotizacion', nueva.id], { cotizacion: nueva })
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
      queryClient.invalidateQueries({ queryKey: ['cotizacion', c.id] })
      setRechazando(false)
      if (a.tipo === 'nueva-version') {
        toast.success(
          `Se creó ${nueva.codigo}. Haz los cambios y vuelve a enviarla.`
        )
        navigate({ to: '/cotizar/$id', params: { id: String(nueva.id) } })
      } else if (a.tipo === 'aprobar') {
        toast.success(
          '¡Bien! Quedó como aprobada. Ahora conviértela en pedido.'
        )
      } else {
        toast.success('Quedó como no aceptada.')
      }
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  })

  const aviso = AVISO[c.estado]
  const abiertas = c.estado === 'enviada' || c.estado === 'vencida'

  return (
    <Pagina
      titulo={`Cotización ${c.codigo}`}
      descripcion={`Para ${c.cliente?.nombre ?? 'sin cliente'} · hecha por ${c.comercial.nombre}`}
      acciones={<EstadoCotizacionBadge estado={c.estado} />}
    >
      <Volver />
      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start'>
        <div className='grid min-w-0 gap-6'>
          <div
            className={`flex items-start gap-3 rounded-xl p-4 ${aviso.clase}`}
          >
            {c.estado === 'aprobada' ? (
              <CheckCircle2 className='mt-0.5 size-5 shrink-0 text-primary' />
            ) : (
              <TriangleAlert className='mt-0.5 size-5 shrink-0' />
            )}
            <div className='grid gap-1'>
              <p className='font-medium'>
                {c.pedido
                  ? `El cliente aceptó y ya es el pedido ${c.pedido.codigo}.`
                  : aviso.texto}
              </p>
              {c.enviadaEn && (
                <p className='text-sm text-muted-foreground'>
                  Enviada el {formatoFecha(c.enviadaEn)}
                  {c.venceEn &&
                    ` · vigente hasta el ${formatoFecha(c.venceEn)}`}
                  {vence && ` (${vence.texto})`}
                </p>
              )}
              {c.estado === 'rechazada' && c.motivoRechazo && (
                <p className='text-sm'>Motivo: {c.motivoRechazo}</p>
              )}
              {c.estado === 'reemplazada' && c.reemplazadaPor && (
                <Link
                  to='/cotizar/$id'
                  params={{ id: String(c.reemplazadaPor) }}
                  className='text-sm font-medium text-primary underline'
                >
                  Ver la versión nueva
                </Link>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Productos</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {c.lineas.map((l) => (
                <div key={l.productoId} className='flex items-center gap-3'>
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
                      {l.cantidad} × {formatoPesos(l.precioVenta)}
                      {l.personalizado && ' · personalizado'}
                      {l.desdeStock && ' · sale de stock'}
                    </p>
                  </div>
                  <p className='font-semibold tabular-nums'>
                    {formatoPesos(l.cantidad * l.precioVenta)}
                  </p>
                </div>
              ))}
              {c.cargos.map((g, i) => (
                <p
                  key={i}
                  className='flex justify-between border-t pt-2 text-sm'
                >
                  <span>{g.concepto}</span>
                  <span className='tabular-nums'>{formatoPesos(g.valor)}</span>
                </p>
              ))}
            </CardContent>
          </Card>

          {(c.notas || c.imagenes.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Notas e imágenes</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-3'>
                {c.notas && <p className='whitespace-pre-line'>{c.notas}</p>}
                {c.imagenes.length > 0 && (
                  <ul className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
                    {c.imagenes.map((im) => (
                      <li
                        key={im.id}
                        className='overflow-hidden rounded-lg border'
                      >
                        <img
                          src={im.url}
                          alt={im.nombre}
                          className='aspect-square w-full bg-muted object-contain'
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className='grid min-w-0 gap-4 lg:sticky lg:top-20'>
          <Card>
            <CardContent className='grid gap-3 pt-6'>
              <div className='rounded-xl bg-primary p-4 text-primary-foreground'>
                <p className='text-sm opacity-90'>Total</p>
                <p className='text-3xl font-bold tabular-nums'>
                  {formatoPesos(c.resumen.total)}
                </p>
                {c.resumen.descuento > 0 && (
                  <p className='text-sm opacity-90'>
                    Incluye descuento de {formatoPesos(c.resumen.descuento)}
                  </p>
                )}
              </div>
              {c.resumen.anticipo > 0 && (
                <p className='flex justify-between text-sm'>
                  <span>Anticipo ({c.resumen.anticipoPct} %)</span>
                  <strong className='tabular-nums'>
                    {formatoPesos(c.resumen.anticipo)}
                  </strong>
                </p>
              )}
              <p className='text-sm'>
                <span className='text-muted-foreground'>Entrega:</span>{' '}
                {MODALIDADES_INFO[c.modalidad].nombre}
                <span className='block text-xs text-muted-foreground'>
                  {c.resumen.diasFabricacion} días de fabricación +{' '}
                  {c.resumen.diasEnvio} de envío
                  {c.enviadaEn && (
                    <> · estimada para el {formatoFechaLarga(estimada(c))}</>
                  )}
                </span>
              </p>
              {verGanancia && (
                <p className='flex items-center justify-between rounded-lg border border-dashed border-primary/40 p-3 text-sm'>
                  <span>Tu ganancia</span>
                  <strong className='text-lg text-primary tabular-nums'>
                    {formatoPesos(c.ganancia)}
                  </strong>
                </p>
              )}
            </CardContent>
          </Card>

          <div className='grid gap-2'>
            <ConvertirEnPedido cotizacion={c} puede={puedeDecidir} />
            {puedeDecidir && c.estado === 'enviada' && (
              <Button
                size='lg'
                disabled={accion.isPending}
                onClick={() => accion.mutate({ tipo: 'aprobar' })}
              >
                {accion.isPending ? (
                  <Loader2 className='animate-spin' />
                ) : (
                  <CheckCircle2 />
                )}
                El cliente aceptó
              </Button>
            )}
            {puedeDecidir && abiertas && (
              <>
                <Button variant='outline' onClick={() => setRechazando(true)}>
                  <ThumbsDown /> El cliente no aceptó
                </Button>
                <Button
                  variant='outline'
                  disabled={accion.isPending}
                  onClick={() => accion.mutate({ tipo: 'nueva-version' })}
                >
                  <PencilLine /> Hacer cambios (nueva versión)
                </Button>
              </>
            )}
            <Button variant='ghost' onClick={() => setPdf(true)}>
              <FileText /> Ver PDF
            </Button>
          </div>
        </div>
      </div>

      <VistaPdf cotizacion={pdf ? c : null} onCerrar={() => setPdf(false)} />

      <Dialog open={rechazando} onOpenChange={setRechazando}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>¿Por qué no aceptó?</DialogTitle>
            <DialogDescription>
              Sirve para saber qué mejorar. Por ejemplo: “le pareció caro” o “lo
              necesitaba antes”.
            </DialogDescription>
          </DialogHeader>
          <Campo etiqueta='Motivo'>
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            )}
          </Campo>
          <DialogFooter>
            <Button variant='outline' onClick={() => setRechazando(false)}>
              Cancelar
            </Button>
            <Button
              disabled={accion.isPending}
              onClick={() =>
                accion.mutate({ tipo: 'rechazar', body: { motivo } })
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Pagina>
  )
}

function estimada(c: CotizacionDetalle) {
  return sumarDiasHabiles(
    new Date(c.enviadaEn!),
    c.resumen.diasFabricacion + c.resumen.diasEnvio
  )
}
