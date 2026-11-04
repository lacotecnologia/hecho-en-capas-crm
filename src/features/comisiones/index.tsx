import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  METODOS_COMISION,
  METODOS_COMISION_INFO,
  type MetodoComision,
  type MovimientoComision,
  type PagoComision,
  type PedidoPorGanar,
  type ResumenComisiones,
  TIPOS_MOVIMIENTO_INFO,
} from '@shared/comisiones'
import { type EstadoPedido } from '@shared/pedidos'
import { HandCoins, ImagePlus, Loader2, Scale, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { tieneRol, useSesion } from '@/lib/sesion'
import { subirFoto } from '@/lib/subir-foto'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Campo, CampoNumero } from '@/components/campo'
import { Pagina } from '@/components/layout/pagina'
import { EstadoPedidoBadge } from '@/features/pedidos/estado'
import { formatoPesos } from '@/features/taller/formato'
import {
  ajustarComision,
  consultaComisiones,
  consultaMisComisiones,
  HAY_COMISIONES,
  pagarComision,
} from './api'

const fecha = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))

/** "+ $ 4.000" / "− $ 4.000" */
/** Saldo con el signo menos adelante: "−$ 5.000". */
const saldo = (n: number) => (n < 0 ? `−${formatoPesos(-n)}` : formatoPesos(n))

const conSigno = (n: number) =>
  `${n < 0 ? '−' : '+'} ${formatoPesos(Math.abs(n))}`

export function PantallaComisiones() {
  const yo = useSesion()
  const esAdmin = tieneRol(yo, ['admin'])
  return (
    <Pagina
      titulo={esAdmin ? 'Comisiones' : 'Mis comisiones'}
      descripcion={
        esAdmin
          ? 'Lo que se le debe a cada comercial. Tú decides cuándo pagar.'
          : 'Tu ganancia por cada venta: ganas la comisión cuando el pedido queda Cerrado.'
      }
    >
      {!HAY_COMISIONES ? (
        <p className='text-muted-foreground'>
          La versión de prueba no maneja comisiones.
        </p>
      ) : esAdmin ? (
        <VistaAdmin />
      ) : (
        <MisComisiones />
      )}
    </Pagina>
  )
}

// ===================== Piezas =====================

function Cifra({
  titulo,
  valor,
  ayuda,
  tono,
}: {
  titulo: string
  valor: number
  ayuda: string
  tono?: 'ambar'
}) {
  return (
    <Card className={cn('gap-1 py-4', tono === 'ambar' && 'bg-marca-ambar/10')}>
      <CardContent className='px-4'>
        <p className='text-sm text-muted-foreground'>{titulo}</p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums',
            valor < 0 && 'text-destructive'
          )}
        >
          {saldo(valor)}
        </p>
        <p className='text-xs text-muted-foreground'>{ayuda}</p>
      </CardContent>
    </Card>
  )
}

function Seccion({
  titulo,
  ayuda,
  children,
}: {
  titulo: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <section className='grid gap-2'>
      <div>
        <h2 className='font-semibold'>{titulo}</h2>
        {ayuda && <p className='text-sm text-muted-foreground'>{ayuda}</p>}
      </div>
      {children}
    </section>
  )
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className='rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground'>
      {texto}
    </p>
  )
}

/** Las notas que pone el sistema solas no se repiten (ya lo dice el tipo). */
const notaVisible = (m: MovimientoComision) =>
  !!m.nota &&
  (m.tipo === 'ajuste' ||
    !/^(Pedido .+ cerrado|Devolución al cliente en )/.test(m.nota))

function Movimientos({ movs }: { movs: MovimientoComision[] }) {
  return (
    <ul className='divide-y rounded-lg border'>
      {movs.map((m) => (
        <li
          key={m.id}
          className='flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5'
        >
          <div className='min-w-0 flex-1 basis-48'>
            <p className='text-sm font-medium'>
              {m.pedido ? (
                <Link
                  to='/pedidos/$id'
                  params={{ id: String(m.pedido.id) }}
                  className='underline-offset-2 hover:underline'
                >
                  {m.pedido.codigo} · {m.pedido.cliente}
                </Link>
              ) : (
                TIPOS_MOVIMIENTO_INFO[m.tipo]
              )}
            </p>
            <p className='text-xs text-muted-foreground'>
              {m.pedido ? `${TIPOS_MOVIMIENTO_INFO[m.tipo]} · ` : ''}
              {notaVisible(m) ? `${m.nota} · ` : ''}
              {fecha(m.creadoEn)}
            </p>
          </div>
          <span
            className={cn(
              'font-semibold tabular-nums',
              m.monto < 0 ? 'text-destructive' : 'text-primary'
            )}
          >
            {conSigno(m.monto)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function PedidosEnCamino({ pedidos }: { pedidos: PedidoPorGanar[] }) {
  return (
    <ul className='divide-y rounded-lg border'>
      {pedidos.map((p) => (
        <li key={p.id} className='flex items-center gap-3 px-3 py-2.5'>
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1'>
            <Link
              to='/pedidos/$id'
              params={{ id: String(p.id) }}
              className='text-sm font-medium underline-offset-2 hover:underline'
            >
              {p.codigo} · {p.cliente}
            </Link>
            <EstadoPedidoBadge estado={p.estado as EstadoPedido} />
          </div>
          <span className='shrink-0 font-semibold text-muted-foreground tabular-nums'>
            {formatoPesos(p.ganancia)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Pagos({ pagos }: { pagos: PagoComision[] }) {
  return (
    <ul className='grid gap-2'>
      {pagos.map((p) => (
        <li key={p.id} className='rounded-lg border'>
          <details className='group'>
            <summary className='flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5'>
              <div className='min-w-0 flex-1 basis-48'>
                <p className='text-sm font-medium'>
                  {fecha(p.creadoEn)} · {METODOS_COMISION_INFO[p.metodo]}
                </p>
                <p className='text-xs text-muted-foreground'>
                  Pagó {p.pagadoPor}
                  {p.referencia ? ` · Ref. ${p.referencia}` : ''} ·{' '}
                  {p.movimientos.length}{' '}
                  {p.movimientos.length === 1 ? 'movimiento' : 'movimientos'}
                  <span className='group-open:hidden'> · Ver detalle</span>
                </p>
              </div>
              <span className='font-semibold tabular-nums'>
                {formatoPesos(p.total)}
              </span>
            </summary>
            <div className='grid gap-2 border-t px-3 py-3'>
              {p.nota && <p className='text-sm'>{p.nota}</p>}
              {p.comprobanteUrl && (
                <a
                  href={p.comprobanteUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='text-sm font-medium text-primary underline-offset-2 hover:underline'
                >
                  Ver comprobante
                </a>
              )}
              <Movimientos movs={p.movimientos} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  )
}

function Cargando() {
  return (
    <div className='grid gap-3'>
      {[0, 1].map((i) => (
        <Skeleton key={i} className='h-40 rounded-xl' />
      ))}
    </div>
  )
}

// ===================== El comercial =====================

function MisComisiones() {
  const { data: r, isLoading } = useQuery(consultaMisComisiones)
  if (isLoading || !r) return <Cargando />
  return (
    <div className='grid gap-6'>
      <div className='grid gap-3 sm:grid-cols-3'>
        <Cifra
          titulo='Por cobrar'
          valor={r.porPagar}
          ayuda='Pedidos cerrados que todavía no te han pagado'
          tono='ambar'
        />
        <Cifra
          titulo='Por ganar'
          valor={r.porGanar}
          ayuda='Pedidos en camino: la ganas cuando se cierren'
        />
        <Cifra
          titulo='Te pagaron este mes'
          valor={r.pagadoMes}
          ayuda='Suma de los pagos de comisión del mes'
        />
      </div>
      {r.porPagar < 0 && (
        <p className='rounded-lg bg-destructive/10 px-4 py-3 text-sm'>
          Los descuentos por devoluciones superan lo ganado. Se compensan con
          tus próximas comisiones.
        </p>
      )}
      <Seccion
        titulo='Lo que te deben'
        ayuda='Se suma solo cuando un pedido tuyo queda Cerrado.'
      >
        {r.pendientes.length ? (
          <Movimientos movs={r.pendientes} />
        ) : (
          <Vacio texto='No te deben nada por ahora.' />
        )}
      </Seccion>
      <Seccion
        titulo='Pedidos en camino'
        ayuda='Tu ganancia en cada uno. Pasa a “Por cobrar” cuando el pedido se cierre.'
      >
        {r.pedidosPorGanar.length ? (
          <PedidosEnCamino pedidos={r.pedidosPorGanar} />
        ) : (
          <Vacio texto='No tienes pedidos abiertos con ganancia.' />
        )}
      </Seccion>
      <Seccion titulo='Pagos que recibiste'>
        {r.pagos.length ? (
          <Pagos pagos={r.pagos} />
        ) : (
          <Vacio texto='Todavía no hay pagos de comisión.' />
        )}
      </Seccion>
    </div>
  )
}

// ===================== El administrador =====================

function VistaAdmin() {
  const { data: lista, isLoading } = useQuery(consultaComisiones)
  if (isLoading || !lista) return <Cargando />
  if (lista.length === 0) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center gap-2 py-10 text-center'>
          <HandCoins className='size-10 text-muted-foreground/50' />
          <p className='font-medium'>No hay comerciales con comisión.</p>
          <p className='max-w-sm text-sm text-muted-foreground'>
            En Personas, dale el rol Comercial a quien vende. Su comisión se
            anota sola cuando sus pedidos quedan Cerrados.
          </p>
        </CardContent>
      </Card>
    )
  }
  const totalDeuda = lista.reduce((s, r) => s + Math.max(0, r.porPagar), 0)
  return (
    <div className='grid gap-6'>
      <div className='grid gap-3 sm:grid-cols-3'>
        <Cifra
          titulo='Por pagar en total'
          valor={totalDeuda}
          ayuda='Comisiones ganadas que aún no has pagado'
          tono='ambar'
        />
        <Cifra
          titulo='Por ganar en total'
          valor={lista.reduce((s, r) => s + r.porGanar, 0)}
          ayuda='Ganancia de pedidos que todavía no se cierran'
        />
        <Cifra
          titulo='Pagado este mes'
          valor={lista.reduce((s, r) => s + r.pagadoMes, 0)}
          ayuda='Todo lo que pagaste en comisiones este mes'
        />
      </div>
      {lista.map((r) => (
        <TarjetaComercial key={r.comercial.id} r={r} />
      ))}
    </div>
  )
}

function TarjetaComercial({ r }: { r: ResumenComisiones }) {
  const [dialogo, setDialogo] = useState<'pagar' | 'ajuste' | null>(null)
  return (
    <Card className='py-4'>
      <CardContent className='grid gap-4 px-4'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <p className='flex items-center gap-2 text-lg font-semibold'>
              {r.comercial.nombre}
              {!r.comercial.activo && (
                <Badge variant='secondary'>Ya no entra</Badge>
              )}
            </p>
            <p className='text-sm text-muted-foreground'>
              Por ganar {formatoPesos(r.porGanar)} · Pagado este mes{' '}
              {formatoPesos(r.pagadoMes)}
            </p>
          </div>
          <div className='sm:text-end'>
            <p className='text-sm text-muted-foreground'>Por pagar</p>
            <p
              className={cn(
                'text-2xl font-bold tabular-nums',
                r.porPagar < 0 && 'text-destructive'
              )}
            >
              {saldo(r.porPagar)}
            </p>
          </div>
        </div>
        {r.porPagar < 0 && (
          <p className='rounded-lg bg-destructive/10 px-3 py-2 text-sm'>
            Los descuentos superan lo ganado. Se compensa solo con sus próximas
            comisiones.
          </p>
        )}
        <div className='flex flex-col gap-2 sm:flex-row'>
          <Button
            size='lg'
            disabled={r.porPagar <= 0}
            onClick={() => setDialogo('pagar')}
          >
            <Wallet />
            {r.porPagar > 0
              ? `Pagar ${formatoPesos(r.porPagar)}`
              : 'Nada por pagar'}
          </Button>
          <Button
            size='lg'
            variant='outline'
            onClick={() => setDialogo('ajuste')}
          >
            <Scale />
            Hacer un ajuste
          </Button>
        </div>
        <Seccion titulo='Pendiente de pagar'>
          {r.pendientes.length ? (
            <Movimientos movs={r.pendientes} />
          ) : (
            <Vacio texto='Está al día.' />
          )}
        </Seccion>
        {r.pedidosPorGanar.length > 0 && (
          <details>
            <summary className='cursor-pointer text-sm font-medium'>
              Pedidos en camino ({r.pedidosPorGanar.length})
            </summary>
            <div className='mt-2'>
              <PedidosEnCamino pedidos={r.pedidosPorGanar} />
            </div>
          </details>
        )}
        {r.pagos.length > 0 && (
          <details>
            <summary className='cursor-pointer text-sm font-medium'>
              Pagos anteriores ({r.pagos.length})
            </summary>
            <div className='mt-2'>
              <Pagos pagos={r.pagos} />
            </div>
          </details>
        )}
      </CardContent>
      <Dialog
        open={dialogo !== null}
        onOpenChange={(v) => !v && setDialogo(null)}
      >
        <DialogContent className='max-h-[90dvh] overflow-y-auto sm:max-w-md'>
          {dialogo === 'pagar' && (
            <FormPagar r={r} onCerrar={() => setDialogo(null)} />
          )}
          {dialogo === 'ajuste' && (
            <FormAjuste r={r} onCerrar={() => setDialogo(null)} />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

type ErrorForm = { mensaje: string; campo?: string } | null

const comoError = (e: unknown): ErrorForm =>
  e instanceof ApiError
    ? { mensaje: e.message, campo: e.campo }
    : { mensaje: mensajeDeError(e) }

function ErrorCampo({ error, campo }: { error: ErrorForm; campo?: string }) {
  if (!error || error.campo !== campo) return null
  return (
    <p className='text-sm font-medium text-destructive' role='alert'>
      {error.mensaje}
    </p>
  )
}

function FormPagar({
  r,
  onCerrar,
}: {
  r: ResumenComisiones
  onCerrar: () => void
}) {
  const queryClient = useQueryClient()
  const [metodo, setMetodo] = useState<MetodoComision | ''>('')
  const [referencia, setReferencia] = useState('')
  const [nota, setNota] = useState('')
  const [comprobante, setComprobante] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const entradaFoto = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<ErrorForm>(null)
  const nombre = r.comercial.nombre.split(' ')[0]
  const pedidos = r.pendientes.filter((m) => m.tipo === 'ganada').length
  const descuentos = r.pendientes.filter((m) => m.monto < 0).length
  const pagar = useMutation({
    mutationFn: () =>
      pagarComision(r.comercial.id, {
        metodo: metodo as MetodoComision,
        referencia,
        comprobanteUrl: comprobante,
        nota,
        total: r.porPagar,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comisiones'] })
      queryClient.invalidateQueries({ queryKey: ['inicio'] })
      queryClient.invalidateQueries({ queryKey: ['reportes'] })
      toast.success(
        `Listo: le pagaste ${formatoPesos(r.porPagar)} a ${nombre}.`
      )
      onCerrar()
    },
    onError: (e) => {
      const err = comoError(e)
      setError(err)
      // Si lo pendiente cambió, traemos el valor nuevo
      if (err?.campo === 'total')
        queryClient.invalidateQueries({ queryKey: ['comisiones'] })
    },
  })
  const porFuera = metodo === 'por_fuera'
  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        pagar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          Pagarle {formatoPesos(r.porPagar)} a {nombre}
        </DialogTitle>
        <DialogDescription>
          Se paga todo lo pendiente: {pedidos}{' '}
          {pedidos === 1 ? 'pedido cerrado' : 'pedidos cerrados'}
          {descuentos > 0
            ? `, menos ${descuentos} ${descuentos === 1 ? 'descuento' : 'descuentos'}`
            : ''}
          . Queda en el historial de los dos.
        </DialogDescription>
      </DialogHeader>
      <fieldset className='grid gap-1.5'>
        <legend className='mb-1.5 text-sm font-medium'>
          ¿Cómo le pagaste?
        </legend>
        <div className='grid grid-cols-2 gap-2'>
          {METODOS_COMISION.map((m) => (
            <button
              key={m}
              type='button'
              aria-pressed={metodo === m}
              onClick={() => setMetodo(m)}
              className={cn(
                'min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                m === 'por_fuera' && 'col-span-2',
                metodo === m
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {METODOS_COMISION_INFO[m]}
            </button>
          ))}
        </div>
        <p className='text-xs text-muted-foreground'>
          “Ya se pagó por fuera” es para lo que pagaste antes de usar el
          sistema: lo deja en cero sin mover plata.
        </p>
        <ErrorCampo error={error} campo='metodo' />
      </fieldset>
      {!porFuera && (
        <>
          <Campo
            etiqueta='Referencia'
            ayuda={
              metodo === 'efectivo'
                ? 'Opcional en efectivo.'
                : 'Número de la transferencia. Si no lo tienes, sube la foto del comprobante.'
            }
            error={error?.campo === 'referencia' ? error.mensaje : undefined}
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
                      permiso: '/api/comisiones/subida',
                      carpeta: `comisiones/${r.comercial.id}`,
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
                : 'Foto del comprobante'}
            </Button>
          </div>
        </>
      )}
      <Campo etiqueta='Nota' ayuda='Opcional: algo que quieras recordar.'>
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        )}
      </Campo>
      <ErrorCampo error={error} campo='total' />
      <ErrorCampo error={error} campo={undefined} />
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={pagar.isPending || subiendo}>
          {pagar.isPending ? <Loader2 className='animate-spin' /> : <Wallet />}
          {porFuera ? 'Dejar en cero' : `Pagar ${formatoPesos(r.porPagar)}`}
        </Button>
      </DialogFooter>
    </form>
  )
}

function FormAjuste({
  r,
  onCerrar,
}: {
  r: ResumenComisiones
  onCerrar: () => void
}) {
  const queryClient = useQueryClient()
  const [sentido, setSentido] = useState<'favor' | 'contra'>('favor')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [error, setError] = useState<ErrorForm>(null)
  const nombre = r.comercial.nombre.split(' ')[0]
  const valor = (Number(monto) || 0) * (sentido === 'favor' ? 1 : -1)
  const guardar = useMutation({
    mutationFn: () => ajustarComision(r.comercial.id, { monto: valor, nota }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comisiones'] })
      toast.success('Ajuste guardado.')
      onCerrar()
    },
    onError: (e) => setError(comoError(e)),
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
        <DialogTitle>Ajuste a la comisión de {nombre}</DialogTitle>
        <DialogDescription>
          Para corregir algo a mano. {nombre} lo ve con el motivo que escribas.
        </DialogDescription>
      </DialogHeader>
      <div className='grid grid-cols-2 gap-2'>
        {(
          [
            ['favor', 'A su favor (suma)'],
            ['contra', 'En su contra (resta)'],
          ] as const
        ).map(([v, t]) => (
          <button
            key={v}
            type='button'
            aria-pressed={sentido === v}
            onClick={() => setSentido(v)}
            className={cn(
              'min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              sentido === v
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-accent'
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <CampoNumero
        etiqueta='Valor'
        unidad='COP'
        valor={monto}
        onChange={(v) => setMonto(v.replace('-', ''))}
        ayuda={
          valor !== 0
            ? `Lo por pagar queda en ${saldo(r.porPagar + valor)}.`
            : `Hoy tiene ${saldo(r.porPagar)} por pagar.`
        }
        error={error?.campo === 'monto' ? error.mensaje : undefined}
      />
      <Campo
        etiqueta='Motivo'
        ayuda='Por qué haces el ajuste. Queda en el historial.'
        error={error?.campo === 'nota' ? error.mensaje : undefined}
      >
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        )}
      </Campo>
      <ErrorCampo error={error} campo={undefined} />
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          {guardar.isPending ? <Loader2 className='animate-spin' /> : <Scale />}
          Guardar ajuste
        </Button>
      </DialogFooter>
    </form>
  )
}
