import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { MODALIDADES_INFO } from '@shared/cotizacion'
import {
  anticipoPendiente,
  ESTADOS_PEDIDO_INFO,
  METODOS_PAGO,
  METODOS_PAGO_INFO,
  type MetodoPago,
  PASOS_PEDIDO,
  type PedidoDetalle,
  TIPOS_PAGO_INFO,
} from '@shared/pedidos'
import {
  ArrowLeft,
  Ban,
  Box,
  Check,
  Copy,
  Eye,
  Loader2,
  Lock,
  Package,
  Printer,
  ImagePlus,
  MessageCircle,
  Undo2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { tieneRol, useSesion } from '@/lib/sesion'
import { subirFoto } from '@/lib/subir-foto'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { BotonBorrar } from '@/components/boton-borrar'
import { Campo, CampoNumero } from '@/components/campo'
import { EtiquetaColor } from '@/components/color'
import { Pagina } from '@/components/layout/pagina'
import { formatoFecha, formatoFechaLarga } from '@/features/cotizar/estado'
import {
  AccionesEntrega,
  DatosEntrega,
  enlaceWhatsapp,
  EstadoEntregaBadge,
} from '@/features/entregas/entrega'
import { formatoPesos } from '@/features/taller/formato'
import {
  agregarNota,
  cancelarPedido,
  devolverPlata,
  guardarFactura,
  consultaPedido,
  producirSinAnticipo,
  registrarPago,
} from './api'
import { EstadoOrdenBadge, EstadoPedidoBadge } from './estado'
import { formatoDiaHora, textoCompromiso } from './fechas'

function Volver() {
  return (
    <Button variant='ghost' asChild className='-ms-3 mb-2'>
      <Link to='/pedidos'>
        <ArrowLeft /> Volver a Pedidos
      </Link>
    </Button>
  )
}

export function FichaPedido({ id }: { id: number }) {
  const { data: p, isLoading, error } = useQuery(consultaPedido(id))
  if (isLoading) {
    return (
      <Pagina titulo='Pedido'>
        <Skeleton className='h-96 rounded-xl' />
      </Pagina>
    )
  }
  if (!p) {
    return (
      <Pagina titulo='Pedido'>
        <Volver />
        <p className='text-destructive'>{mensajeDeError(error)}</p>
      </Pagina>
    )
  }
  return <Ficha p={p} />
}

function Ficha({ p }: { p: PedidoDetalle }) {
  const usuario = useSesion()
  const queryClient = useQueryClient()
  const esAdmin = tieneRol(usuario, ['admin'])
  const cobra =
    esAdmin ||
    (tieneRol(usuario, ['comercial']) && p.comercial.id === usuario?.id)
  const verDinero = tieneRol(usuario, ['admin', 'comercial'])
  const [pagando, setPagando] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const [devolviendo, setDevolviendo] = useState(false)
  const verSaldo = tieneRol(usuario, ['admin', 'comercial', 'entregas'])

  const poner = (d: PedidoDetalle) => {
    queryClient.setQueryData(['pedido', d.id], { pedido: d })
    queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    queryClient.invalidateQueries({ queryKey: ['cola'] })
  }

  const sinAnticipo = useMutation({
    mutationFn: () => producirSinAnticipo(p.id),
    onSuccess: ({ pedido }) => {
      poner(pedido)
      toast.success('Listo: lo personalizado ya entró a la cola del taller.')
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  })

  const navigate = useNavigate()
  const falta = p.total - p.pagado
  const anticipoFalta = anticipoPendiente(p)
  const compromiso = [
    'confirmado',
    'en_produccion',
    'listo',
    'en_entrega',
  ].includes(p.estado)
    ? textoCompromiso(p.fechaCompromiso)
    : null
  const cancelado = p.estado === 'cancelado'
  const pasoActual = PASOS_PEDIDO.findIndex((x) => x.estado === p.estado)

  return (
    <Pagina
      titulo={`Pedido ${p.codigo}`}
      descripcion={`Para ${p.cliente.nombre} · de la cotización ${p.cotizacion.codigo} · ${p.comercial.nombre}`}
      acciones={
        <div className='flex flex-wrap items-center gap-2'>
          <EstadoPedidoBadge estado={p.estado} className='text-sm' />
          {p.estado === 'cancelado' && (
            <BotonBorrar
              tipo='pedido'
              id={p.id}
              nombre={p.codigo}
              onBorrado={() => navigate({ to: '/pedidos' })}
            />
          )}
        </div>
      }
    >
      <Volver />
      <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start'>
        <div className='grid min-w-0 gap-6'>
          {/* Pasos */}
          {cancelado ? (
            <div className='flex items-start gap-3 rounded-xl bg-destructive/10 p-4'>
              <Ban className='mt-0.5 size-5 shrink-0 text-destructive' />
              <div>
                <p className='font-medium'>Este pedido se canceló.</p>
                {p.motivoCancelacion && (
                  <p className='text-sm'>Motivo: {p.motivoCancelacion}</p>
                )}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className='pt-6'>
                <ol
                  className='grid grid-cols-5 gap-1'
                  aria-label='En qué va el pedido'
                >
                  {PASOS_PEDIDO.map((paso, i) => {
                    const hecho = i < pasoActual || p.estado === 'cerrado'
                    const actual = i === pasoActual
                    return (
                      <li
                        key={paso.estado}
                        className='grid content-start justify-items-center gap-1.5 text-center'
                      >
                        <div className='flex w-full items-center'>
                          <span
                            className={cn(
                              'h-0.5 flex-1',
                              i === 0
                                ? 'invisible'
                                : hecho || actual
                                  ? 'bg-primary'
                                  : 'bg-border'
                            )}
                          />
                          <span
                            className={cn(
                              'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold',
                              hecho &&
                                'border-primary bg-primary text-primary-foreground',
                              actual &&
                                'border-primary bg-background text-primary ring-4 ring-primary/15',
                              !hecho &&
                                !actual &&
                                'border-border text-muted-foreground'
                            )}
                            aria-current={actual ? 'step' : undefined}
                          >
                            {hecho ? <Check className='size-4' /> : i + 1}
                          </span>
                          <span
                            className={cn(
                              'h-0.5 flex-1',
                              i === PASOS_PEDIDO.length - 1
                                ? 'invisible'
                                : hecho
                                  ? 'bg-primary'
                                  : 'bg-border'
                            )}
                          />
                        </div>
                        <span
                          className={cn(
                            'text-xs leading-tight sm:block sm:text-sm',
                            actual
                              ? 'font-semibold'
                              : 'hidden text-muted-foreground'
                          )}
                        >
                          {paso.nombre}
                        </span>
                      </li>
                    )
                  })}
                </ol>
                <p className='mt-4 text-center text-sm text-muted-foreground'>
                  {ESTADOS_PEDIDO_INFO[p.estado].ayuda}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Falta el anticipo */}
          {p.estado === 'confirmado' && (
            <div className='grid gap-3 rounded-xl border border-marca-ambar bg-marca-ambar/15 p-4 sm:flex sm:items-center'>
              <div className='flex-1'>
                <p className='font-semibold'>
                  Falta el anticipo: {formatoPesos(anticipoFalta)}
                </p>
                <p className='text-sm text-muted-foreground'>
                  Lo personalizado entra a la cola del taller cuando el cliente
                  pague el {p.anticipoPct} %. Lo de catálogo ya se está
                  preparando.
                </p>
              </div>
              <div className='flex flex-wrap gap-2'>
                {cobra && (
                  <Button size='lg' onClick={() => setPagando(true)}>
                    <Wallet /> Cobrar anticipo
                  </Button>
                )}
                {esAdmin && (
                  <Button
                    variant='outline'
                    disabled={sinAnticipo.isPending}
                    onClick={() => sinAnticipo.mutate()}
                  >
                    Producir sin anticipo
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Productos */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Productos</CardTitle>
              <CardDescription>
                {p.avance.listas} de {p.avance.total} listos. El taller los
                mueve desde la cola de impresión.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {p.lineas.map((l) => (
                <div key={l.id} className='flex flex-wrap items-center gap-3'>
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
                  <div className='min-w-40 flex-1'>
                    <p className='flex flex-wrap items-center gap-2 font-medium'>
                      {l.nombre}
                      <EtiquetaColor color={l.color} colorHex={l.colorHex} />
                    </p>
                    <p className='text-sm text-muted-foreground'>
                      {l.cantidad} {l.cantidad === 1 ? 'unidad' : 'unidades'}
                      {l.personalizado && ' · personalizado'}
                    </p>
                  </div>
                  <div className='flex w-full items-center justify-between gap-3 ps-[68px] sm:w-auto sm:ps-0'>
                    {l.desdeStock ? (
                      <span className='inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'>
                        <Package className='size-3.5' /> Salió del stock
                      </span>
                    ) : (
                      <EstadoOrdenBadge estado={l.estado} />
                    )}
                    {verDinero && (
                      <p className='w-24 text-end font-semibold tabular-nums'>
                        {formatoPesos(l.cantidad * l.precioVenta)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <Button variant='outline' asChild className='justify-self-start'>
                <Link to='/cola'>
                  <Printer /> Ver la cola de impresión
                </Link>
              </Button>
            </CardContent>
          </Card>

          {!cancelado && p.entrega && (
            <Card>
              <CardHeader className='flex flex-row flex-wrap items-start justify-between gap-2'>
                <div className='grid gap-1'>
                  <CardTitle className='text-lg'>Entrega</CardTitle>
                  <CardDescription>
                    {MODALIDADES_INFO[p.modalidad].nombre}
                  </CardDescription>
                </div>
                <EstadoEntregaBadge e={p.entrega} />
              </CardHeader>
              <CardContent className='grid gap-4'>
                <DatosEntrega e={p.entrega} saldo={verSaldo ? falta : 0} />
                <AccionesEntrega
                  e={p.entrega}
                  saldo={verSaldo ? falta : 0}
                  listo={[
                    'listo',
                    'en_entrega',
                    'entregado',
                    'cerrado',
                  ].includes(p.estado)}
                  puedeProgramar={cobra}
                />
              </CardContent>
            </Card>
          )}

          <Notas p={p} onCambio={poner} />
          <Historial p={p} />
        </div>

        {/* Columna derecha */}
        <div className='grid min-w-0 gap-4 lg:sticky lg:top-20'>
          {verDinero && (
            <Card>
              <CardHeader>
                <CardTitle className='text-lg'>Dinero</CardTitle>
              </CardHeader>
              <CardContent className='grid gap-3'>
                <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm'>
                  <dt className='text-muted-foreground'>Total</dt>
                  <dd className='text-end font-semibold tabular-nums'>
                    {formatoPesos(p.total)}
                  </dd>
                  <dt className='text-muted-foreground'>Pagado</dt>
                  <dd className='text-end tabular-nums'>
                    {formatoPesos(p.pagado)}
                  </dd>
                </dl>
                <div
                  className={cn(
                    'rounded-xl p-4',
                    falta > 0 ? 'bg-marca-ambar/15' : 'bg-primary/10'
                  )}
                >
                  <p className='text-sm text-muted-foreground'>
                    {falta > 0 ? 'Falta por cobrar' : 'Pagado completo'}
                  </p>
                  <p className='text-2xl font-bold tabular-nums'>
                    {formatoPesos(Math.max(0, falta))}
                  </p>
                </div>
                {p.pagos.length > 0 && (
                  <ul className='grid gap-2 text-sm'>
                    {p.pagos.map((x) => (
                      <li
                        key={x.id}
                        className='flex items-start justify-between gap-2 border-t pt-2'
                      >
                        <span>
                          {TIPOS_PAGO_INFO[x.tipo]} ·{' '}
                          {METODOS_PAGO_INFO[x.metodo]}
                          <span className='block text-xs text-muted-foreground'>
                            {formatoFecha(x.creadoEn)} · {x.usuario}
                            {x.referencia && ` · ${x.referencia}`}
                            {x.nota && ` · ${x.nota}`}
                          </span>
                          {x.comprobanteUrl && (
                            <a
                              href={x.comprobanteUrl}
                              target='_blank'
                              rel='noreferrer'
                              className='text-xs text-primary underline'
                            >
                              Ver comprobante
                            </a>
                          )}
                        </span>
                        <span
                          className={cn(
                            'font-medium tabular-nums',
                            x.monto < 0 && 'text-destructive'
                          )}
                        >
                          {x.monto < 0
                            ? `− ${formatoPesos(-x.monto)}`
                            : formatoPesos(x.monto)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {cobra &&
                  !cancelado &&
                  falta > 0 &&
                  p.estado !== 'confirmado' && (
                    <Button variant='outline' onClick={() => setPagando(true)}>
                      <Wallet /> Registrar un pago
                    </Button>
                  )}
                {esAdmin && p.pagado > 0 && (
                  <Button
                    variant='ghost'
                    className='text-muted-foreground'
                    onClick={() => setDevolviendo(true)}
                  >
                    <Undo2 /> Devolver plata al cliente
                  </Button>
                )}
                <Factura p={p} puede={cobra} onCambio={poner} />
                <p className='flex items-center justify-between rounded-lg border border-dashed border-primary/40 p-3 text-sm'>
                  <span>
                    Tu ganancia
                    <span className='block text-xs text-muted-foreground'>
                      No la ve el cliente
                    </span>
                  </span>
                  <strong className='text-lg text-primary tabular-nums'>
                    {formatoPesos(p.ganancia)}
                  </strong>
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className='grid gap-4 pt-6 text-sm'>
              <div>
                <p className='text-muted-foreground'>Fecha prometida</p>
                {p.fechaCompromiso ? (
                  <p className='font-semibold'>
                    {formatoFechaLarga(p.fechaCompromiso)}
                    {compromiso && !cancelado && (
                      <span
                        className={cn(
                          'ms-2 text-xs font-medium',
                          compromiso.tono === 'tarde'
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        )}
                      >
                        ({compromiso.texto})
                      </span>
                    )}
                  </p>
                ) : (
                  <p>Se fija cuando llegue el anticipo.</p>
                )}
              </div>
              <div>
                <p className='text-muted-foreground'>Cliente</p>
                <p className='font-medium'>{p.cliente.nombre}</p>
                {p.cliente.whatsapp && (
                  <a
                    href={enlaceWhatsapp(p.cliente.whatsapp)}
                    target='_blank'
                    rel='noreferrer'
                    className='text-primary'
                  >
                    WhatsApp {p.cliente.whatsapp}
                  </a>
                )}
              </div>
              <div>
                <p className='text-muted-foreground'>
                  Seguimiento para el cliente
                </p>
                <EnlaceSeguimiento p={p} />
              </div>
              <Link
                to='/cotizar/$id'
                params={{ id: String(p.cotizacion.id) }}
                className='text-sm font-medium text-primary underline'
              >
                Ver la cotización {p.cotizacion.codigo}
              </Link>
            </CardContent>
          </Card>

          {cobra &&
            !cancelado &&
            ['confirmado', 'en_produccion', 'listo'].includes(p.estado) && (
              <Button
                variant='ghost'
                className='justify-self-start text-muted-foreground'
                onClick={() => setCancelando(true)}
              >
                <Ban /> Cancelar este pedido
              </Button>
            )}
        </div>
      </div>

      <DialogoPago
        abierto={pagando}
        p={p}
        onCerrar={() => setPagando(false)}
        onListo={(d) => {
          poner(d)
          setPagando(false)
        }}
      />
      <DialogoDevolver
        abierto={devolviendo}
        p={p}
        onCerrar={() => setDevolviendo(false)}
        onListo={(d) => {
          poner(d)
          setDevolviendo(false)
        }}
      />
      <DialogoCancelar
        abierto={cancelando}
        p={p}
        onCerrar={() => setCancelando(false)}
        onListo={(d) => {
          poner(d)
          setCancelando(false)
        }}
      />
    </Pagina>
  )
}

function DialogoPago({
  abierto,
  p,
  onCerrar,
  onListo,
}: {
  abierto: boolean
  p: PedidoDetalle
  onCerrar: () => void
  onListo: (p: PedidoDetalle) => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-md'>
        {abierto && <FormPago p={p} onCerrar={onCerrar} onListo={onListo} />}
      </DialogContent>
    </Dialog>
  )
}

function FormPago({
  p,
  onCerrar,
  onListo,
}: {
  p: PedidoDetalle
  onCerrar: () => void
  onListo: (p: PedidoDetalle) => void
}) {
  const falta = p.total - p.pagado
  const anticipo = anticipoPendiente(p)
  const [monto, setMonto] = useState(String(anticipo || falta))
  const [metodo, setMetodo] = useState<MetodoPago | ''>('')
  const [referencia, setReferencia] = useState('')
  const [comprobante, setComprobante] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const entradaFoto = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const guardar = useMutation({
    mutationFn: () =>
      registrarPago(p.id, {
        monto: Number(monto) || 0,
        metodo,
        referencia,
        comprobanteUrl: comprobante,
      }),
    onSuccess: ({ pedido }) => {
      toast.success(
        pedido.estado !== p.estado && pedido.estado === 'en_produccion'
          ? 'Pago registrado. Lo personalizado ya entró a la cola del taller.'
          : 'Pago registrado.'
      )
      onListo(pedido)
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: mensajeDeError(e) }
      ),
  })
  const atajos = [
    ...(anticipo > 0
      ? [{ t: `Anticipo ${formatoPesos(anticipo)}`, v: anticipo }]
      : []),
    ...(falta > 0 && falta !== anticipo
      ? [{ t: `Todo lo que falta ${formatoPesos(falta)}`, v: falta }]
      : []),
  ]
  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {anticipo > 0 ? 'Cobrar anticipo' : 'Registrar un pago'}
        </DialogTitle>
        <DialogDescription>
          Anota la plata que ya recibiste. Falta por cobrar{' '}
          {formatoPesos(falta)}.
        </DialogDescription>
      </DialogHeader>
      <div className='grid gap-1.5'>
        <CampoNumero
          etiqueta='¿Cuánto pagó?'
          unidad='COP'
          valor={monto}
          onChange={setMonto}
          error={error?.campo === 'monto' ? error.mensaje : undefined}
        />
        {atajos.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            {atajos.map((a) => (
              <button
                key={a.t}
                type='button'
                onClick={() => setMonto(String(a.v))}
                className='rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent'
              >
                {a.t}
              </button>
            ))}
          </div>
        )}
      </div>
      <fieldset className='grid gap-1.5'>
        <legend className='mb-1.5 text-sm font-medium'>¿Cómo pagó?</legend>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
          {METODOS_PAGO.map((m) => (
            <button
              key={m}
              type='button'
              aria-pressed={metodo === m}
              onClick={() => setMetodo(m)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                metodo === m
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {METODOS_PAGO_INFO[m]}
            </button>
          ))}
        </div>
        {error?.campo === 'metodo' && (
          <p className='text-sm font-medium text-destructive'>
            {error.mensaje}
          </p>
        )}
      </fieldset>
      <Campo
        etiqueta='Referencia'
        ayuda='Opcional: número de la transferencia o del comprobante.'
      >
        {(id) => (
          <Input
            id={id}
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
          />
        )}
      </Campo>
      <div className='grid gap-2'>
        <input
          ref={entradaFoto}
          type='file'
          accept='image/*'
          className='hidden'
          onChange={async (e) => {
            const a = e.target.files?.[0]
            if (!a) return
            setSubiendo(true)
            try {
              setComprobante(
                await subirFoto(a, {
                  permiso: '/api/pedidos/subida',
                  carpeta: `pagos/${p.id}`,
                })
              )
            } catch (err) {
              toast.error(mensajeDeError(err))
            } finally {
              setSubiendo(false)
            }
          }}
        />
        {comprobante && (
          <img
            src={comprobante}
            alt='Comprobante'
            className='max-h-40 justify-self-start rounded-lg border object-contain'
          />
        )}
        <Button
          type='button'
          variant='outline'
          className='justify-self-start'
          disabled={subiendo}
          onClick={() => entradaFoto.current?.click()}
        >
          {subiendo ? <Loader2 className='animate-spin' /> : <ImagePlus />}
          {comprobante
            ? 'Cambiar foto del comprobante'
            : 'Foto del comprobante (opcional)'}
        </Button>
      </div>
      {error?.campo === 'comprobanteUrl' && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending || subiendo}>
          {guardar.isPending ? (
            <Loader2 className='animate-spin' />
          ) : (
            <Wallet />
          )}
          Guardar pago
        </Button>
      </DialogFooter>
    </form>
  )
}

function DialogoCancelar({
  abierto,
  p,
  onCerrar,
  onListo,
}: {
  abierto: boolean
  p: PedidoDetalle
  onCerrar: () => void
  onListo: (p: PedidoDetalle) => void
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const cancelar = useMutation({
    mutationFn: () => cancelarPedido(p.id, motivo),
    onSuccess: ({ pedido }) => {
      toast.success('El pedido quedó cancelado.')
      onListo(pedido)
    },
    onError: (e) => setError(mensajeDeError(e)),
  })
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>¿Cancelar el pedido {p.codigo}?</DialogTitle>
          <DialogDescription>
            Sus órdenes salen de la cola del taller. Lo que ya estaba impreso o
            salió del stock vuelve al stock.
            {p.pagado > 0 &&
              ` El cliente ya pagó ${formatoPesos(p.pagado)}: la devolución se registra en Cobros.`}
          </DialogDescription>
        </DialogHeader>
        <Campo etiqueta='¿Por qué se cancela?' error={error ?? undefined}>
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
          <Button variant='outline' onClick={onCerrar}>
            No, volver
          </Button>
          <Button
            variant='destructive'
            disabled={cancelar.isPending}
            onClick={() => cancelar.mutate()}
          >
            Sí, cancelar pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Notas({
  p,
  onCambio,
}: {
  p: PedidoDetalle
  onCambio: (p: PedidoDetalle) => void
}) {
  const [nota, setNota] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const guardar = useMutation({
    mutationFn: () => agregarNota(p.id, nota, visible),
    onSuccess: ({ pedido }) => {
      onCambio(pedido)
      setNota('')
      setVisible(false)
      setError(null)
      toast.success('Nota guardada.')
    },
    onError: (e) => setError(mensajeDeError(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Notas</CardTitle>
        <CardDescription>
          Para dejar recados al equipo. Si marcas la casilla, el cliente también
          la verá en su seguimiento.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className='grid gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            guardar.mutate()
          }}
        >
          <Textarea
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder='Ejemplo: el cliente pidió empaque de regalo.'
            aria-label='Nueva nota'
          />
          {error && (
            <p className='text-sm font-medium text-destructive'>{error}</p>
          )}
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-2'>
              <Checkbox
                id='nota-visible'
                checked={visible}
                onCheckedChange={(v) => setVisible(v === true)}
              />
              <Label htmlFor='nota-visible' className='font-normal'>
                El cliente puede verla
              </Label>
            </div>
            <Button
              type='submit'
              variant='outline'
              disabled={guardar.isPending || !nota.trim()}
            >
              Guardar nota
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function Historial({ p }: { p: PedidoDetalle }) {
  const nombre = (e: string | null) =>
    e
      ? (ESTADOS_PEDIDO_INFO[e as keyof typeof ESTADOS_PEDIDO_INFO]?.nombre ??
        e)
      : ''
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Historial</CardTitle>
        <CardDescription>Quién hizo qué y cuándo.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className='grid gap-3'>
          {p.historial.map((h) => (
            <li key={h.id} className='grid grid-cols-[auto_1fr] gap-3 text-sm'>
              <span className='mt-1.5 size-2 rounded-full bg-primary' />
              <div>
                <p>
                  {h.a && !h.de && h.nota ? (
                    h.nota
                  ) : h.a ? (
                    <>
                      Pasó a <strong>{nombre(h.a)}</strong>
                      {h.nota && ` — ${h.nota}`}
                    </>
                  ) : (
                    h.nota
                  )}
                </p>
                <p className='flex items-center gap-1 text-xs text-muted-foreground'>
                  {formatoDiaHora(h.creadoEn)} · {h.usuario}
                  {!h.a &&
                    (h.visibleCliente ? (
                      <span className='inline-flex items-center gap-0.5'>
                        · <Eye className='size-3' /> la ve el cliente
                      </span>
                    ) : (
                      <span className='inline-flex items-center gap-0.5'>
                        · <Lock className='size-3' /> interna
                      </span>
                    ))}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function Factura({
  p,
  puede,
  onCambio,
}: {
  p: PedidoDetalle
  puede: boolean
  onCambio: (p: PedidoDetalle) => void
}) {
  const [valor, setValor] = useState(p.numeroFactura)
  const guardar = useMutation({
    mutationFn: () => guardarFactura(p.id, valor),
    onSuccess: ({ pedido }) => {
      onCambio(pedido)
      toast.success(
        valor ? 'Número de factura guardado.' : 'Se quitó el número de factura.'
      )
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  })
  if (!puede) {
    return p.numeroFactura ? (
      <p className='text-sm text-muted-foreground'>
        Factura: {p.numeroFactura}
      </p>
    ) : null
  }
  return (
    <form
      className='grid gap-1.5 border-t pt-3'
      onSubmit={(e) => {
        e.preventDefault()
        guardar.mutate()
      }}
    >
      <Label htmlFor='factura'>Número de factura</Label>
      <div className='flex gap-2'>
        <Input
          id='factura'
          value={valor}
          placeholder='Opcional'
          onChange={(e) => setValor(e.target.value)}
        />
        <Button
          type='submit'
          variant='outline'
          disabled={guardar.isPending || valor === p.numeroFactura}
        >
          Guardar
        </Button>
      </div>
      <p className='text-xs text-muted-foreground'>
        Si emites factura electrónica por otro medio, anota aquí su número.
      </p>
    </form>
  )
}

function DialogoDevolver({
  abierto,
  p,
  onCerrar,
  onListo,
}: {
  abierto: boolean
  p: PedidoDetalle
  onCerrar: () => void
  onListo: (p: PedidoDetalle) => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-md'>
        {abierto && (
          <FormDevolver p={p} onCerrar={onCerrar} onListo={onListo} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormDevolver({
  p,
  onCerrar,
  onListo,
}: {
  p: PedidoDetalle
  onCerrar: () => void
  onListo: (p: PedidoDetalle) => void
}) {
  const cancelado = p.estado === 'cancelado'
  const [monto, setMonto] = useState(cancelado ? String(p.pagado) : '')
  const [metodo, setMetodo] = useState<MetodoPago | ''>('')
  const [motivo, setMotivo] = useState(cancelado ? 'Se canceló el pedido' : '')
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const guardar = useMutation({
    mutationFn: () =>
      devolverPlata(p.id, { monto: Number(monto) || 0, metodo, motivo }),
    onSuccess: ({ pedido }) => {
      toast.success('Devolución registrada.')
      onListo(pedido)
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: mensajeDeError(e) }
      ),
  })
  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>Devolver plata al cliente</DialogTitle>
        <DialogDescription>
          El cliente ha pagado {formatoPesos(p.pagado)}.
          {cancelado
            ? ' Como el pedido se canceló, normalmente se le devuelve todo.'
            : ' En un pedido que sigue, la devolución también baja el total del pedido (como un descuento).'}
        </DialogDescription>
      </DialogHeader>
      <CampoNumero
        etiqueta='¿Cuánto se le devuelve?'
        unidad='COP'
        valor={monto}
        onChange={setMonto}
        error={error?.campo === 'monto' ? error.mensaje : undefined}
      />
      <fieldset className='grid gap-1.5'>
        <legend className='mb-1.5 text-sm font-medium'>
          ¿Cómo se le devuelve?
        </legend>
        <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
          {METODOS_PAGO.map((m) => (
            <button
              key={m}
              type='button'
              aria-pressed={metodo === m}
              onClick={() => setMetodo(m)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                metodo === m
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {METODOS_PAGO_INFO[m]}
            </button>
          ))}
        </div>
        {error?.campo === 'metodo' && (
          <p className='text-sm font-medium text-destructive'>
            {error.mensaje}
          </p>
        )}
      </fieldset>
      <Campo
        etiqueta='¿Por qué?'
        error={error?.campo === 'motivo' ? error.mensaje : undefined}
      >
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        )}
      </Campo>
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          <Undo2 /> Registrar devolución
        </Button>
      </DialogFooter>
    </form>
  )
}

const ES_PRUEBA = import.meta.env.VITE_DEMO === '1'

/** Código y enlace público para que el cliente vea su pedido sin login. */
function EnlaceSeguimiento({ p }: { p: PedidoDetalle }) {
  const enlace = `${window.location.origin}/seguimiento/${p.seguimiento}`
  const primerNombre = p.cliente.nombre.split(' ')[0]
  const mensaje = `Hola ${primerNombre}, aquí puedes ver en qué va tu pedido de Hecho en Capas: ${enlace}`
  return (
    <div className='grid gap-2'>
      <span className='justify-self-start rounded-md bg-muted px-2 py-1 font-mono text-base font-semibold tracking-wider'>
        {p.seguimiento}
      </span>
      <div className='flex flex-wrap gap-2'>
        {p.cliente.whatsapp && !ES_PRUEBA && (
          <Button size='sm' asChild>
            <a
              href={enlaceWhatsapp(p.cliente.whatsapp, mensaje)}
              target='_blank'
              rel='noreferrer'
            >
              <MessageCircle /> Enviar por WhatsApp
            </a>
          </Button>
        )}
        {!ES_PRUEBA && (
          <Button
            size='sm'
            variant='outline'
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(enlace)
                toast.success(
                  'Enlace copiado. Pégalo en el chat con el cliente.'
                )
              } catch {
                toast.info(enlace)
              }
            }}
          >
            <Copy /> Copiar enlace
          </Button>
        )}
        <Button size='sm' variant='ghost' asChild>
          <Link to='/seguimiento/$codigo' params={{ codigo: p.seguimiento }}>
            <Eye /> Ver como lo ve el cliente
          </Link>
        </Button>
      </div>
      <p className='text-xs text-muted-foreground'>
        {ES_PRUEBA
          ? 'En la versión de prueba no hay enlace para compartir; en el sistema real sí.'
          : 'El cliente ve los pasos, la fecha y lo que falta por pagar. No ve costos ni notas internas.'}
      </p>
    </div>
  )
}
