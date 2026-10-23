import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  esPrecioRedondo,
  precioMaximoComercial,
  redondearPrecio,
} from '@shared/costos'
import {
  CARGOS_SUGERIDOS,
  type Cliente,
  type CotizacionDetalle,
  type CotizacionEntrada,
  MODALIDADES,
  MODALIDADES_INFO,
  type Modalidad,
  calcularCotizacion,
  sumarDiasHabiles,
} from '@shared/cotizacion'
import { type ProductoResumen } from '@shared/taller'
import {
  ArrowLeft,
  Box,
  FileDown,
  ImagePlus,
  Loader2,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Campo, CampoNumero } from '@/components/campo'
import { Pagina } from '@/components/layout/pagina'
import { consultaConfiguracion } from '@/features/configuracion/api'
import { consultaProductos } from '@/features/taller/api'
import { formatoPesos } from '@/features/taller/formato'
import {
  accionCotizacion,
  borrarCotizacion,
  guardarCotizacion,
  pedirPersonalizado,
  quitarImagen,
} from './api'
import { EstadoCotizacionBadge, formatoFechaLarga } from './estado'
import { SelectorCliente } from './selector-cliente'
import { SelectorProducto } from './selector-producto'
import { subirReferencia } from './subir-referencia'
import { VistaPdf } from './vista-pdf'

type LineaForm = {
  productoId: number
  nombre: string
  imagen: string | null
  precioFabrica: number
  personalizado: boolean
  diasFabricacion: number
  cantidad: string
  precioVenta: string
}

type CargoForm = { concepto: string; valor: string }

export function Volver() {
  return (
    <Button variant='ghost' asChild className='-ms-3 mb-2'>
      <Link to='/cotizar'>
        <ArrowLeft /> Volver a Cotizar
      </Link>
    </Button>
  )
}

export function EditorCotizacion({
  cotizacion,
}: {
  cotizacion: CotizacionDetalle | null
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: config } = useQuery(consultaConfiguracion)
  const { data: catalogo } = useQuery(consultaProductos)
  const tope = config?.tope_comercial ?? 25

  const [cliente, setCliente] = useState<Cliente | null>(
    cotizacion?.cliente ?? null
  )
  const [lineas, setLineas] = useState<LineaForm[]>(
    () =>
      cotizacion?.lineas.map((l) => ({
        productoId: l.productoId,
        nombre: l.nombre,
        imagen: l.imagen,
        precioFabrica: l.precioFabrica,
        personalizado: l.personalizado,
        diasFabricacion: l.diasFabricacion,
        cantidad: String(l.cantidad),
        precioVenta: String(l.precioVenta),
      })) ?? []
  )
  const [cargos, setCargos] = useState<CargoForm[]>(
    () =>
      cotizacion?.cargos.map((c) => ({
        concepto: c.concepto,
        valor: String(c.valor),
      })) ?? []
  )
  const [descuento, setDescuento] = useState(
    String(cotizacion?.resumen.descuento ?? 0)
  )
  const [modalidad, setModalidad] = useState<Modalidad>(
    cotizacion?.modalidad ?? 'local'
  )
  const [notas, setNotas] = useState(cotizacion?.notas ?? '')
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const [eligiendo, setEligiendo] = useState(false)
  const [pidiendo, setPidiendo] = useState(false)
  const [pdf, setPdf] = useState<CotizacionDetalle | null>(null)
  const [borrando, setBorrando] = useState(false)
  const [sucio, setSucio] = useState(false)
  const errorDe = (c: string) =>
    error?.campo === c ? error.mensaje : undefined
  const tocar = () => setSucio(true)

  // Datos del catálogo de hoy (por si el taller cambió el precio o hay stock)
  const enCatalogo = useMemo(
    () => new Map((catalogo ?? []).map((p) => [p.id, p])),
    [catalogo]
  )

  const lineasCalc = lineas.map((l) => {
    const cantidad = Number(l.cantidad) || 0
    const stock = enCatalogo.get(l.productoId)?.stock ?? 0
    return {
      cantidad,
      precioFabrica: l.precioFabrica,
      precioVenta: Number(l.precioVenta) || 0,
      personalizado: l.personalizado,
      diasFabricacion: l.diasFabricacion,
      desdeStock: cantidad > 0 && stock >= cantidad,
    }
  })
  const cargosCalc = cargos.map((c) => ({
    concepto: c.concepto,
    valor: Number(c.valor) || 0,
  }))
  const resumen = calcularCotizacion(
    lineasCalc,
    cargosCalc,
    Number(descuento) || 0,
    modalidad,
    config ?? {}
  )
  const gananciaSinDescuento = resumen.ganancia + resumen.descuento
  const entrega = sumarDiasHabiles(
    new Date(),
    resumen.diasFabricacion + resumen.diasEnvio
  )

  const entrada = (): CotizacionEntrada => ({
    clienteId: cliente?.id ?? null,
    modalidad,
    lineas: lineas.map((l) => ({
      productoId: l.productoId,
      cantidad: Number(l.cantidad) || 0,
      precioVenta: Number(l.precioVenta) || 0,
    })),
    cargos: cargosCalc.filter((c) => c.concepto.trim() || c.valor),
    descuento: Number(descuento) || 0,
    notas,
  })

  const guardar = useMutation({
    mutationFn: () => guardarCotizacion(cotizacion?.id ?? null, entrada()),
    onSuccess: ({ cotizacion: c }) => {
      queryClient.setQueryData(['cotizacion', c.id], { cotizacion: c })
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
      setSucio(false)
      setError(null)
      if (!cotizacion) {
        navigate({
          to: '/cotizar/$id',
          params: { id: String(c.id) },
          replace: true,
        })
      }
      return c
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: 'No se pudo guardar. Intenta de nuevo.' }
      ),
  })

  /** Guarda si hace falta y devuelve la cotización al día. */
  const asegurarGuardada = async () => {
    if (cotizacion && !sucio) return cotizacion
    const { cotizacion: c } = await guardar.mutateAsync()
    return c
  }

  const enviar = useMutation({
    mutationFn: (id: number) => accionCotizacion(id, 'enviar'),
    onSuccess: ({ cotizacion: c }) => {
      queryClient.setQueryData(['cotizacion', c.id], { cotizacion: c })
      queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
      setPdf(null)
      toast.success(
        `Listo: ${c.codigo} quedó como enviada. Vence el ${formatoFechaLarga(c.venceEn!)}.`
      )
    },
    onError: (e) => {
      setPdf(null)
      setError({
        mensaje: mensajeDeError(e),
        campo: e instanceof ApiError ? e.campo : undefined,
      })
    },
  })

  const agregarProducto = (p: ProductoResumen) => {
    setEligiendo(false)
    if (lineas.some((l) => l.productoId === p.id)) {
      toast.info(
        `“${p.nombre}” ya está en la cotización. Cambia la cantidad si necesitas más.`
      )
      return
    }
    tocar()
    setLineas((ls) => [
      ...ls,
      {
        productoId: p.id,
        nombre: p.nombre,
        imagen: p.portada,
        precioFabrica: p.precioFabrica,
        personalizado: p.tipo === 'personalizado',
        diasFabricacion: p.diasFabricacion,
        cantidad: '1',
        precioVenta: String(precioMaximoComercial(p.precioFabrica, tope)),
      },
    ])
  }

  const cambiarLinea = (i: number, cambios: Partial<LineaForm>) => {
    tocar()
    setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)))
  }

  return (
    <Pagina
      titulo={
        cotizacion ? `Cotización ${cotizacion.codigo}` : 'Nueva cotización'
      }
      descripcion={
        cotizacion
          ? 'Borrador: puedes cambiar lo que quieras hasta enviarla.'
          : 'Sigue los pasos. El resumen con el total se actualiza mientras escribes.'
      }
      acciones={
        cotizacion && <EstadoCotizacionBadge estado={cotizacion.estado} />
      }
    >
      <Volver />
      <form
        className='grid grid-cols-[minmax(0,1fr)] gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start'
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          guardar.mutate(undefined, {
            onSuccess: () => toast.success('Borrador guardado.'),
          })
        }}
      >
        <div className='grid min-w-0 gap-6'>
          {/* 1. Cliente */}
          <Paso
            numero={1}
            titulo='¿Para quién es?'
            descripcion='Busca el cliente o créalo.'
          >
            <SelectorCliente
              cliente={cliente}
              onElegir={(c) => {
                tocar()
                setCliente(c)
              }}
              error={errorDe('clienteId')}
            />
          </Paso>

          {/* 2. Productos */}
          <Paso
            numero={2}
            titulo='¿Qué productos lleva?'
            descripcion={`Puedes subir el precio hasta ${tope} % sobre el de fábrica, en valores redondos a mil. Lo que subas es tu ganancia.`}
          >
            <div className='grid gap-3'>
              {lineas.length === 0 && (
                <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
                  Aún no hay productos. Agrega el primero del catálogo.
                </p>
              )}
              {lineas.map((l, i) => {
                const maximo = precioMaximoComercial(l.precioFabrica, tope)
                const precio = Number(l.precioVenta) || 0
                const cant = Number(l.cantidad) || 0
                const fuera = precio < l.precioFabrica || precio > maximo
                const noRedondo =
                  precio > 0 &&
                  precio !== l.precioFabrica &&
                  !esPrecioRedondo(precio)
                const stock = enCatalogo.get(l.productoId)?.stock ?? 0
                return (
                  <div
                    key={l.productoId}
                    className='grid gap-3 rounded-xl border p-3 sm:grid-cols-[64px_1fr]'
                  >
                    <div className='hidden size-16 overflow-hidden rounded-lg bg-muted sm:block'>
                      {l.imagen ? (
                        <img
                          src={l.imagen}
                          alt=''
                          className='size-full object-contain p-1'
                        />
                      ) : (
                        <Box className='m-auto mt-5 size-6 text-muted-foreground' />
                      )}
                    </div>
                    <div className='grid min-w-0 gap-3'>
                      <div className='flex items-start gap-2'>
                        <div className='min-w-0 flex-1'>
                          <p className='font-semibold'>{l.nombre}</p>
                          <p className='text-sm text-muted-foreground'>
                            Fábrica {formatoPesos(l.precioFabrica)} · máximo{' '}
                            {formatoPesos(maximo)}
                            {l.personalizado && ' · personalizado'}
                            {cant > 0 && stock >= cant && ' · sale de stock'}
                          </p>
                        </div>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          aria-label={`Quitar ${l.nombre}`}
                          onClick={() => {
                            tocar()
                            setLineas((ls) => ls.filter((_, j) => j !== i))
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      <div className='grid gap-3 sm:grid-cols-[110px_1fr]'>
                        <CampoNumero
                          etiqueta='Cantidad'
                          valor={l.cantidad}
                          onChange={(v) => cambiarLinea(i, { cantidad: v })}
                        />
                        <div className='grid gap-1.5'>
                          <CampoNumero
                            etiqueta='Precio por unidad'
                            unidad='COP'
                            valor={l.precioVenta}
                            onChange={(v) =>
                              cambiarLinea(i, { precioVenta: v })
                            }
                            error={
                              fuera
                                ? `Debe estar entre ${formatoPesos(l.precioFabrica)} y ${formatoPesos(maximo)}.`
                                : noRedondo
                                  ? `Debe ser redondo a mil: usa ${formatoPesos(Math.min(maximo, redondearPrecio(precio)))}.`
                                  : undefined
                            }
                          />
                          <div className='flex flex-wrap gap-2'>
                            {[
                              ['Precio de fábrica', l.precioFabrica],
                              ['Máximo', maximo],
                            ].map(([t, v]) => (
                              <button
                                key={t}
                                type='button'
                                onClick={() =>
                                  cambiarLinea(i, { precioVenta: String(v) })
                                }
                                className='rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent'
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className='flex flex-wrap justify-between gap-2 text-sm'>
                        <span className='text-muted-foreground'>
                          Tu ganancia aquí:{' '}
                          <strong className='text-primary tabular-nums'>
                            {formatoPesos(
                              Math.max(0, (precio - l.precioFabrica) * cant)
                            )}
                          </strong>
                        </span>
                        <span className='font-semibold tabular-nums'>
                          {formatoPesos(precio * cant)}
                        </span>
                      </p>
                    </div>
                  </div>
                )
              })}
              {errorDe('lineas') && (
                <p
                  className='text-sm font-medium text-destructive'
                  role='alert'
                >
                  {errorDe('lineas')}
                </p>
              )}
              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  onClick={() => setEligiendo(true)}
                >
                  <Plus /> Agregar producto
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  className='h-auto max-w-full py-2 text-start whitespace-normal'
                  onClick={() => setPidiendo(true)}
                >
                  <Sparkles /> ¿No está en el catálogo? Pedir un personalizado
                </Button>
              </div>
            </div>
          </Paso>

          {/* 3. Cargos y descuento */}
          <Paso
            numero={3}
            titulo='Cargos y descuento'
            descripcion='Envío, diseño adicional, urgencia… El descuento sale de tu ganancia.'
          >
            <div className='grid gap-3'>
              {cargos.map((c, i) => (
                <div
                  key={i}
                  className='grid grid-cols-[1fr_140px_auto] items-end gap-2'
                >
                  <Campo etiqueta={i === 0 ? 'Concepto' : ''}>
                    {(id) => (
                      <>
                        <Input
                          id={id}
                          list='cargos-sugeridos'
                          value={c.concepto}
                          placeholder='Ejemplo: Envío'
                          aria-label='Concepto del cargo'
                          onChange={(e) => {
                            tocar()
                            setCargos((cs) =>
                              cs.map((x, j) =>
                                j === i ? { ...x, concepto: e.target.value } : x
                              )
                            )
                          }}
                        />
                      </>
                    )}
                  </Campo>
                  <CampoNumero
                    etiqueta={i === 0 ? 'Valor' : ''}
                    unidad='COP'
                    valor={c.valor}
                    onChange={(v) => {
                      tocar()
                      setCargos((cs) =>
                        cs.map((x, j) => (j === i ? { ...x, valor: v } : x))
                      )
                    }}
                  />
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    aria-label='Quitar cargo'
                    onClick={() => {
                      tocar()
                      setCargos((cs) => cs.filter((_, j) => j !== i))
                    }}
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <datalist id='cargos-sugeridos'>
                {CARGOS_SUGERIDOS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {errorDe('cargos') && (
                <p className='text-sm font-medium text-destructive'>
                  {errorDe('cargos')}
                </p>
              )}
              <Button
                type='button'
                variant='outline'
                className='justify-self-start'
                onClick={() => {
                  tocar()
                  setCargos((cs) => [
                    ...cs,
                    { concepto: cs.length === 0 ? 'Envío' : '', valor: '' },
                  ])
                }}
              >
                <Plus /> Agregar cargo
              </Button>
              <CampoNumero
                etiqueta='Descuento'
                unidad='COP'
                valor={descuento}
                onChange={(v) => {
                  tocar()
                  setDescuento(v)
                }}
                ayuda={`Máximo ${formatoPesos(Math.max(0, gananciaSinDescuento))} (tu ganancia).`}
                error={
                  errorDe('descuento') ??
                  ((Number(descuento) || 0) > gananciaSinDescuento
                    ? 'Es más que tu ganancia: se vendería por debajo del precio de fábrica.'
                    : undefined)
                }
                className='max-w-xs'
              />
            </div>
          </Paso>

          {/* 4. Entrega */}
          <Paso numero={4} titulo='¿Cómo se entrega?'>
            <div
              className='grid gap-2 sm:grid-cols-3'
              role='radiogroup'
              aria-label='Forma de entrega'
            >
              {MODALIDADES.map((m) => {
                const dias =
                  m === 'local'
                    ? (config?.dias_envio_local ?? 0)
                    : m === 'nacional'
                      ? (config?.dias_envio_nacional ?? 0)
                      : 0
                return (
                  <button
                    key={m}
                    type='button'
                    role='radio'
                    aria-checked={modalidad === m}
                    onClick={() => {
                      tocar()
                      setModalidad(m)
                    }}
                    className={cn(
                      'rounded-xl border p-3 text-start transition-colors',
                      modalidad === m
                        ? 'border-primary bg-accent'
                        : 'hover:bg-accent/50'
                    )}
                  >
                    <span className='block font-medium'>
                      {MODALIDADES_INFO[m].nombre}
                    </span>
                    <span className='text-sm text-muted-foreground'>
                      {dias === 0
                        ? 'Sin días extra'
                        : `+ ${dias} ${dias === 1 ? 'día' : 'días'}`}
                    </span>
                  </button>
                )
              })}
            </div>
          </Paso>

          {/* 5. Notas e imágenes */}
          <Paso
            numero={5}
            titulo='Notas e imágenes de referencia'
            descripcion='Las notas y las imágenes salen en el PDF.'
          >
            <div className='grid gap-4'>
              <Campo etiqueta='Notas para el cliente'>
                {(id) => (
                  <Textarea
                    id={id}
                    rows={3}
                    value={notas}
                    placeholder='Ejemplo: colores según el manual de marca que nos enviaste.'
                    onChange={(e) => {
                      tocar()
                      setNotas(e.target.value)
                    }}
                  />
                )}
              </Campo>
              <Referencias cotizacion={cotizacion} />
            </div>
          </Paso>
        </div>

        {/* Resumen */}
        <div className='grid min-w-0 gap-4 lg:sticky lg:top-20'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Resumen</CardTitle>
              <CardDescription>Así queda para el cliente.</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-3'>
              <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm'>
                <dt className='text-muted-foreground'>Productos</dt>
                <dd className='text-end tabular-nums'>
                  {formatoPesos(resumen.subtotal)}
                </dd>
                <dt className='text-muted-foreground'>Cargos</dt>
                <dd className='text-end tabular-nums'>
                  {formatoPesos(resumen.cargos)}
                </dd>
                {resumen.descuento > 0 && (
                  <>
                    <dt className='text-muted-foreground'>Descuento</dt>
                    <dd className='text-end tabular-nums'>
                      − {formatoPesos(resumen.descuento)}
                    </dd>
                  </>
                )}
              </dl>
              <div className='rounded-xl bg-primary p-4 text-primary-foreground'>
                <p className='text-sm opacity-90'>Total para el cliente</p>
                <p className='text-3xl font-bold tabular-nums'>
                  {formatoPesos(resumen.total)}
                </p>
                <p className='text-sm opacity-90'>Sin IVA</p>
              </div>
              {resumen.anticipo > 0 && (
                <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-lg bg-marca-amarillo/20 p-3 text-sm'>
                  <dt className='font-medium'>
                    Anticipo ({resumen.anticipoPct} %)
                  </dt>
                  <dd className='text-end font-semibold tabular-nums'>
                    {formatoPesos(resumen.anticipo)}
                  </dd>
                  <dt className='text-muted-foreground'>Saldo al entregar</dt>
                  <dd className='text-end tabular-nums'>
                    {formatoPesos(resumen.saldo)}
                  </dd>
                </dl>
              )}
              <p className='text-sm'>
                <span className='text-muted-foreground'>Entrega estimada:</span>{' '}
                <strong>{formatoFechaLarga(entrega)}</strong>
                <span className='block text-xs text-muted-foreground'>
                  {resumen.diasFabricacion} días de fabricación +{' '}
                  {resumen.diasEnvio} de envío (sin contar domingos)
                </span>
              </p>
              <div className='flex items-center justify-between rounded-lg border border-dashed border-primary/40 p-3'>
                <span className='text-sm'>
                  Tu ganancia
                  <span className='block text-xs text-muted-foreground'>
                    No sale en el PDF
                  </span>
                </span>
                <strong className='text-lg text-primary tabular-nums'>
                  {formatoPesos(Math.max(0, resumen.ganancia))}
                </strong>
              </div>
            </CardContent>
          </Card>
          {cotizacion && (
            <Button
              type='button'
              variant='ghost'
              className='justify-self-start text-muted-foreground'
              onClick={() => setBorrando(true)}
            >
              <Trash2 /> Borrar este borrador
            </Button>
          )}
        </div>

        {/* Barra de acciones */}
        <div className='sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur lg:col-span-2'>
          {error ? (
            <p
              className='w-full text-sm font-medium text-destructive sm:me-auto sm:w-auto'
              role='alert'
            >
              {error.mensaje}
            </p>
          ) : (
            <p className='hidden text-sm text-muted-foreground sm:me-auto sm:block'>
              {sucio || !cotizacion
                ? 'Hay cambios sin guardar.'
                : 'Todo guardado.'}
            </p>
          )}
          <Button
            type='submit'
            variant='outline'
            size='lg'
            className='flex-1 sm:flex-none'
            disabled={guardar.isPending}
          >
            {guardar.isPending ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Save />
            )}
            Guardar<span className='hidden sm:inline'> borrador</span>
          </Button>
          <Button
            type='button'
            size='lg'
            className='flex-1 sm:flex-none'
            disabled={guardar.isPending}
            onClick={async () => {
              setError(null)
              try {
                const c = await asegurarGuardada()
                setPdf(c)
              } catch {
                // el error ya se muestra en la barra
              }
            }}
          >
            <FileDown /> Ver PDF y enviar
          </Button>
        </div>
      </form>

      <SelectorProducto
        abierto={eligiendo}
        onCerrar={() => setEligiendo(false)}
        onElegir={agregarProducto}
        yaAgregados={lineas.map((l) => l.productoId)}
      />
      <DialogoPersonalizado
        abierto={pidiendo}
        onCerrar={() => setPidiendo(false)}
        asegurarGuardada={asegurarGuardada}
      />
      <VistaPdf
        cotizacion={pdf}
        onCerrar={() => setPdf(null)}
        onMarcarEnviada={() => pdf && enviar.mutate(pdf.id)}
        marcando={enviar.isPending}
      />
      <Dialog open={borrando} onOpenChange={setBorrando}>
        <DialogContent className='sm:max-w-sm'>
          <DialogHeader>
            <DialogTitle>¿Borrar este borrador?</DialogTitle>
            <DialogDescription>
              Se pierde lo que tiene. Como nunca se envió, el cliente no se
              entera.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setBorrando(false)}>
              Cancelar
            </Button>
            <Button
              variant='destructive'
              onClick={async () => {
                if (!cotizacion) return
                try {
                  await borrarCotizacion(cotizacion.id)
                  queryClient.invalidateQueries({ queryKey: ['cotizaciones'] })
                  toast.success('Borrador borrado.')
                  navigate({ to: '/cotizar' })
                } catch (e) {
                  toast.error(mensajeDeError(e))
                }
              }}
            >
              Sí, borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Pagina>
  )
}

function Paso({
  numero,
  titulo,
  descripcion,
  children,
}: {
  numero: number
  titulo: string
  descripcion?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-start gap-3'>
        <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground'>
          {numero}
        </span>
        <div className='grid gap-1'>
          <CardTitle className='text-lg'>{titulo}</CardTitle>
          {descripcion && <CardDescription>{descripcion}</CardDescription>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Referencias({ cotizacion }: { cotizacion: CotizacionDetalle | null }) {
  const queryClient = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const poner = (c: CotizacionDetalle) =>
    queryClient.setQueryData(['cotizacion', c.id], { cotizacion: c })

  if (!cotizacion) {
    return (
      <p className='rounded-lg border border-dashed p-3 text-sm text-muted-foreground'>
        Para adjuntar imágenes primero guarda el borrador.
      </p>
    )
  }
  return (
    <div className='grid gap-3'>
      {cotizacion.imagenes.length > 0 && (
        <ul className='grid grid-cols-3 gap-2 sm:grid-cols-4'>
          {cotizacion.imagenes.map((im) => (
            <li
              key={im.id}
              className='relative overflow-hidden rounded-lg border'
            >
              <img
                src={im.url}
                alt={im.nombre}
                className='aspect-square w-full bg-muted object-contain'
              />
              <Button
                type='button'
                size='icon'
                variant='secondary'
                className='absolute top-1 right-1 size-7'
                aria-label={`Quitar ${im.nombre}`}
                onClick={async () => {
                  try {
                    poner((await quitarImagen(cotizacion.id, im.id)).cotizacion)
                  } catch (e) {
                    toast.error(mensajeDeError(e))
                  }
                }}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={entrada}
        type='file'
        accept='image/jpeg,image/png,image/webp'
        multiple
        className='hidden'
        onChange={async (e) => {
          const archivos = Array.from(e.target.files ?? [])
          setSubiendo(true)
          for (const a of archivos) {
            try {
              poner((await subirReferencia(cotizacion.id, a)).cotizacion)
            } catch (err) {
              toast.error(mensajeDeError(err))
            }
          }
          setSubiendo(false)
          if (entrada.current) entrada.current.value = ''
        }}
      />
      <Button
        type='button'
        variant='outline'
        className='justify-self-start'
        disabled={subiendo}
        onClick={() => entrada.current?.click()}
      >
        {subiendo ? <Loader2 className='animate-spin' /> : <ImagePlus />}
        {subiendo ? 'Subiendo…' : 'Adjuntar imágenes del cliente'}
      </Button>
    </div>
  )
}

function DialogoPersonalizado({
  abierto,
  onCerrar,
  asegurarGuardada,
}: {
  abierto: boolean
  onCerrar: () => void
  asegurarGuardada: () => Promise<CotizacionDetalle>
}) {
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async () => {
    setError(null)
    setEnviando(true)
    try {
      const c = await asegurarGuardada()
      const r = await pedirPersonalizado(c.id, { nombre, descripcion })
      queryClient.invalidateQueries({ queryKey: ['taller'] })
      toast.success(
        `Listo. El taller recibió la solicitud (${r.sku}). Cuando le ponga precio podrás agregarla aquí.`
      )
      setNombre('')
      setDescripcion('')
      onCerrar()
    } catch (e) {
      setError({
        mensaje: mensajeDeError(e),
        campo: e instanceof ApiError ? e.campo : undefined,
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Pedir un personalizado al taller</DialogTitle>
          <DialogDescription>
            El taller lo diseña y le pone precio de fábrica. Cuando esté listo,
            lo agregas a esta cotización como cualquier producto.
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-4'>
          <Campo
            etiqueta='¿Qué quiere el cliente?'
            error={error?.campo === 'nombre' ? error.mensaje : undefined}
          >
            {(id) => (
              <Input
                id={id}
                value={nombre}
                placeholder='Ejemplo: Figura de su mascota'
                onChange={(e) => setNombre(e.target.value)}
              />
            )}
          </Campo>
          <Campo
            etiqueta='Detalles para el taller'
            ayuda='Tamaño, colores, cuántas unidades, para cuándo. Las fotos de referencia adjúntalas en el paso 5.'
            error={error?.campo === 'descripcion' ? error.mensaje : undefined}
          >
            {(id) => (
              <Textarea
                id={id}
                rows={4}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
              />
            )}
          </Campo>
          {error && !error.campo && (
            <p className='text-sm font-medium text-destructive'>
              {error.mensaje}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onCerrar}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={enviando}>
            {enviando ? <Loader2 className='animate-spin' /> : <Sparkles />}
            Enviar al taller
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
