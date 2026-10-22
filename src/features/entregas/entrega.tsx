import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { MODALIDADES_INFO } from '@shared/cotizacion'
import {
  type Entrega,
  type EntregaLista,
  FRANJAS,
  nombreEstadoEntrega,
  TRANSPORTADORAS,
} from '@shared/entregas'
import {
  METODOS_PAGO,
  METODOS_PAGO_INFO,
  type MetodoPago,
} from '@shared/pedidos'
import {
  AlertTriangle,
  Bike,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Store,
  Truck,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { subirFoto } from '@/lib/subir-foto'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Campo, CampoNumero } from '@/components/campo'
import { formatoFechaLarga } from '@/features/cotizar/estado'
import { formatoHora } from '@/features/pedidos/fechas'
import { formatoPesos } from '@/features/taller/formato'
import { accionEntrega, consultaMensajeros } from './api'

// ---------- Ayudas ----------

const ICONO = { recoge: Store, local: Bike, nacional: Truck }

/** Número para WhatsApp: si no trae indicativo, se asume Colombia (57). */
export function enlaceWhatsapp(telefono: string, texto?: string) {
  let n = telefono.replace(/\D/g, '')
  if (n.length === 10) n = `57${n}`
  return `https://wa.me/${n}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

const enlaceMapa = (direccion: string, ciudad: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${direccion}, ${ciudad}, Colombia`)}`

const hoyISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const aISO = (d: string | null) => {
  if (!d) return ''
  const f = new Date(d)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

/** "mañana, jueves 23 de octubre · Mañana (8 a 12)" */
export function textoCuando(e: Entrega) {
  if (!e.fechaProgramada) return null
  const f = formatoFechaLarga(e.fechaProgramada)
  const hora =
    e.modalidad === 'recoge' ? ` a las ${formatoHora(e.fechaProgramada)}` : ''
  return `${f}${hora}${e.franja ? ` · ${e.franja}` : ''}`
}

const COLOR_ESTADO: Record<Entrega['estado'], string> = {
  por_programar: 'bg-marca-ambar/30 text-foreground',
  programada: 'bg-marca-lima/35 text-foreground',
  en_camino: 'bg-marca-naranja/30 text-foreground',
  entregada: 'bg-primary text-primary-foreground',
}

export function EstadoEntregaBadge({
  e,
}: {
  e: Pick<Entrega, 'estado' | 'modalidad'>
}) {
  return (
    <Badge className={COLOR_ESTADO[e.estado]}>
      {nombreEstadoEntrega(e.estado, e.modalidad)}
    </Badge>
  )
}

function useRefrescar() {
  const queryClient = useQueryClient()
  return (pedidoId: number) => {
    queryClient.invalidateQueries({ queryKey: ['entregas'] })
    queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] })
    queryClient.invalidateQueries({ queryKey: ['pedidos'] })
    queryClient.invalidateQueries({ queryKey: ['cobros'] })
  }
}

type ErrorCampo = { mensaje: string; campo?: string } | null
const comoError = (e: unknown): ErrorCampo =>
  e instanceof ApiError
    ? { mensaje: e.message, campo: e.campo || undefined }
    : { mensaje: mensajeDeError(e) }

// ---------- Datos de la entrega (dirección, teléfono, cobro) ----------

export function DatosEntrega({ e, saldo }: { e: Entrega; saldo: number }) {
  const cuando = textoCuando(e)
  return (
    <div className='grid gap-2 text-sm'>
      {cuando && <p className='font-medium'>{cuando}</p>}
      {e.modalidad !== 'recoge' && e.direccion && (
        <a
          href={enlaceMapa(e.direccion, e.ciudad)}
          target='_blank'
          rel='noreferrer'
          className='flex items-start gap-2 underline-offset-2 hover:underline'
        >
          <MapPin className='mt-0.5 size-4 shrink-0 text-primary' />
          <span>
            {e.direccion}
            {e.ciudad && `, ${e.ciudad}`}
          </span>
        </a>
      )}
      {(e.recibe || e.telefono) && (
        <p className='flex flex-wrap items-center gap-x-3 gap-y-1'>
          {e.recibe && (
            <span>
              {e.modalidad === 'recoge' ? 'Recoge: ' : 'Recibe: '}
              {e.recibe}
            </span>
          )}
          {e.telefono && (
            <>
              <a
                href={`tel:${e.telefono.replace(/\s/g, '')}`}
                className='inline-flex items-center gap-1 text-primary'
              >
                <Phone className='size-3.5' /> Llamar
              </a>
              <a
                href={enlaceWhatsapp(e.telefono)}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center gap-1 text-primary'
              >
                <MessageCircle className='size-3.5' /> WhatsApp
              </a>
            </>
          )}
        </p>
      )}
      {e.modalidad === 'local' && e.quienLleva && (
        <p className='text-muted-foreground'>
          Lo lleva:{' '}
          {e.quienLleva === 'mensajero'
            ? (e.mensajero?.nombre ?? '—')
            : e.servicioTercero}
        </p>
      )}
      {e.modalidad === 'nacional' && e.transportadora && (
        <p className='text-muted-foreground'>
          {e.transportadora}
          {e.guia && ` · guía ${e.guia}`}
        </p>
      )}
      {e.contraentrega && saldo > 0 && e.estado !== 'entregada' && (
        <p className='flex items-center gap-2 rounded-lg bg-marca-ambar/20 px-3 py-2 font-semibold'>
          <Wallet className='size-4' /> Cobrar al entregar:{' '}
          {formatoPesos(saldo)}
        </p>
      )}
      {!e.contraentrega && saldo > 0 && e.estado !== 'entregada' && (
        <p className='flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive'>
          <AlertTriangle className='mt-0.5 size-4 shrink-0' />
          Falta cobrar {formatoPesos(saldo)}. No sale hasta que se pague o se
          marque “cobrar al entregar”.
        </p>
      )}
      {e.novedad && e.estado !== 'entregada' && (
        <p className='flex items-start gap-2 rounded-lg bg-marca-naranja/15 px-3 py-2'>
          <AlertTriangle className='mt-0.5 size-4 shrink-0 text-marca-naranja' />
          Novedad: {e.novedad}
        </p>
      )}
      {e.notas && <p className='text-muted-foreground'>Nota: {e.notas}</p>}
      {e.estado === 'entregada' && (
        <p className='flex flex-wrap items-center gap-2 text-muted-foreground'>
          <CheckCircle2 className='size-4 text-primary' />
          Recibió {e.recibidoPor}
          {e.entregadaEn &&
            ` · ${formatoFechaLarga(e.entregadaEn)}, ${formatoHora(e.entregadaEn)}`}
          {e.evidenciaUrl && (
            <a
              href={e.evidenciaUrl}
              target='_blank'
              rel='noreferrer'
              className='text-primary underline'
            >
              Ver foto
            </a>
          )}
        </p>
      )}
    </div>
  )
}

// ---------- Botones según el estado ----------

type Dialogo = 'programar' | 'despachar' | 'entregada' | 'novedad' | null

export function AccionesEntrega({
  e,
  saldo,
  listo,
  puedeProgramar,
  compacto,
}: {
  e: Entrega
  saldo: number
  listo: boolean
  puedeProgramar: boolean
  compacto?: boolean
}) {
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const refrescar = useRefrescar()
  const salir = useMutation({
    mutationFn: () => accionEntrega(e.id, 'salir', {}),
    onSuccess: () => {
      refrescar(e.pedidoId)
      toast.success('Listo: va en camino.')
    },
    onError: (err) => toast.error(mensajeDeError(err)),
  })
  const cerrar = () => setDialogo(null)
  const tam = compacto ? 'default' : 'lg'

  if (e.estado === 'entregada') return null
  return (
    <>
      <div className='flex flex-wrap gap-2'>
        {e.estado === 'por_programar' &&
          (puedeProgramar && listo ? (
            <Button size={tam} onClick={() => setDialogo('programar')}>
              <Package /> Programar entrega
            </Button>
          ) : (
            <p className='text-sm text-muted-foreground'>
              {listo
                ? 'El comercial del pedido la programa.'
                : 'Se programa cuando el pedido esté listo en el taller.'}
            </p>
          ))}
        {e.estado === 'programada' && e.modalidad === 'local' && (
          <Button
            size={tam}
            disabled={salir.isPending}
            onClick={() => salir.mutate()}
          >
            <Bike /> Salió a entregar
          </Button>
        )}
        {e.estado === 'programada' && e.modalidad === 'nacional' && (
          <Button size={tam} onClick={() => setDialogo('despachar')}>
            <Truck /> Ya se despachó
          </Button>
        )}
        {(e.estado === 'en_camino' ||
          (e.estado === 'programada' && e.modalidad === 'recoge')) && (
          <Button size={tam} onClick={() => setDialogo('entregada')}>
            <CheckCircle2 />{' '}
            {e.modalidad === 'recoge' ? 'Ya lo recogió' : 'Entregado'}
          </Button>
        )}
        {(e.estado === 'programada' || e.estado === 'en_camino') && (
          <Button
            size={tam}
            variant='outline'
            onClick={() => setDialogo('novedad')}
          >
            <AlertTriangle /> Hubo una novedad
          </Button>
        )}
        {e.estado === 'programada' && puedeProgramar && (
          <Button
            size={tam}
            variant='ghost'
            onClick={() => setDialogo('programar')}
          >
            Cambiar día o datos
          </Button>
        )}
      </div>
      <Dialog open={dialogo !== null} onOpenChange={(v) => !v && cerrar()}>
        <DialogContent
          className={cn(
            'max-h-[92svh] overflow-y-auto',
            dialogo === 'programar' ? 'sm:max-w-xl' : 'sm:max-w-md'
          )}
        >
          {dialogo === 'programar' && (
            <FormProgramar e={e} saldo={saldo} onListo={cerrar} />
          )}
          {dialogo === 'despachar' && <FormDespachar e={e} onListo={cerrar} />}
          {dialogo === 'entregada' && (
            <FormEntregada e={e} saldo={saldo} onListo={cerrar} />
          )}
          {dialogo === 'novedad' && <FormNovedad e={e} onListo={cerrar} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

// ---------- Tarjeta para la pantalla de Entregas ----------

export function TarjetaEntrega({
  e,
  puedeProgramar,
}: {
  e: EntregaLista
  puedeProgramar: boolean
}) {
  const Icono = ICONO[e.modalidad]
  return (
    <Card
      className={cn(
        'gap-3 py-4',
        e.estado === 'en_camino' && 'border-marca-naranja'
      )}
    >
      <CardContent className='grid gap-3 px-4'>
        <div className='flex flex-wrap items-start gap-2'>
          <Icono className='mt-1 size-5 shrink-0 text-primary' />
          <div className='min-w-0 flex-1 basis-48'>
            <p className='font-semibold'>{e.pedido.cliente}</p>
            <p className='text-sm text-muted-foreground'>
              <Link
                to='/pedidos/$id'
                params={{ id: String(e.pedido.id) }}
                className='underline-offset-2 hover:underline'
              >
                {e.pedido.codigo}
              </Link>{' '}
              · {MODALIDADES_INFO[e.modalidad].corto}
            </p>
          </div>
          <EstadoEntregaBadge e={e} />
        </div>
        <DatosEntrega e={e} saldo={e.pedido.saldo} />
        <AccionesEntrega
          e={e}
          saldo={e.pedido.saldo}
          listo={e.pedido.listo}
          puedeProgramar={puedeProgramar}
          compacto
        />
      </CardContent>
    </Card>
  )
}

// ---------- Formularios ----------

function FormProgramar({
  e,
  saldo,
  onListo,
}: {
  e: Entrega
  saldo: number
  onListo: () => void
}) {
  const refrescar = useRefrescar()
  const { data: mensajeros = [] } = useQuery({
    ...consultaMensajeros,
    enabled: e.modalidad === 'local',
  })
  const [f, setF] = useState({
    fecha: aISO(e.fechaProgramada) || hoyISO(),
    hora:
      e.fechaProgramada && e.modalidad === 'recoge'
        ? formatoHora24(e.fechaProgramada)
        : '10:00',
    franja: e.franja,
    direccion: e.direccion,
    ciudad: e.ciudad,
    recibe: e.recibe,
    telefono: e.telefono,
    quienLleva: (e.quienLleva ?? 'mensajero') as 'mensajero' | 'tercero',
    mensajeroId: e.mensajero ? String(e.mensajero.id) : '',
    servicioTercero: e.servicioTercero,
    transportadora: e.transportadora,
    guia: e.guia,
    costoReal: e.costoReal === null ? '' : String(e.costoReal),
    contraentrega: e.contraentrega,
    montoContraentrega: String(e.montoContraentrega || saldo),
    notas: e.notas,
  })
  const [error, setError] = useState<ErrorCampo>(null)
  const set =
    <K extends keyof typeof f>(k: K) =>
    (v: (typeof f)[K]) =>
      setF((p) => ({ ...p, [k]: v }))
  const errorDe = (c: string) =>
    error?.campo === c ? error.mensaje : undefined
  const guardar = useMutation({
    mutationFn: () =>
      accionEntrega(e.id, 'programar', {
        ...f,
        fechaProgramada: `${f.fecha}T${e.modalidad === 'recoge' ? f.hora : '12:00'}:00-05:00`,
        mensajeroId: Number(f.mensajeroId) || null,
        contraentrega: f.contraentrega,
      }),
    onSuccess: () => {
      refrescar(e.pedidoId)
      toast.success('Entrega programada.')
      onListo()
    },
    onError: (err) => setError(comoError(err)),
  })
  const costo = Number(f.costoReal) || 0
  const diferencia = e.costoCobrado - costo

  return (
    <form
      className='grid gap-4'
      onSubmit={(ev) => {
        ev.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>Programar entrega</DialogTitle>
        <DialogDescription>
          {MODALIDADES_INFO[e.modalidad].nombre}
        </DialogDescription>
      </DialogHeader>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Campo
          etiqueta={
            e.modalidad === 'nacional'
              ? 'Día de despacho'
              : e.modalidad === 'recoge'
                ? 'Día que viene'
                : 'Día de entrega'
          }
          error={errorDe('fechaProgramada')}
        >
          {(id) => (
            <Input
              id={id}
              type='date'
              value={f.fecha}
              min={hoyISO()}
              onChange={(x) => set('fecha')(x.target.value)}
            />
          )}
        </Campo>
        {e.modalidad === 'recoge' ? (
          <Campo etiqueta='Hora acordada'>
            {(id) => (
              <Input
                id={id}
                type='time'
                value={f.hora}
                onChange={(x) => set('hora')(x.target.value)}
              />
            )}
          </Campo>
        ) : e.modalidad === 'local' ? (
          <div className='grid content-start gap-1.5'>
            <span className='text-sm font-medium'>Franja</span>
            <div className='flex flex-wrap gap-1.5'>
              {FRANJAS.map((fr) => (
                <button
                  key={fr}
                  type='button'
                  aria-pressed={f.franja === fr}
                  onClick={() => set('franja')(f.franja === fr ? '' : fr)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    f.franja === fr
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  {fr}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {e.modalidad !== 'recoge' && (
          <>
            <Campo
              etiqueta='Dirección'
              error={errorDe('direccion')}
              className='sm:col-span-2'
            >
              {(id) => (
                <Input
                  id={id}
                  value={f.direccion}
                  onChange={(x) => set('direccion')(x.target.value)}
                />
              )}
            </Campo>
            <Campo etiqueta='Ciudad' error={errorDe('ciudad')}>
              {(id) => (
                <Input
                  id={id}
                  value={f.ciudad}
                  onChange={(x) => set('ciudad')(x.target.value)}
                />
              )}
            </Campo>
          </>
        )}
        <Campo
          etiqueta={
            e.modalidad === 'recoge'
              ? '¿Quién viene a recoger?'
              : '¿Quién recibe?'
          }
          error={errorDe('recibe')}
        >
          {(id) => (
            <Input
              id={id}
              value={f.recibe}
              onChange={(x) => set('recibe')(x.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta='Teléfono' error={errorDe('telefono')}>
          {(id) => (
            <Input
              id={id}
              inputMode='tel'
              value={f.telefono}
              onChange={(x) => set('telefono')(x.target.value)}
            />
          )}
        </Campo>
      </div>

      {e.modalidad === 'local' && (
        <fieldset className='grid gap-2'>
          <legend className='mb-1.5 text-sm font-medium'>
            ¿Quién lo lleva?
          </legend>
          <div className='grid grid-cols-2 gap-2'>
            {(['mensajero', 'tercero'] as const).map((q) => (
              <button
                key={q}
                type='button'
                aria-pressed={f.quienLleva === q}
                onClick={() => set('quienLleva')(q)}
                className={cn(
                  'rounded-xl border p-3 text-start text-sm transition-colors',
                  f.quienLleva === q
                    ? 'border-primary bg-accent'
                    : 'hover:bg-accent/50'
                )}
              >
                <span className='block font-medium'>
                  {q === 'mensajero' ? 'Nuestro mensajero' : 'Un servicio'}
                </span>
                <span className='text-muted-foreground'>
                  {q === 'mensajero'
                    ? 'Alguien del equipo'
                    : 'Picap, Rappi, taxi…'}
                </span>
              </button>
            ))}
          </div>
          {errorDe('quienLleva') && (
            <p className='text-sm font-medium text-destructive'>
              {errorDe('quienLleva')}
            </p>
          )}
          {f.quienLleva === 'mensajero' ? (
            <Campo etiqueta='Mensajero' error={errorDe('mensajeroId')}>
              {(id) => (
                <Select
                  value={f.mensajeroId}
                  onValueChange={set('mensajeroId')}
                >
                  <SelectTrigger id={id} className='w-full'>
                    <SelectValue
                      placeholder={
                        mensajeros.length
                          ? 'Elige quién lo lleva'
                          : 'No hay nadie con el rol de Entregas'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {mensajeros.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Campo>
          ) : (
            <Campo etiqueta='¿Qué servicio?' error={errorDe('servicioTercero')}>
              {(id) => (
                <Input
                  id={id}
                  value={f.servicioTercero}
                  placeholder='Ejemplo: Picap'
                  onChange={(x) => set('servicioTercero')(x.target.value)}
                />
              )}
            </Campo>
          )}
        </fieldset>
      )}

      {e.modalidad === 'nacional' && (
        <div className='grid gap-4 sm:grid-cols-2'>
          <Campo etiqueta='Transportadora' error={errorDe('transportadora')}>
            {(id) => (
              <>
                <Input
                  id={id}
                  list='transportadoras'
                  value={f.transportadora}
                  onChange={(x) => set('transportadora')(x.target.value)}
                />
                <datalist id='transportadoras'>
                  {TRANSPORTADORAS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </>
            )}
          </Campo>
          <Campo
            etiqueta='Número de guía'
            ayuda='Si ya la tienes. Si no, la pides al despachar.'
          >
            {(id) => (
              <Input
                id={id}
                value={f.guia}
                onChange={(x) => set('guia')(x.target.value)}
              />
            )}
          </Campo>
        </div>
      )}

      {e.modalidad !== 'recoge' && (
        <CampoNumero
          etiqueta='¿Cuánto cuesta de verdad el envío?'
          unidad='COP'
          valor={f.costoReal}
          onChange={set('costoReal')}
          error={errorDe('costoReal')}
          ayuda={
            e.costoCobrado > 0
              ? costo > 0
                ? diferencia >= 0
                  ? `Al cliente se le cobraron ${formatoPesos(e.costoCobrado)}: el envío deja ${formatoPesos(diferencia)}.`
                  : `Al cliente se le cobraron ${formatoPesos(e.costoCobrado)}: el envío pierde ${formatoPesos(-diferencia)}.`
                : `Al cliente se le cobraron ${formatoPesos(e.costoCobrado)} de envío.`
              : 'Opcional. Sirve para saber si el envío deja ganancia o pérdida.'
          }
        />
      )}

      {saldo > 0 && (
        <div className='grid gap-3 rounded-xl border p-3'>
          <div className='flex items-start gap-2'>
            <Checkbox
              id='contraentrega'
              checked={f.contraentrega}
              onCheckedChange={(v) => set('contraentrega')(v === true)}
            />
            <Label htmlFor='contraentrega' className='grid gap-0.5 font-normal'>
              <span className='font-medium'>Cobrar al entregar</span>
              <span className='text-muted-foreground'>
                Falta por pagar {formatoPesos(saldo)}. Si no lo marcas, hay que
                cobrarlo antes de que salga.
              </span>
            </Label>
          </div>
          {f.contraentrega && (
            <CampoNumero
              etiqueta='Monto a cobrar'
              unidad='COP'
              valor={f.montoContraentrega}
              onChange={set('montoContraentrega')}
              error={errorDe('montoContraentrega') ?? errorDe('contraentrega')}
            />
          )}
        </div>
      )}

      <Campo
        etiqueta='Nota para quien entrega'
        ayuda='Opcional. Ejemplo: timbre dañado, llamar al llegar.'
      >
        {(id) => (
          <Textarea
            id={id}
            rows={2}
            value={f.notas}
            onChange={(x) => set('notas')(x.target.value)}
          />
        )}
      </Campo>
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onListo}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          {guardar.isPending && <Loader2 className='animate-spin' />}
          Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}

function formatoHora24(d: string) {
  const f = new Date(d)
  return `${String(f.getHours()).padStart(2, '0')}:${String(f.getMinutes()).padStart(2, '0')}`
}

function FormDespachar({ e, onListo }: { e: Entrega; onListo: () => void }) {
  const refrescar = useRefrescar()
  const [guia, setGuia] = useState(e.guia)
  const [costo, setCosto] = useState(
    e.costoReal === null ? '' : String(e.costoReal)
  )
  const [error, setError] = useState<ErrorCampo>(null)
  const guardar = useMutation({
    mutationFn: () => accionEntrega(e.id, 'salir', { guia, costoReal: costo }),
    onSuccess: () => {
      refrescar(e.pedidoId)
      toast.success('Despachado. Comparte la guía con el cliente.')
      onListo()
    },
    onError: (err) => setError(comoError(err)),
  })
  return (
    <form
      className='grid gap-4'
      onSubmit={(ev) => {
        ev.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>Ya se despachó</DialogTitle>
        <DialogDescription>
          Por {e.transportadora || 'la transportadora'}.
        </DialogDescription>
      </DialogHeader>
      <Campo
        etiqueta='Número de guía'
        error={error?.campo === 'guia' ? error.mensaje : undefined}
      >
        {(id) => (
          <Input
            id={id}
            value={guia}
            onChange={(x) => setGuia(x.target.value)}
            autoFocus
          />
        )}
      </Campo>
      <CampoNumero
        etiqueta='¿Cuánto costó el envío?'
        unidad='COP'
        valor={costo}
        onChange={setCosto}
        error={error?.campo === 'costoReal' ? error.mensaje : undefined}
        ayuda={
          e.costoCobrado > 0
            ? `Al cliente se le cobraron ${formatoPesos(e.costoCobrado)}.`
            : undefined
        }
      />
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onListo}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          <Truck /> Guardar
        </Button>
      </DialogFooter>
    </form>
  )
}

function FormEntregada({
  e,
  saldo,
  onListo,
}: {
  e: Entrega
  saldo: number
  onListo: () => void
}) {
  const refrescar = useRefrescar()
  const entrada = useRef<HTMLInputElement>(null)
  const [recibidoPor, setRecibidoPor] = useState(e.recibe)
  const [metodo, setMetodo] = useState<MetodoPago | ''>('')
  const [foto, setFoto] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<ErrorCampo>(null)
  const cobra = e.contraentrega && saldo > 0
  const guardar = useMutation({
    mutationFn: () =>
      accionEntrega(e.id, 'entregada', {
        recibidoPor,
        montoCobrado: cobra ? saldo : 0,
        metodo: metodo || null,
        evidenciaUrl: foto,
      }),
    onSuccess: () => {
      refrescar(e.pedidoId)
      toast.success(
        cobra
          ? `¡Entregado! Y quedó registrado el pago de ${formatoPesos(saldo)}.`
          : '¡Entregado!'
      )
      onListo()
    },
    onError: (err) => setError(comoError(err)),
  })
  return (
    <form
      className='grid gap-4'
      onSubmit={(ev) => {
        ev.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {e.modalidad === 'recoge' ? 'Ya lo recogió' : 'Entregado'}
        </DialogTitle>
        <DialogDescription>
          Anota quién lo recibió y, si puedes, toma una foto.
        </DialogDescription>
      </DialogHeader>
      <Campo
        etiqueta='¿Quién lo recibió?'
        error={error?.campo === 'recibidoPor' ? error.mensaje : undefined}
      >
        {(id) => (
          <Input
            id={id}
            value={recibidoPor}
            onChange={(x) => setRecibidoPor(x.target.value)}
          />
        )}
      </Campo>
      {cobra && (
        <fieldset className='grid gap-2 rounded-xl bg-marca-ambar/15 p-3'>
          <legend className='sr-only'>Cobro</legend>
          <p className='font-semibold'>Cobra {formatoPesos(saldo)}</p>
          <p className='text-sm'>¿Cómo te pagó?</p>
          <div className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
            {METODOS_PAGO.map((m) => (
              <button
                key={m}
                type='button'
                aria-pressed={metodo === m}
                onClick={() => setMetodo(m)}
                className={cn(
                  'rounded-lg border bg-background px-3 py-2.5 text-sm font-medium transition-colors',
                  metodo === m
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                {METODOS_PAGO_INFO[m]}
              </button>
            ))}
          </div>
          {(error?.campo === 'metodo' || error?.campo === 'montoCobrado') && (
            <p className='text-sm font-medium text-destructive'>
              {error.mensaje}
            </p>
          )}
        </fieldset>
      )}
      <div className='grid gap-2'>
        <input
          ref={entrada}
          type='file'
          accept='image/*'
          capture='environment'
          className='hidden'
          onChange={async (x) => {
            const a = x.target.files?.[0]
            if (!a) return
            setSubiendo(true)
            try {
              setFoto(
                await subirFoto(a, {
                  permiso: '/api/entregas/subida',
                  carpeta: `entregas/${e.id}`,
                })
              )
            } catch (err) {
              toast.error(mensajeDeError(err))
            } finally {
              setSubiendo(false)
            }
          }}
        />
        {foto ? (
          <img
            src={foto}
            alt='Foto de la entrega'
            className='max-h-48 rounded-lg border object-contain'
          />
        ) : null}
        <Button
          type='button'
          variant='outline'
          className='justify-self-start'
          disabled={subiendo}
          onClick={() => entrada.current?.click()}
        >
          {subiendo ? <Loader2 className='animate-spin' /> : <Camera />}
          {foto ? 'Cambiar foto' : 'Tomar foto (opcional)'}
        </Button>
      </div>
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onListo}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending || subiendo}>
          <CheckCircle2 /> Confirmar
        </Button>
      </DialogFooter>
    </form>
  )
}

const NOVEDADES = [
  'No había nadie',
  'La dirección está errada',
  'El cliente pidió otro día',
  'No contesta el teléfono',
]

function FormNovedad({ e, onListo }: { e: Entrega; onListo: () => void }) {
  const refrescar = useRefrescar()
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<ErrorCampo>(null)
  const guardar = useMutation({
    mutationFn: () => accionEntrega(e.id, 'novedad', { motivo }),
    onSuccess: () => {
      refrescar(e.pedidoId)
      toast.success('Quedó anotado. Hay que volver a programarla.')
      onListo()
    },
    onError: (err) => setError(comoError(err)),
  })
  return (
    <form
      className='grid gap-4'
      onSubmit={(ev) => {
        ev.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>¿Qué pasó?</DialogTitle>
        <DialogDescription>
          La entrega vuelve a quedar programada para intentar otra vez. El
          comercial verá la novedad.
        </DialogDescription>
      </DialogHeader>
      <div className='grid gap-1.5'>
        <Campo etiqueta='Qué pasó' error={error?.mensaje}>
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              value={motivo}
              onChange={(x) => setMotivo(x.target.value)}
            />
          )}
        </Campo>
        <div className='flex flex-wrap gap-2'>
          {NOVEDADES.map((n) => (
            <button
              key={n}
              type='button'
              onClick={() => setMotivo(n)}
              className='rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent'
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onListo}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          Guardar novedad
        </Button>
      </DialogFooter>
    </form>
  )
}
