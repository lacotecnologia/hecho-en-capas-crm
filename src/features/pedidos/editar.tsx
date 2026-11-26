import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { precioMaximoComercial } from '@shared/costos'
import { MODALIDADES, MODALIDADES_INFO, type Modalidad } from '@shared/cotizacion'
import { ENTREGA_MODIFICABLE, lineaBloqueada } from '@shared/editar-pedido'
import { type EstadoOrden, type PedidoDetalle } from '@shared/pedidos'
import { type ProductoResumen } from '@shared/taller'
import { Box, Lock, Loader2, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Campo } from '@/components/campo'
import { BotonesColor, EtiquetaColor } from '@/components/color'
import { Pagina } from '@/components/layout/pagina'
import { consultaConfiguracion } from '@/features/configuracion/api'
import { SelectorProducto } from '@/features/cotizar/selector-producto'
import { formatoPesos } from '@/features/taller/formato'
import { modificarPedido } from './api'
import { EstadoOrdenBadge } from './estado'

type LineaForm = {
  clave: string
  id: number | null
  productoId: number
  nombre: string
  imagen: string | null
  cantidad: string
  precioVenta: string
  bobinaId: number | null
  color: string
  colorHex: string
  /** Nombres ya guardados (líneas que existían). */
  textos: string[]
  /** Precio de fábrica guardado (líneas que existían). */
  fabricaGuardada: number
  bloqueo: string | null
  estado: EstadoOrden | null
  desdeStock: boolean
  /** Solo en líneas nuevas. */
  producto?: ProductoResumen
  personaliza: boolean
  nombres: string
}

const listaNombres = (t: string) =>
  t
    .split('\n')
    .map((x) => x.trim().replace(/\s+/g, ' '))
    .filter(Boolean)

const sinPuntos = (v: string) => v.replace(/[^\d]/g, '')
const conPuntos = (v: string) => (v ? Number(v).toLocaleString('es-CO') : '')

/** "2026-11-27T15:00" en hora de Colombia (UTC−5 fijo). */
const aLocal = (iso: string | null) =>
  iso ? new Date(new Date(iso).getTime() - 5 * 3600_000).toISOString().slice(0, 16) : ''
const deLocal = (v: string) => new Date(`${v}:00-05:00`).toISOString()

function fabricaDe(l: LineaForm) {
  if (!l.producto) return l.fabricaGuardada
  return l.producto.precioFabrica + (l.personaliza ? l.producto.personalizacion.precio : 0)
}
function cantidadDe(l: LineaForm) {
  if (l.producto && l.personaliza) return listaNombres(l.nombres).length
  return Number(l.cantidad) || 0
}
function textosDe(l: LineaForm) {
  if (!l.producto) return l.textos
  return l.personaliza ? listaNombres(l.nombres) : []
}

/** Solo el administrador: cambiar productos, precios, cargos y entrega de un pedido. */
export function EditarPedido({
  p,
  onCerrar,
  onGuardado,
}: {
  p: PedidoDetalle
  onCerrar: () => void
  onGuardado: (d: PedidoDetalle) => void
}) {
  const { data: config } = useQuery(consultaConfiguracion)
  const tope = config?.tope_comercial ?? 25
  const [lineas, setLineas] = useState<LineaForm[]>(() =>
    p.lineas.map((l) => ({
      clave: `l${l.id}`,
      id: l.id,
      productoId: l.productoId,
      nombre: l.nombre,
      imagen: l.imagen,
      cantidad: String(l.cantidad),
      precioVenta: String(l.precioVenta),
      bobinaId: l.bobinaId,
      color: l.color,
      colorHex: l.colorHex,
      textos: l.textos,
      fabricaGuardada: l.precioFabrica,
      bloqueo: lineaBloqueada(p.estado, l),
      estado: l.estado,
      desdeStock: l.desdeStock,
      personaliza: l.textos.length > 0,
      nombres: '',
    }))
  )
  const [cargos, setCargos] = useState(() =>
    p.cargos.map((c) => ({ concepto: c.concepto, valor: String(c.valor) }))
  )
  const [descuento, setDescuento] = useState(String(p.descuento || ''))
  const [notas, setNotas] = useState(p.notas)
  const entregaEditable = !!p.entrega && ENTREGA_MODIFICABLE.includes(p.entrega.estado)
  const [entrega, setEntrega] = useState({
    modalidad: p.modalidad as Modalidad,
    direccion: p.entrega?.direccion ?? '',
    ciudad: p.entrega?.ciudad ?? '',
    recibe: p.entrega?.recibe ?? '',
    telefono: p.entrega?.telefono ?? '',
  })
  const fechaInicial = aLocal(p.fechaCompromiso)
  const [fecha, setFecha] = useState(fechaInicial)
  const [eligiendo, setEligiendo] = useState(false)
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null)

  const cambiar = (clave: string, c: Partial<LineaForm>) => {
    setLineas((ls) => ls.map((l) => (l.clave === clave ? { ...l, ...c } : l)))
    setError(null)
  }

  const agregar = (prod: ProductoResumen) => {
    setEligiendo(false)
    setLineas((ls) => [
      ...ls,
      {
        clave: `n${Date.now()}`,
        id: null,
        productoId: prod.id,
        nombre: prod.nombre,
        imagen: prod.portada,
        cantidad: '1',
        precioVenta: String(precioMaximoComercial(prod.precioFabrica, tope)),
        bobinaId: null,
        color: '',
        colorHex: '',
        textos: [],
        fabricaGuardada: prod.precioFabrica,
        bloqueo: null,
        estado: null,
        desdeStock: false,
        producto: prod,
        personaliza: false,
        nombres: '',
      },
    ])
  }

  // Totales mientras se escribe
  const devuelto = -p.pagos.filter((x) => x.tipo === 'reembolso').reduce((s, x) => s + x.monto, 0)
  const subtotal = lineas.reduce((s, l) => s + cantidadDe(l) * (Number(l.precioVenta) || 0), 0)
  const fabrica = lineas.reduce((s, l) => s + cantidadDe(l) * fabricaDe(l), 0)
  const totalCargos = cargos.reduce((s, c) => s + (Number(c.valor) || 0), 0)
  const desc = Number(descuento) || 0
  const total = Math.max(0, subtotal + totalCargos - desc - devuelto)
  const ganancia = Math.max(0, subtotal - fabrica - desc - devuelto)
  const falta = total - p.pagado

  const guardar = useMutation({
    mutationFn: () =>
      modificarPedido(p.id, {
        lineas: lineas.map((l) => ({
          id: l.id,
          productoId: l.productoId,
          cantidad: cantidadDe(l),
          precioVenta: Number(l.precioVenta) || 0,
          bobinaId: l.bobinaId,
          textos: textosDe(l),
        })),
        cargos: cargos.map((c) => ({ concepto: c.concepto, valor: Number(c.valor) || 0 })),
        descuento: desc,
        notas,
        entrega: entregaEditable ? entrega : null,
        fechaCompromiso: fecha && fecha !== fechaInicial ? deLocal(fecha) : null,
      }),
    onSuccess: ({ pedido, sinCambios }) => {
      toast.success(sinCambios ? 'No cambiaste nada.' : 'Pedido actualizado. El taller ya ve los cambios.')
      onGuardado(pedido)
    },
    onError: (e) =>
      setError(
        e instanceof ApiError ? { mensaje: e.message, campo: e.campo } : { mensaje: mensajeDeError(e) }
      ),
  })

  return (
    <Pagina
      titulo={`Modificar pedido ${p.codigo}`}
      descripcion='Solo el administrador. Lo que el taller ya empezó solo deja cambiar el precio. Al guardar queda anotado en el historial.'
    >
      <form
        className='grid grid-cols-[minmax(0,1fr)] gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start'
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          guardar.mutate()
        }}
      >
        <div className='grid min-w-0 gap-6'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Productos</CardTitle>
              <CardDescription>
                El precio va entre el de fábrica y el tope del {tope} %, redondo a mil. Si quitas
                algo que salió del stock, vuelve al stock.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4'>
              {lineas.map((l) => {
                const fab = fabricaDe(l)
                const max = precioMaximoComercial(fab, tope)
                const conNombres = l.producto ? l.personaliza : l.textos.length > 0
                return (
                  <div
                    key={l.clave}
                    data-linea={l.nombre}
                    className={cn('grid gap-3 rounded-xl border p-3', !l.id && 'border-primary/50 bg-primary/5')}
                  >
                    <div className='flex items-start gap-3'>
                      <div className='size-12 shrink-0 overflow-hidden rounded-lg bg-muted'>
                        {l.imagen ? (
                          <img src={l.imagen} alt='' className='size-full object-contain p-1' />
                        ) : (
                          <Box className='m-auto mt-3.5 size-5 text-muted-foreground' />
                        )}
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='flex flex-wrap items-center gap-2 font-medium'>
                          {l.nombre}
                          <EtiquetaColor color={l.color} colorHex={l.colorHex} />
                          {!l.id && (
                            <span className='rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground'>
                              Nuevo
                            </span>
                          )}
                        </p>
                        {l.id && (
                          <div className='mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
                            {l.desdeStock ? 'Salió del stock' : l.estado && <EstadoOrdenBadge estado={l.estado} />}
                            {l.textos.length > 0 && <span>Nombres: {l.textos.join(', ')}</span>}
                          </div>
                        )}
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        aria-label={`Quitar ${l.nombre}`}
                        disabled={!!l.bloqueo || lineas.length === 1}
                        title={l.bloqueo ?? (lineas.length === 1 ? 'El pedido debe tener al menos un producto.' : undefined)}
                        onClick={() => setLineas((ls) => ls.filter((x) => x.clave !== l.clave))}
                      >
                        <Trash2 />
                      </Button>
                    </div>

                    {l.producto?.escogeColor && (
                      <BotonesColor
                        etiqueta={`Color de ${l.nombre}`}
                        opciones={l.producto.colores.map((c) => ({
                          bobinaId: c.bobinaId,
                          color: c.color,
                          colorHex: c.colorHex,
                          detalle: c.stock > 0 ? `${c.stock} en stock` : 'Se imprime',
                        }))}
                        seleccion={l.bobinaId ? [l.bobinaId] : []}
                        onChange={([id]) => {
                          const c = l.producto!.colores.find((x) => x.bobinaId === id)
                          cambiar(l.clave, { bobinaId: id ?? null, color: c?.color ?? '', colorHex: c?.colorHex ?? '' })
                        }}
                      />
                    )}
                    {l.producto?.personalizacion.activa && (
                      <div className='grid gap-2 rounded-lg bg-muted/50 p-3'>
                        <label className='flex items-center gap-3 text-sm font-medium'>
                          <Switch
                            checked={l.personaliza}
                            onCheckedChange={(v) => {
                              const nuevoFab =
                                l.producto!.precioFabrica + (v ? l.producto!.personalizacion.precio : 0)
                              cambiar(l.clave, {
                                personaliza: v,
                                precioVenta:
                                  (Number(l.precioVenta) || 0) < nuevoFab
                                    ? String(precioMaximoComercial(nuevoFab, tope))
                                    : l.precioVenta,
                              })
                            }}
                          />
                          Lleva nombres (uno por unidad)
                        </label>
                        {l.personaliza && (
                          <Textarea
                            rows={3}
                            aria-label={`Nombres de ${l.nombre}`}
                            placeholder={'Un nombre por renglón\nSofía\nMateo'}
                            value={l.nombres}
                            onChange={(e) => cambiar(l.clave, { nombres: e.target.value })}
                          />
                        )}
                      </div>
                    )}

                    <div className='grid grid-cols-2 gap-3 sm:grid-cols-[8rem_12rem_1fr] sm:items-end'>
                      <Campo
                        etiqueta='Cantidad'
                        ayuda={conNombres ? 'Una por nombre.' : undefined}
                      >
                        {(id, ayuda) => (
                          <Input
                            id={id}
                            aria-describedby={ayuda}
                            inputMode='numeric'
                            value={l.producto && l.personaliza ? String(cantidadDe(l)) : l.cantidad}
                            disabled={!!l.bloqueo || conNombres}
                            onChange={(e) => cambiar(l.clave, { cantidad: sinPuntos(e.target.value) })}
                          />
                        )}
                      </Campo>
                      <Campo etiqueta='Precio por unidad' ayuda={`De ${formatoPesos(fab)} a ${formatoPesos(max)}`}>
                        {(id, ayuda) => (
                          <Input
                            id={id}
                            aria-describedby={ayuda}
                            inputMode='numeric'
                            value={conPuntos(l.precioVenta)}
                            onChange={(e) => cambiar(l.clave, { precioVenta: sinPuntos(e.target.value) })}
                          />
                        )}
                      </Campo>
                      <p className='col-span-2 text-end font-semibold tabular-nums sm:col-span-1 sm:pb-7'>
                        {formatoPesos(cantidadDe(l) * (Number(l.precioVenta) || 0))}
                      </p>
                    </div>
                    {l.bloqueo && (
                      <p className='flex items-center gap-1.5 text-xs text-muted-foreground'>
                        <Lock className='size-3.5' /> {l.bloqueo}
                      </p>
                    )}
                  </div>
                )
              })}
              <Button
                type='button'
                variant='outline'
                className='justify-self-start'
                disabled={['en_entrega', 'entregado'].includes(p.estado)}
                onClick={() => setEligiendo(true)}
              >
                <Plus /> Agregar producto
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Cargos y descuento</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3'>
              {cargos.map((c, i) => (
                <div key={i} className='grid grid-cols-[1fr_6.5rem_auto] items-center gap-2 sm:grid-cols-[1fr_9rem_auto]'>
                  <Input
                    aria-label='Concepto'
                    placeholder='Envío'
                    value={c.concepto}
                    onChange={(e) =>
                      setCargos((cs) => cs.map((x, j) => (j === i ? { ...x, concepto: e.target.value } : x)))
                    }
                  />
                  <Input
                    aria-label={`Valor de ${c.concepto || 'cargo'}`}
                    inputMode='numeric'
                    value={conPuntos(c.valor)}
                    onChange={(e) =>
                      setCargos((cs) => cs.map((x, j) => (j === i ? { ...x, valor: sinPuntos(e.target.value) } : x)))
                    }
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label='Quitar cargo'
                    onClick={() => setCargos((cs) => cs.filter((_, j) => j !== i))}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='justify-self-start'
                onClick={() => setCargos((cs) => [...cs, { concepto: '', valor: '' }])}
              >
                <Plus /> Agregar cargo
              </Button>
              <Campo
                etiqueta='Descuento'
                ayuda='Sale de la ganancia del comercial; no puede ser mayor que ella.'
                error={error?.campo === 'descuento' ? error.mensaje : undefined}
                className='max-w-60'
              >
                {(id, ayuda) => (
                  <Input
                    id={id}
                    aria-describedby={ayuda}
                    inputMode='numeric'
                    value={conPuntos(descuento)}
                    onChange={(e) => setDescuento(sinPuntos(e.target.value))}
                  />
                )}
              </Campo>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Entrega</CardTitle>
              {!entregaEditable && (
                <CardDescription>La entrega ya salió o se hizo: sus datos no se cambian.</CardDescription>
              )}
            </CardHeader>
            <CardContent className='grid gap-4 sm:grid-cols-2'>
              <Campo etiqueta='Cómo se entrega'>
                {(id) => (
                  <select
                    id={id}
                    disabled={!entregaEditable}
                    className='h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs disabled:opacity-50'
                    value={entrega.modalidad}
                    onChange={(e) => setEntrega({ ...entrega, modalidad: e.target.value as Modalidad })}
                  >
                    {MODALIDADES.map((m) => (
                      <option key={m} value={m}>
                        {MODALIDADES_INFO[m].nombre}
                      </option>
                    ))}
                  </select>
                )}
              </Campo>
              <Campo
                etiqueta='Fecha prometida'
                ayuda='Si cambias productos y no tocas la fecha, se vuelve a calcular con la cola del taller.'
              >
                {(id, ayuda) => (
                  <Input
                    id={id}
                    aria-describedby={ayuda}
                    type='datetime-local'
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                )}
              </Campo>
              {entrega.modalidad !== 'recoge' && (
                <>
                  <Campo
                    etiqueta='Dirección'
                    error={error?.campo === 'direccion' ? error.mensaje : undefined}
                    className='sm:col-span-2'
                  >
                    {(id) => (
                      <Input
                        id={id}
                        disabled={!entregaEditable}
                        value={entrega.direccion}
                        onChange={(e) => setEntrega({ ...entrega, direccion: e.target.value })}
                      />
                    )}
                  </Campo>
                  <Campo etiqueta='Ciudad'>
                    {(id) => (
                      <Input
                        id={id}
                        disabled={!entregaEditable}
                        value={entrega.ciudad}
                        onChange={(e) => setEntrega({ ...entrega, ciudad: e.target.value })}
                      />
                    )}
                  </Campo>
                </>
              )}
              <Campo etiqueta='Quién recibe'>
                {(id) => (
                  <Input
                    id={id}
                    disabled={!entregaEditable}
                    value={entrega.recibe}
                    onChange={(e) => setEntrega({ ...entrega, recibe: e.target.value })}
                  />
                )}
              </Campo>
              <Campo etiqueta='Teléfono de quien recibe'>
                {(id) => (
                  <Input
                    id={id}
                    inputMode='tel'
                    disabled={!entregaEditable}
                    value={entrega.telefono}
                    onChange={(e) => setEntrega({ ...entrega, telefono: e.target.value })}
                  />
                )}
              </Campo>
              <Campo
                etiqueta='Notas del pedido'
                ayuda='Las mismas que venían de la cotización.'
                className='sm:col-span-2'
              >
                {(id, ayuda) => (
                  <Textarea
                    id={id}
                    aria-describedby={ayuda}
                    rows={2}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                  />
                )}
              </Campo>
            </CardContent>
          </Card>
        </div>

        <div className='grid min-w-0 gap-4 lg:sticky lg:top-20'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Así queda</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 text-sm'>
              <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5'>
                <dt className='text-muted-foreground'>Productos</dt>
                <dd className='text-end tabular-nums'>{formatoPesos(subtotal)}</dd>
                {totalCargos > 0 && (
                  <>
                    <dt className='text-muted-foreground'>Cargos</dt>
                    <dd className='text-end tabular-nums'>{formatoPesos(totalCargos)}</dd>
                  </>
                )}
                {desc > 0 && (
                  <>
                    <dt className='text-muted-foreground'>Descuento</dt>
                    <dd className='text-end tabular-nums'>− {formatoPesos(desc)}</dd>
                  </>
                )}
                {devuelto > 0 && (
                  <>
                    <dt className='text-muted-foreground'>Ya devuelto al cliente</dt>
                    <dd className='text-end tabular-nums'>− {formatoPesos(devuelto)}</dd>
                  </>
                )}
              </dl>
              <div className='rounded-xl bg-primary p-4 text-primary-foreground'>
                <p className='text-sm opacity-90'>Total nuevo</p>
                <p className='text-3xl font-bold tabular-nums'>{formatoPesos(total)}</p>
                {total !== p.total && (
                  <p className='text-sm opacity-90'>Antes: {formatoPesos(p.total)}</p>
                )}
              </div>
              <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5'>
                <dt className='text-muted-foreground'>Ya pagó</dt>
                <dd className='text-end tabular-nums'>{formatoPesos(p.pagado)}</dd>
                <dt className='text-muted-foreground'>{falta >= 0 ? 'Faltará por cobrar' : 'Pagó de más'}</dt>
                <dd className={cn('text-end font-semibold tabular-nums', falta < 0 && 'text-destructive')}>
                  {formatoPesos(Math.abs(falta))}
                </dd>
                <dt className='text-muted-foreground'>Ganancia de {p.comercial.nombre}</dt>
                <dd className='text-end tabular-nums'>{formatoPesos(ganancia)}</dd>
              </dl>
              {falta < 0 && (
                <p className='text-destructive'>
                  El total no puede quedar por debajo de lo que ya pagó. Si hay que devolverle
                  plata, usa “Devolver plata al cliente”.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className='sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur lg:col-span-2'>
          {error ? (
            <p className='w-full text-sm font-medium text-destructive sm:me-auto sm:w-auto' role='alert'>
              {error.mensaje}
            </p>
          ) : (
            <p className='hidden text-sm text-muted-foreground sm:me-auto sm:block'>
              Nada cambia hasta que guardes.
            </p>
          )}
          <Button type='button' variant='ghost' size='lg' onClick={onCerrar} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button type='submit' size='lg' className='flex-1 sm:flex-none' disabled={guardar.isPending}>
            {guardar.isPending ? <Loader2 className='animate-spin' /> : <Save />}
            Guardar cambios del pedido
          </Button>
        </div>
      </form>

      <SelectorProducto
        abierto={eligiendo}
        onCerrar={() => setEligiendo(false)}
        onElegir={agregar}
        yaAgregados={[]}
      />
    </Pagina>
  )
}
