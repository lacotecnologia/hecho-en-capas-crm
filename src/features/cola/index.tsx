import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  type EstadoOrden,
  ESTADOS_ORDEN_INFO,
  type OrdenCola,
  sumarHoras,
} from '@shared/pedidos'
import {
  AlertTriangle,
  Box,
  CheckCircle2,
  Loader2,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { tieneRol, useSesion } from '@/lib/sesion'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Campo, CampoNumero } from '@/components/campo'
import { BotonesColor, EtiquetaColor } from '@/components/color'
import { Pagina } from '@/components/layout/pagina'
import {
  accionOrden,
  consultaCola,
  type ImpresoraCola,
  ordenParaStock,
  quitarOrden,
} from '@/features/pedidos/api'
import {
  formatoHora,
  textoCompromiso,
  textoHoras,
} from '@/features/pedidos/fechas'
import { consultaBobinas, consultaProductos } from '@/features/taller/api'

/** Re-dibuja cada 30 s para que las barras de tiempo avancen. */
function useAhora() {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return ahora
}

const COLUMNAS: { estado: EstadoOrden; titulo: string; vacio: string }[] = [
  {
    estado: 'en_cola',
    titulo: 'En cola',
    vacio: 'No hay nada esperando. ¡Al día!',
  },
  { estado: 'postproceso', titulo: 'Terminando', vacio: 'Nada por terminar.' },
  {
    estado: 'listo',
    titulo: 'Listos esta semana',
    vacio: 'Aún no hay nada listo esta semana.',
  },
]

export function ColaImpresion() {
  const usuario = useSesion()
  const taller = tieneRol(usuario, ['admin', 'fabricacion'])
  const { data, isLoading } = useQuery(consultaCola)
  const ahora = useAhora()
  const [empezando, setEmpezando] = useState<{
    orden: OrdenCola
    impresoraId?: number
  } | null>(null)
  const [fallando, setFallando] = useState<OrdenCola | null>(null)
  const [paraStock, setParaStock] = useState(false)
  const [columna, setColumna] = useState<EstadoOrden>('en_cola')

  const ordenes = data?.ordenes ?? []
  const impresoras = (data?.impresoras ?? []).filter((i) => i.activa)
  const porEstado = (e: EstadoOrden) => ordenes.filter((o) => o.estado === e)

  return (
    <Pagina
      titulo='Cola de impresión'
      descripcion='Qué se imprime ahora, qué sigue y qué ya está listo. Lo primero de la cola es lo que hay que entregar antes. Se actualiza sola.'
      acciones={
        taller && (
          <Button
            variant='outline'
            size='lg'
            onClick={() => setParaStock(true)}
          >
            <Plus /> Imprimir para stock
          </Button>
        )
      }
    >
      {isLoading && <Skeleton className='h-80 rounded-xl' />}
      {data && (
        <div className='grid gap-8'>
          {/* Impresoras ahora */}
          <section aria-labelledby='titulo-impresoras' className='grid gap-3'>
            <h2 id='titulo-impresoras' className='text-lg font-semibold'>
              Impresoras ahora
            </h2>
            <div className='grid gap-4 md:grid-cols-2'>
              {impresoras.map((imp) => (
                <TarjetaImpresora
                  key={imp.id}
                  imp={imp}
                  orden={ordenes.find(
                    (o) =>
                      o.estado === 'imprimiendo' && o.impresoraId === imp.id
                  )}
                  siguiente={porEstado('en_cola').find(
                    (o) => !o.producto.multicolor || imp.multicolor
                  )}
                  hayEnCola={porEstado('en_cola').length > 0}
                  ahora={ahora}
                  taller={taller}
                  onEmpezar={(o) =>
                    setEmpezando({ orden: o, impresoraId: imp.id })
                  }
                  onFallo={setFallando}
                />
              ))}
            </div>
          </section>

          {/* Tablero */}
          <section aria-label='Tablero de órdenes' className='grid gap-3'>
            <div
              className='flex gap-2 lg:hidden'
              role='tablist'
              aria-label='Columna'
            >
              {COLUMNAS.map((col) => (
                <button
                  key={col.estado}
                  type='button'
                  role='tab'
                  aria-selected={columna === col.estado}
                  onClick={() => setColumna(col.estado)}
                  className={cn(
                    'flex-1 rounded-full border px-3 py-2 text-sm transition-colors',
                    columna === col.estado
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  {col.titulo.replace(' esta semana', '')}
                  <span className='ms-1 tabular-nums opacity-70'>
                    {porEstado(col.estado).length}
                  </span>
                </button>
              ))}
            </div>
            <div className='grid gap-4 lg:grid-cols-3 lg:items-start'>
              {COLUMNAS.map((col) => {
                const lista = porEstado(col.estado)
                return (
                  <div
                    key={col.estado}
                    className={cn(
                      'content-start gap-3 rounded-xl bg-muted/50 p-3 lg:grid',
                      columna === col.estado ? 'grid' : 'hidden'
                    )}
                  >
                    <h3 className='hidden items-center justify-between px-1 font-semibold lg:flex'>
                      {col.titulo}
                      <span className='rounded-full bg-background px-2 text-sm tabular-nums'>
                        {lista.length}
                      </span>
                    </h3>
                    <p className='px-1 text-xs text-muted-foreground'>
                      {ESTADOS_ORDEN_INFO[col.estado].ayuda}
                    </p>
                    {lista.length === 0 && (
                      <p className='rounded-lg border border-dashed bg-background/60 p-4 text-center text-sm text-muted-foreground'>
                        {col.vacio}
                      </p>
                    )}
                    {lista.map((o) => (
                      <TarjetaOrden
                        key={o.id}
                        o={o}
                        taller={taller}
                        onEmpezar={() => setEmpezando({ orden: o })}
                        onFallo={() => setFallando(o)}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      )}

      {data && (
        <DialogoEmpezar
          datos={empezando}
          impresoras={impresoras}
          ordenes={ordenes}
          onCerrar={() => setEmpezando(null)}
        />
      )}
      <DialogoFallo orden={fallando} onCerrar={() => setFallando(null)} />
      <DialogoStock abierto={paraStock} onCerrar={() => setParaStock(false)} />
    </Pagina>
  )
}

function useAccion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (a: {
      id: number
      accion: Parameters<typeof accionOrden>[1]
      body?: unknown
    }) => accionOrden(a.id, a.accion, a.body),
    onSuccess: ({ orden }, a) => {
      queryClient.invalidateQueries({ queryKey: ['cola'] })
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      if (orden.pedido)
        queryClient.invalidateQueries({ queryKey: ['pedido', orden.pedido.id] })
      if (a.accion === 'listo' && !orden.pedido)
        queryClient.invalidateQueries({ queryKey: ['taller'] })
      const txt: Record<string, string> = {
        empezar: `Empezó: ${orden.producto.nombre}.`,
        terminar: 'Salió de la impresora. Ahora a terminarlo y empacarlo.',
        listo: orden.pedido
          ? `Listo: ${orden.producto.nombre} para ${orden.pedido.cliente}.`
          : `Listo: ${orden.cantidad} ${orden.producto.nombre} entraron al stock.`,
        fallo: 'Quedó de nuevo en la cola para volver a imprimirlo.',
        devolver: 'Volvió a la cola.',
      }
      toast.success(txt[a.accion])
    },
    onError: (e) => {
      queryClient.invalidateQueries({ queryKey: ['cola'] })
      toast.error(mensajeDeError(e))
    },
  })
}

function Miniatura({ o }: { o: OrdenCola }) {
  return (
    <div className='size-14 shrink-0 overflow-hidden rounded-lg bg-muted'>
      {o.producto.imagen ? (
        <img
          src={o.producto.imagen}
          alt=''
          className='size-full object-contain p-1'
        />
      ) : (
        <Box className='m-auto mt-4 size-5 text-muted-foreground' />
      )}
    </div>
  )
}

function ParaQuien({ o }: { o: OrdenCola }) {
  if (!o.pedido)
    return <span className='text-muted-foreground'>Para stock</span>
  return (
    <Link
      to='/pedidos/$id'
      params={{ id: String(o.pedido.id) }}
      className='underline-offset-2 hover:underline'
    >
      {o.pedido.cliente} · {o.pedido.codigo}
    </Link>
  )
}

function TarjetaImpresora({
  imp,
  orden: o,
  siguiente,
  hayEnCola,
  ahora,
  taller,
  onEmpezar,
  onFallo,
}: {
  imp: ImpresoraCola
  orden?: OrdenCola
  siguiente?: OrdenCola
  hayEnCola: boolean
  ahora: number
  taller: boolean
  onEmpezar: (o: OrdenCola) => void
  onFallo: (o: OrdenCola) => void
}) {
  const accion = useAccion()
  const inicio = o?.inicio ? new Date(o.inicio).getTime() : 0
  const fin = o?.finEstimado ? new Date(o.finEstimado).getTime() : 0
  const avance =
    o && fin > inicio
      ? Math.min(1, Math.max(0, (ahora - inicio) / (fin - inicio)))
      : 0
  const pasado = o && fin > 0 && ahora > fin

  return (
    <Card className={cn('gap-3 py-4', o && 'border-marca-lima')}>
      <CardContent className='grid gap-3 px-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <Printer className='size-5 text-primary' />
          <p className='min-w-0 flex-1 basis-40 font-semibold'>{imp.nombre}</p>
          <Badge variant='outline'>
            {imp.multicolor ? 'Varios colores' : 'Un color'}
          </Badge>
          <Badge
            className={
              o
                ? 'bg-marca-lima/35 text-foreground'
                : 'bg-muted text-muted-foreground'
            }
          >
            {o ? 'Imprimiendo' : 'Libre'}
          </Badge>
        </div>
        {o ? (
          <>
            <div className='flex items-center gap-3'>
              <Miniatura o={o} />
              <div className='min-w-0 flex-1'>
                <p className='font-medium'>
                  {o.producto.nombre}{' '}
                  <span className='text-muted-foreground'>× {o.cantidad}</span>
                </p>
                {o.color && (
                  <EtiquetaColor
                    color={`En ${o.color.color}`}
                    colorHex={o.color.colorHex}
                    className='mt-0.5'
                  />
                )}
                <p className='text-sm'>
                  <ParaQuien o={o} />
                </p>
              </div>
            </div>
            <div className='grid gap-1'>
              <div
                className='h-2 overflow-hidden rounded-full bg-muted'
                role='progressbar'
                aria-label='Avance estimado'
                aria-valuenow={Math.round(avance * 100)}
              >
                <div
                  className={cn(
                    'h-full rounded-full',
                    pasado ? 'bg-marca-naranja' : 'bg-primary'
                  )}
                  style={{ width: `${avance * 100}%` }}
                />
              </div>
              <p className='flex justify-between text-xs text-muted-foreground'>
                <span>Empezó {formatoHora(o.inicio!)}</span>
                <span
                  className={cn(pasado && 'font-medium text-marca-naranja')}
                >
                  {pasado
                    ? 'Ya debió terminar'
                    : `Termina ~${formatoHora(o.finEstimado!)}`}
                </span>
              </p>
            </div>
            {taller && (
              <div className='flex flex-wrap gap-2'>
                <Button
                  disabled={accion.isPending}
                  onClick={() =>
                    accion.mutate({ id: o.id, accion: 'terminar' })
                  }
                >
                  <CheckCircle2 /> Terminó de imprimir
                </Button>
                <Button variant='outline' onClick={() => onFallo(o)}>
                  <AlertTriangle /> Falló
                </Button>
                <Button
                  variant='ghost'
                  className='text-muted-foreground'
                  disabled={accion.isPending}
                  onClick={() =>
                    accion.mutate({ id: o.id, accion: 'devolver' })
                  }
                >
                  <Undo2 /> La empecé por error
                </Button>
              </div>
            )}
          </>
        ) : siguiente ? (
          <div className='flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3'>
            <div className='min-w-0 flex-1 text-sm'>
              <p className='text-muted-foreground'>
                Lo siguiente que puede imprimir:
              </p>
              <p className='font-medium'>
                {siguiente.producto.nombre} × {siguiente.cantidad}
                {siguiente.color && ` en ${siguiente.color.color}`}
              </p>
            </div>
            {taller && (
              <Button onClick={() => onEmpezar(siguiente)}>
                <Play /> Empezar aquí
              </Button>
            )}
          </div>
        ) : (
          <p className='text-sm text-muted-foreground'>
            {hayEnCola
              ? 'Libre. Lo que hay en la cola es de varios colores: va en una impresora multicolor.'
              : 'Libre. No hay nada en la cola.'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function TarjetaOrden({
  o,
  taller,
  onEmpezar,
  onFallo,
}: {
  o: OrdenCola
  taller: boolean
  onEmpezar: () => void
  onFallo: () => void
}) {
  const accion = useAccion()
  const queryClient = useQueryClient()
  const compromiso =
    o.estado !== 'listo' ? textoCompromiso(o.fechaCompromiso) : null
  return (
    <Card className='gap-2 py-3'>
      <CardContent className='grid gap-2 px-3'>
        <div className='flex items-start gap-3'>
          <Miniatura o={o} />
          <div className='min-w-0 flex-1'>
            <p className='leading-snug font-medium'>
              {o.producto.nombre}{' '}
              <span className='text-muted-foreground'>× {o.cantidad}</span>
            </p>
            {o.color && (
              <EtiquetaColor
                color={`En ${o.color.color}`}
                colorHex={o.color.colorHex}
                className='my-0.5'
              />
            )}
            <p className='text-sm'>
              <ParaQuien o={o} />
            </p>
            <p className='text-xs text-muted-foreground'>
              {o.camas} {o.camas === 1 ? 'impresión' : 'impresiones'} ·{' '}
              {textoHoras(o.horas)}
              {o.producto.multicolor && ' · varios colores'}
            </p>
          </div>
        </div>
        {compromiso && (
          <p
            className={cn(
              'text-xs font-medium',
              compromiso.tono === 'tarde'
                ? 'text-destructive'
                : compromiso.tono === 'pronto'
                  ? 'text-marca-naranja'
                  : 'text-muted-foreground'
            )}
          >
            Entrega {compromiso.texto}
          </p>
        )}
        {o.intentos > 0 && o.motivoFalla && o.estado === 'en_cola' && (
          <p className='flex items-start gap-1.5 rounded-md bg-marca-naranja/10 px-2 py-1 text-xs'>
            <RotateCcw className='mt-0.5 size-3 shrink-0' />
            Falló antes: {o.motivoFalla}
            {o.gramosPerdidos > 0 && ` (${o.gramosPerdidos} g perdidos)`}
          </p>
        )}
        {taller && o.estado === 'en_cola' && (
          <div className='flex gap-2'>
            <Button size='sm' className='flex-1' onClick={onEmpezar}>
              <Play /> Empezar a imprimir
            </Button>
            {!o.pedido && (
              <Button
                size='sm'
                variant='ghost'
                aria-label='Quitar de la cola'
                onClick={async () => {
                  try {
                    await quitarOrden(o.id)
                    queryClient.invalidateQueries({ queryKey: ['cola'] })
                    toast.success('Se quitó de la cola.')
                  } catch (e) {
                    toast.error(mensajeDeError(e))
                  }
                }}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        )}
        {taller && o.estado === 'postproceso' && (
          <div className='flex gap-2'>
            <Button
              size='sm'
              className='flex-1'
              disabled={accion.isPending}
              onClick={() => accion.mutate({ id: o.id, accion: 'listo' })}
            >
              <CheckCircle2 /> Ya está listo
            </Button>
            <Button size='sm' variant='outline' onClick={onFallo}>
              Falló
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DialogoEmpezar({
  datos,
  impresoras,
  ordenes,
  onCerrar,
}: {
  datos: { orden: OrdenCola; impresoraId?: number } | null
  impresoras: ImpresoraCola[]
  ordenes: OrdenCola[]
  onCerrar: () => void
}) {
  return (
    <Dialog open={!!datos} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-lg'>
        {datos && (
          <FormEmpezar
            key={datos.orden.id}
            orden={datos.orden}
            impresoraInicial={datos.impresoraId}
            impresoras={impresoras}
            ordenes={ordenes}
            onCerrar={onCerrar}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormEmpezar({
  orden: o,
  impresoraInicial,
  impresoras,
  ordenes,
  onCerrar,
}: {
  orden: OrdenCola
  impresoraInicial?: number
  impresoras: ImpresoraCola[]
  ordenes: OrdenCola[]
  onCerrar: () => void
}) {
  const { data: bobinas = [] } = useQuery(consultaBobinas)
  const accion = useAccion()
  const ocupada = (id: number) =>
    ordenes.find((x) => x.estado === 'imprimiendo' && x.impresoraId === id)
  const motivo = (imp: ImpresoraCola) =>
    o.producto.multicolor && !imp.multicolor
      ? 'Solo imprime un color'
      : ocupada(imp.id)
        ? `Ocupada hasta ~${formatoHora(ocupada(imp.id)!.finEstimado!)}`
        : null
  const disponibles = impresoras.filter((i) => !motivo(i))
  const [impresoraId, setImpresoraId] = useState<number | null>(
    impresoraInicial ??
      (
        disponibles.find((i) => i.id === o.producto.impresoraSugeridaId) ??
        disponibles[0]
      )?.id ??
      null
  )
  const [bobinaId, setBobinaId] = useState(
    o.producto.bobinaSugeridaId ? String(o.producto.bobinaSugeridaId) : ''
  )
  const [error, setError] = useState<string | null>(null)
  const fin = sumarHoras(new Date(), o.horas || 1)

  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        accion.mutate(
          {
            id: o.id,
            accion: 'empezar',
            body: { impresoraId, bobinaId: Number(bobinaId) || null },
          },
          {
            onSuccess: onCerrar,
            onError: (err) =>
              setError(
                err instanceof ApiError ? err.message : mensajeDeError(err)
              ),
          }
        )
      }}
    >
      <DialogHeader>
        <DialogTitle>Empezar a imprimir</DialogTitle>
        <DialogDescription>
          {o.producto.nombre} × {o.cantidad}
          {o.color && ` en ${o.color.color}`} · {o.camas}{' '}
          {o.camas === 1 ? 'impresión' : 'impresiones'} · {textoHoras(o.horas)}
        </DialogDescription>
      </DialogHeader>
      <fieldset className='grid gap-2'>
        <legend className='mb-1.5 text-sm font-medium'>
          ¿En qué impresora?
        </legend>
        {impresoras.map((imp) => {
          const no = motivo(imp)
          return (
            <button
              key={imp.id}
              type='button'
              disabled={!!no}
              aria-pressed={impresoraId === imp.id}
              onClick={() => setImpresoraId(imp.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-3 text-start transition-colors disabled:cursor-not-allowed disabled:opacity-55',
                impresoraId === imp.id
                  ? 'border-primary bg-accent'
                  : 'hover:bg-accent/50'
              )}
            >
              <Printer className='size-5 text-primary' />
              <span className='flex-1'>
                <span className='block font-medium'>{imp.nombre}</span>
                <span className='text-sm text-muted-foreground'>
                  {no ??
                    (imp.multicolor
                      ? 'Libre · varios colores'
                      : 'Libre · un color')}
                </span>
              </span>
            </button>
          )
        })}
      </fieldset>
      <Campo
        etiqueta='Bobina que vas a usar'
        ayuda={
          o.color
            ? `El cliente lo pidió en ${o.color.color} (${o.color.material}): solo aparecen bobinas de ese color.`
            : 'Opcional. Sirve para saber cuánto filamento se gasta.'
        }
      >
        {(id) => (
          <Select value={bobinaId} onValueChange={setBobinaId}>
            <SelectTrigger id={id} className='w-full'>
              <SelectValue placeholder='Elige la bobina' />
            </SelectTrigger>
            <SelectContent>
              {bobinas
                .filter((b) => b.activa || String(b.id) === bobinaId)
                .filter(
                  (b) =>
                    !o.color ||
                    (b.color.trim().toLowerCase() ===
                      o.color.color.trim().toLowerCase() &&
                      b.material.trim().toLowerCase() ===
                        o.color.material.trim().toLowerCase())
                )
                .map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    <span
                      className='size-3 rounded-full border'
                      style={{ background: b.colorHex }}
                    />
                    {b.material} {b.color}
                    {b.serial && ` · ${b.serial}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </Campo>
      <p className='rounded-lg bg-muted p-3 text-sm'>
        Si empiezas ahora, termina aprox. a las{' '}
        <strong>{formatoHora(fin)}</strong>.
      </p>
      {error && <p className='text-sm font-medium text-destructive'>{error}</p>}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={!impresoraId || accion.isPending}>
          {accion.isPending ? <Loader2 className='animate-spin' /> : <Play />}
          Empezar
        </Button>
      </DialogFooter>
    </form>
  )
}

const MOTIVOS_FALLA = [
  'Se despegó de la cama',
  'Se enredó o se acabó el filamento',
  'Se movió una capa',
  'Salió con defectos',
]

function DialogoFallo({
  orden,
  onCerrar,
}: {
  orden: OrdenCola | null
  onCerrar: () => void
}) {
  return (
    <Dialog open={!!orden} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-md'>
        {orden && <FormFallo key={orden.id} o={orden} onCerrar={onCerrar} />}
      </DialogContent>
    </Dialog>
  )
}

function FormFallo({ o, onCerrar }: { o: OrdenCola; onCerrar: () => void }) {
  const accion = useAccion()
  const [motivo, setMotivo] = useState('')
  const [gramos, setGramos] = useState('')
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        accion.mutate(
          {
            id: o.id,
            accion: 'fallo',
            body: { motivo, gramosPerdidos: gramos },
          },
          {
            onSuccess: onCerrar,
            onError: (err) =>
              setError(
                err instanceof ApiError
                  ? { mensaje: err.message, campo: err.campo }
                  : { mensaje: mensajeDeError(err) }
              ),
          }
        )
      }}
    >
      <DialogHeader>
        <DialogTitle>¿Qué pasó con {o.producto.nombre}?</DialogTitle>
        <DialogDescription>
          La orden vuelve a la cola para imprimirla de nuevo. Anotar las fallas
          ayuda a saber cuánto se pierde de verdad.
        </DialogDescription>
      </DialogHeader>
      <div className='grid gap-1.5'>
        <Campo
          etiqueta='Qué pasó'
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
        <div className='flex flex-wrap gap-2'>
          {MOTIVOS_FALLA.map((m) => (
            <button
              key={m}
              type='button'
              onClick={() => setMotivo(m)}
              className='rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent'
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <CampoNumero
        etiqueta='Filamento perdido'
        unidad='g'
        valor={gramos}
        onChange={setGramos}
        ayuda='Más o menos. Si no sabes, déjalo vacío.'
        error={error?.campo === 'gramosPerdidos' ? error.mensaje : undefined}
      />
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={accion.isPending}>
          <RotateCcw /> Volver a la cola
        </Button>
      </DialogFooter>
    </form>
  )
}

function DialogoStock({
  abierto,
  onCerrar,
}: {
  abierto: boolean
  onCerrar: () => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-md'>
        {abierto && <FormStock onCerrar={onCerrar} />}
      </DialogContent>
    </Dialog>
  )
}

function FormStock({ onCerrar }: { onCerrar: () => void }) {
  const queryClient = useQueryClient()
  const { data: productos = [] } = useQuery(consultaProductos)
  const opciones = useMemo(
    () =>
      productos.filter((p) => p.estado === 'activo' && p.tipo === 'catalogo'),
    [productos]
  )
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('10')
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [color, setColor] = useState<number | null>(null)
  const elegido = opciones.find((p) => String(p.id) === productoId)
  const colorElegido = elegido?.colores.find((c) => c.bobinaId === color)

  return (
    <form
      className='grid gap-4'
      onSubmit={async (e) => {
        e.preventDefault()
        setError(null)
        setEnviando(true)
        try {
          await ordenParaStock(Number(productoId), Number(cantidad), color)
          queryClient.invalidateQueries({ queryKey: ['cola'] })
          toast.success('Quedó en la cola. Al terminarlo, se suma al stock.')
          onCerrar()
        } catch (err) {
          setError(
            err instanceof ApiError
              ? { mensaje: err.message, campo: err.campo }
              : { mensaje: mensajeDeError(err) }
          )
        } finally {
          setEnviando(false)
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Imprimir para stock</DialogTitle>
        <DialogDescription>
          Para tener listos los productos que más se venden. Va al final de la
          cola, después de los pedidos.
        </DialogDescription>
      </DialogHeader>
      <Campo
        etiqueta='Producto'
        error={error?.campo === 'productoId' ? error.mensaje : undefined}
      >
        {(id) => (
          <Select
            value={productoId}
            onValueChange={(v) => {
              setProductoId(v)
              setColor(null)
            }}
          >
            <SelectTrigger id={id} className='w-full'>
              <SelectValue placeholder='Elige un producto del catálogo' />
            </SelectTrigger>
            <SelectContent>
              {opciones.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.nombre} · hay {p.stock}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Campo>
      {elegido?.escogeColor && (
        <div className='grid gap-2'>
          <span className='text-sm font-medium'>¿De qué color?</span>
          <BotonesColor
            etiqueta='Color a imprimir'
            opciones={elegido.colores.map((c) => ({
              bobinaId: c.bobinaId,
              color: c.color,
              colorHex: c.colorHex,
              detalle: `hay ${c.stock}`,
            }))}
            seleccion={color ? [color] : []}
            onChange={([id]) => setColor(id ?? null)}
            invalido={error?.campo === 'bobinaId'}
          />
          {error?.campo === 'bobinaId' && (
            <p className='text-sm font-medium text-destructive'>
              {error.mensaje}
            </p>
          )}
        </div>
      )}
      <CampoNumero
        etiqueta='¿Cuántas unidades?'
        valor={cantidad}
        onChange={setCantidad}
        error={error?.campo === 'cantidad' ? error.mensaje : undefined}
        ayuda={
          colorElegido
            ? `Ahora hay ${colorElegido.stock} en ${colorElegido.color.toLowerCase()}.`
            : elegido
              ? `Ahora hay ${elegido.stock} en stock.`
              : undefined
        }
      />
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button
          type='submit'
          disabled={!productoId || (!!elegido?.escogeColor && !color) || enviando}
        >
          <Plus /> Agregar a la cola
        </Button>
      </DialogFooter>
    </form>
  )
}
