import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  calcularCosto,
  esPrecioRedondo,
  precioMaximoComercial,
  redondearPrecio,
} from '@shared/costos'
import {
  CATEGORIAS_SUGERIDAS,
  ESTADOS_INFO,
  ESTADOS_PRODUCTO,
  type EstadoProducto,
  nombreColor,
  type ProductoDetalle,
  type TipoProducto,
} from '@shared/taller'
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  FileBox,
  ImagePlus,
  Loader2,
  PackagePlus,
  Save,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { tieneRol, useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Campo, CampoNumero } from '@/components/campo'
import { BotonesColor, EtiquetaColor } from '@/components/color'
import { Pagina } from '@/components/layout/pagina'
import { consultaConfiguracion } from '@/features/configuracion/api'
import {
  ajustarStock,
  borrarArchivo,
  consultaBobinas,
  consultaImpresoras,
  consultaProducto,
  guardarProducto,
  marcarPortada,
} from './api'
import { MuestraColor } from './bobinas'
import {
  formatoNumero,
  formatoPesos,
  formatoTamano,
  leerNumero,
  precioGramo,
} from './formato'
import { EstadoProductoBadge } from './productos-lista'
import { subirArchivo } from './subir-archivo'

// ============================================================
// Entrada: decide si se edita (Taller / Admin) o solo se mira (Comercial)
// ============================================================

export function ProductoFicha({ id }: { id: string }) {
  const usuario = useSesion()
  const puedeEditar = tieneRol(usuario, ['admin', 'fabricacion'])
  const nuevo = id === 'nuevo'
  const numero = nuevo ? 0 : Number(id)
  const {
    data: producto,
    isLoading,
    error,
  } = useQuery({
    ...consultaProducto(numero),
    enabled: !nuevo,
  })

  if (!nuevo && isLoading) {
    return (
      <Pagina titulo='Cargando producto…'>
        <Skeleton className='h-96 rounded-xl' />
      </Pagina>
    )
  }
  if (!nuevo && (error || !producto)) {
    return (
      <Pagina titulo='Producto no encontrado'>
        <p className='text-muted-foreground'>{mensajeDeError(error)}</p>
        <VolverAlTaller />
      </Pagina>
    )
  }
  if (!puedeEditar) return <VistaComercial producto={producto!} />
  return <Editor key={producto?.id ?? 'nuevo'} producto={producto ?? null} />
}

function VolverAlTaller() {
  const usuario = useSesion()
  const esTaller = tieneRol(usuario, ['admin', 'fabricacion'])
  return (
    <Button variant='ghost' asChild className='-ms-3 mb-2'>
      <Link to='/taller'>
        <ArrowLeft /> {esTaller ? 'Volver al Taller' : 'Volver al Catálogo'}
      </Link>
    </Button>
  )
}

// ============================================================
// Editor (Taller y Admin)
// ============================================================

type Formulario = {
  nombre: string
  descripcion: string
  categoria: string
  tipo: TipoProducto
  estado: EstadoProducto
  multicolor: boolean
  escogeColor: boolean
  colores: number[]
  diasFabricacion: string
  impresoraId: string
  bobinaId: string
  gramos: string
  horasH: string
  horasM: string
  unidadesPorCama: string
  minPreparacion: string
  minPostproceso: string
  horasDiseno: string
  unidadesLote: string
  empaque: string
  margenPct: number
  subirAMano: boolean
  precioManual: string
  notaAjuste: string
}

function formularioDe(
  p: ProductoDetalle | null,
  empaque: number,
  margen: number
): Formulario {
  const c = p?.costos
  const horas = c?.horas ?? 0
  return {
    nombre: p?.nombre ?? '',
    descripcion: p?.descripcion ?? '',
    categoria: p?.categoria ?? '',
    tipo: p?.tipo ?? 'catalogo',
    estado: p?.estado ?? 'costeo',
    multicolor: p?.multicolor ?? false,
    escogeColor: p?.escogeColor ?? false,
    colores: p?.colores.map((c) => c.bobinaId) ?? [],
    diasFabricacion: String(p?.diasFabricacion ?? 2),
    impresoraId: c?.impresoraId ? String(c.impresoraId) : '',
    bobinaId: c?.bobinaId ? String(c.bobinaId) : '',
    gramos: c ? formatoNumero(c.gramos) : '',
    horasH: c ? String(Math.floor(horas)) : '',
    horasM: c ? String(Math.round((horas % 1) * 60)) : '',
    unidadesPorCama: String(c?.unidadesPorCama ?? 1),
    minPreparacion: String(c?.minPreparacion ?? 5),
    minPostproceso: String(c?.minPostproceso ?? 5),
    horasDiseno: c ? formatoNumero(c.horasDiseno) : '0',
    unidadesLote: String(c?.unidadesLote ?? 1),
    empaque: String(c?.empaque ?? empaque),
    margenPct: c?.margenPct ?? margen,
    subirAMano: c?.precioManual != null,
    precioManual: c?.precioManual != null ? String(c.precioManual) : '',
    notaAjuste: c?.notaAjuste ?? '',
  }
}

function Editor({ producto }: { producto: ProductoDetalle | null }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: config } = useQuery(consultaConfiguracion)
  const { data: impresoras = [] } = useQuery(consultaImpresoras)
  const { data: bobinas = [] } = useQuery(consultaBobinas)

  const margenes = config
    ? [config.margen_fabrica_bajo, config.margen_fabrica_alto]
    : [40, 50]
  const [f, setF] = useState<Formulario>(() =>
    formularioDe(producto, config?.empaque_por_defecto ?? 300, margenes[1])
  )
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const set =
    <K extends keyof Formulario>(k: K) =>
    (v: Formulario[K]) =>
      setF((p) => ({ ...p, [k]: v }))
  const errorDe = (campo: string) =>
    error?.campo === campo ? error.mensaje : undefined

  const impresora =
    impresoras.find((i) => String(i.id) === f.impresoraId) ?? null
  const bobina = bobinas.find((b) => String(b.id) === f.bobinaId) ?? null
  const horas =
    (leerNumero(f.horasH || '0') || 0) + (leerNumero(f.horasM || '0') || 0) / 60

  const calculo = useMemo(
    () =>
      calcularCosto({
        gramos: leerNumero(f.gramos || '0') || 0,
        precioRollo: bobina?.precioRollo ?? 0,
        pesoRolloG: bobina?.pesoG ?? 0,
        horas,
        potenciaW: impresora ? impresora.potenciaW : 0,
        precioImpresora: impresora?.precioCompra ?? 0,
        vidaUtilH: impresora?.vidaUtilH ?? 0,
        minPreparacion: Number(f.minPreparacion) || 0,
        minPostproceso: Number(f.minPostproceso) || 0,
        horasDiseno: leerNumero(f.horasDiseno || '0') || 0,
        unidadesLote: Number(f.unidadesLote) || 1,
        empaque: Number(f.empaque) || 0,
        margenPct: f.margenPct,
        tarifaKwh: config?.tarifa_kwh ?? 0,
        tarifaHora: config?.tarifa_hora_mano_obra ?? 0,
        tarifaDiseno: config?.tarifa_hora_diseno ?? 0,
        fallaPct: config?.porcentaje_falla ?? 0,
      }),
    [f, horas, bobina, impresora, config]
  )

  const precioManual = f.subirAMano ? Number(f.precioManual) || 0 : null
  const precioFinal =
    precioManual && precioManual > calculo.precioCalculado
      ? precioManual
      : calculo.precioCalculado
  const tope = config?.tope_comercial ?? 25

  const guardar = useMutation({
    mutationFn: () =>
      guardarProducto(producto?.id ?? null, {
        nombre: f.nombre,
        descripcion: f.descripcion,
        categoria: f.categoria,
        tipo: f.tipo,
        estado: f.estado,
        multicolor: f.multicolor,
        escogeColor: f.escogeColor,
        colores: f.colores,
        diasFabricacion: f.diasFabricacion,
        impresoraId: f.impresoraId || null,
        bobinaId: f.bobinaId || null,
        gramos: leerNumero(f.gramos || '0'),
        horas: Math.round(horas * 100) / 100,
        unidadesPorCama: f.unidadesPorCama,
        minPreparacion: f.minPreparacion || 0,
        minPostproceso: f.minPostproceso || 0,
        horasDiseno: leerNumero(f.horasDiseno || '0'),
        unidadesLote: f.unidadesLote || 1,
        empaque: f.empaque || 0,
        margenPct: f.margenPct,
        precioManual: f.subirAMano && f.precioManual ? f.precioManual : null,
        notaAjuste: f.notaAjuste,
      }),
    onSuccess: ({ producto: guardado }) => {
      queryClient.setQueryData(['taller', 'producto', guardado.id], {
        producto: guardado,
      })
      queryClient.invalidateQueries({ queryKey: ['taller', 'productos'] })
      if (!producto) {
        toast.success('Producto creado. Ahora puedes subirle fotos y archivos.')
        navigate({
          to: '/taller/productos/$id',
          params: { id: String(guardado.id) },
          replace: true,
        })
      } else {
        toast.success('Cambios guardados.')
      }
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: 'No se pudo guardar. Intenta de nuevo.' }
      ),
  })

  const impresorasActivas = impresoras.filter(
    (i) => i.activa || String(i.id) === f.impresoraId
  )
  const bobinasActivas = bobinas.filter(
    (b) => b.activa || String(b.id) === f.bobinaId
  )

  return (
    <Pagina
      titulo={producto ? producto.nombre : 'Nuevo producto'}
      descripcion={
        producto
          ? `${producto.sku} · ${ESTADOS_INFO[producto.estado].explicacion}`
          : 'Llena lo que sepas; puedes guardarlo y completarlo después.'
      }
      acciones={producto && <BotonStock producto={producto} />}
    >
      <VolverAlTaller />
      <form
        className='grid gap-6 pb-28 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start'
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          guardar.mutate()
        }}
      >
        <div className='grid min-w-0 gap-6'>
          {/* ---------- Qué es ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Qué es</CardTitle>
              <CardDescription>
                Así lo verá el comercial al cotizar.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4 sm:grid-cols-2'>
              <Campo
                etiqueta='Nombre'
                error={errorDe('nombre')}
                className='sm:col-span-2'
              >
                {(id) => (
                  <Input
                    id={id}
                    value={f.nombre}
                    placeholder='Ejemplo: Llavero con logo en 3 colores'
                    onChange={(e) => set('nombre')(e.target.value)}
                  />
                )}
              </Campo>
              <Campo
                etiqueta='Descripción'
                ayuda='Medidas, colores, para qué sirve. Va en el PDF de la cotización.'
                className='sm:col-span-2'
              >
                {(id, ayudaId) => (
                  <Textarea
                    id={id}
                    aria-describedby={ayudaId}
                    rows={3}
                    value={f.descripcion}
                    onChange={(e) => set('descripcion')(e.target.value)}
                  />
                )}
              </Campo>
              <Campo etiqueta='Categoría' ayuda='Elige una o escribe otra.'>
                {(id, ayudaId) => (
                  <>
                    <Input
                      id={id}
                      list='categorias-sugeridas'
                      aria-describedby={ayudaId}
                      value={f.categoria}
                      onChange={(e) => set('categoria')(e.target.value)}
                    />
                    <datalist id='categorias-sugeridas'>
                      {CATEGORIAS_SUGERIDAS.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </>
                )}
              </Campo>
              <Campo etiqueta='Tipo'>
                {(id) => (
                  <Select
                    value={f.tipo}
                    onValueChange={(v) => set('tipo')(v as TipoProducto)}
                  >
                    <SelectTrigger id={id} className='w-full'>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='catalogo'>
                        De catálogo (se vende a todos)
                      </SelectItem>
                      <SelectItem value='personalizado'>
                        Personalizado (para un cliente)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Campo>
              <Campo
                etiqueta='¿En qué va?'
                ayuda={ESTADOS_INFO[f.estado].explicacion}
                error={errorDe('estado')}
                className='sm:col-span-2'
              >
                {(id) => (
                  <div
                    id={id}
                    role='radiogroup'
                    aria-label='Estado del producto'
                    className='flex flex-wrap gap-2'
                  >
                    {ESTADOS_PRODUCTO.map((e) => (
                      <button
                        key={e}
                        type='button'
                        role='radio'
                        aria-checked={f.estado === e}
                        onClick={() => set('estado')(e)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm transition-colors',
                          f.estado === e
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'hover:bg-accent'
                        )}
                      >
                        {ESTADOS_INFO[e].nombre}
                      </button>
                    ))}
                  </div>
                )}
              </Campo>
            </CardContent>
          </Card>

          {/* ---------- Fotos y archivos ---------- */}
          <SeccionArchivos producto={producto} />

          {/* ---------- Cómo se imprime ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Cómo se imprime</CardTitle>
              <CardDescription>
                Copia los datos que te da Bambu Studio al laminar.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4 sm:grid-cols-2'>
              <label className='flex items-center gap-3 sm:col-span-2'>
                <Checkbox
                  checked={f.multicolor}
                  onCheckedChange={(v) => set('multicolor')(v === true)}
                />
                Lleva varios colores
              </label>
              <Campo etiqueta='Impresora' error={errorDe('impresoraId')}>
                {(id) => (
                  <Select
                    value={f.impresoraId}
                    onValueChange={set('impresoraId')}
                  >
                    <SelectTrigger id={id} className='w-full'>
                      <SelectValue placeholder='Elige la impresora' />
                    </SelectTrigger>
                    <SelectContent>
                      {impresorasActivas.map((i) => (
                        <SelectItem
                          key={i.id}
                          value={String(i.id)}
                          disabled={f.multicolor && !i.multicolor}
                        >
                          {i.nombre}
                          {!i.multicolor && ' (un color)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Campo>
              <Campo
                etiqueta={f.multicolor ? 'Bobina de referencia' : 'Bobina'}
                ayuda={
                  bobina
                    ? `${formatoPesos(precioGramo(bobina))} por gramo`
                    : f.multicolor
                      ? 'Para varios colores usa la de precio más alto.'
                      : bobinas.length === 0
                        ? 'Primero agrega bobinas en la pestaña Bobinas.'
                        : undefined
                }
                error={errorDe('bobinaId')}
              >
                {(id) => (
                  <Select value={f.bobinaId} onValueChange={set('bobinaId')}>
                    <SelectTrigger id={id} className='w-full'>
                      <SelectValue placeholder='Elige la bobina' />
                    </SelectTrigger>
                    <SelectContent>
                      {bobinasActivas.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          <MuestraColor hex={b.colorHex} />
                          {b.material} · {b.color}
                          {b.serial && ` · ${b.serial}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Campo>
              <CampoNumero
                etiqueta='Gramos por unidad'
                unidad='g'
                decimales
                valor={f.gramos}
                onChange={set('gramos')}
                ayuda='El total del laminador, incluyendo purga y torre.'
                error={errorDe('gramos')}
              />
              <div className='grid content-start gap-1.5'>
                <span className='text-sm leading-none font-medium'>
                  Tiempo de impresión por unidad
                </span>
                <div className='grid grid-cols-2 gap-2'>
                  <CampoNumero
                    etiqueta='Horas'
                    unidad='h'
                    valor={f.horasH}
                    onChange={set('horasH')}
                  />
                  <CampoNumero
                    etiqueta='Minutos'
                    unidad='min'
                    valor={f.horasM}
                    onChange={set('horasM')}
                  />
                </div>
                {errorDe('horas') && (
                  <p className='text-sm font-medium text-destructive'>
                    {errorDe('horas')}
                  </p>
                )}
              </div>
              <CampoNumero
                etiqueta='Unidades por cama'
                valor={f.unidadesPorCama}
                onChange={set('unidadesPorCama')}
                ayuda='Cuántas caben en una impresión.'
                error={errorDe('unidadesPorCama')}
              />
              <CampoNumero
                etiqueta='Días para fabricarlo'
                unidad='días'
                valor={f.diasFabricacion}
                onChange={set('diasFabricacion')}
                ayuda='Se usa para la fecha de entrega en la cotización.'
                error={errorDe('diasFabricacion')}
              />
            </CardContent>
          </Card>

          {/* ---------- Colores para vender ---------- */}
          <TarjetaColores
            producto={producto}
            bobinas={bobinas}
            escogeColor={f.escogeColor}
            colores={f.colores}
            bobinaReferencia={f.bobinaId ? Number(f.bobinaId) : null}
            onEscoge={(v) =>
              setF((p) => ({
                ...p,
                escogeColor: v,
                // Al prenderlo, arranca con la bobina de referencia marcada
                colores:
                  v && p.colores.length === 0 && p.bobinaId
                    ? [Number(p.bobinaId)]
                    : p.colores,
              }))
            }
            onColores={set('colores')}
            error={errorDe('colores')}
          />

          {/* ---------- Trabajo a mano ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Trabajo a mano</CardTitle>
              <CardDescription>
                Cada hora vale{' '}
                {formatoPesos(config?.tarifa_hora_mano_obra ?? 0)} (se cambia en
                Configuración).
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4 sm:grid-cols-2'>
              <CampoNumero
                etiqueta='Preparar la impresión'
                unidad='min'
                valor={f.minPreparacion}
                onChange={set('minPreparacion')}
                ayuda='Limpiar la cama, cargar el archivo.'
                error={errorDe('minPreparacion')}
              />
              <CampoNumero
                etiqueta='Acabado y empaque'
                unidad='min'
                valor={f.minPostproceso}
                onChange={set('minPostproceso')}
                ayuda='Retirar, quitar soportes, limpiar, empacar.'
                error={errorDe('minPostproceso')}
              />
              <CampoNumero
                etiqueta='Horas de diseño'
                unidad='h'
                decimales
                valor={f.horasDiseno}
                onChange={set('horasDiseno')}
                ayuda={
                  f.tipo === 'personalizado'
                    ? 'Tiempo de modelado para este cliente.'
                    : 'Normalmente 0 en productos de catálogo.'
                }
                error={errorDe('horasDiseno')}
              />
              <CampoNumero
                etiqueta='Repartir el diseño entre'
                unidad='unid.'
                valor={f.unidadesLote}
                onChange={set('unidadesLote')}
                ayuda='Si el cliente pide 20, el diseño se divide entre 20.'
                error={errorDe('unidadesLote')}
              />
            </CardContent>
          </Card>
        </div>

        {/* ---------- Precio (columna derecha) ---------- */}
        <div className='grid min-w-0 gap-4 lg:sticky lg:top-20'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Precio de fábrica</CardTitle>
              <CardDescription>Se calcula mientras escribes.</CardDescription>
            </CardHeader>
            <CardContent className='grid gap-4'>
              <div className='grid gap-1.5'>
                <span className='text-sm font-medium'>
                  Tu margen de fábrica
                </span>
                <div
                  className='grid grid-cols-2 gap-2'
                  role='radiogroup'
                  aria-label='Margen de fábrica'
                >
                  {margenes.map((m) => (
                    <button
                      key={m}
                      type='button'
                      role='radio'
                      aria-checked={f.margenPct === m}
                      onClick={() => set('margenPct')(m)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-center font-semibold tabular-nums transition-colors',
                        f.margenPct === m
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'hover:bg-accent'
                      )}
                    >
                      {m} %
                    </button>
                  ))}
                </div>
                {errorDe('margenPct') && (
                  <p className='text-sm font-medium text-destructive'>
                    {errorDe('margenPct')}
                  </p>
                )}
              </div>

              <CampoNumero
                etiqueta='Empaque por unidad'
                unidad='COP'
                valor={f.empaque}
                onChange={set('empaque')}
                error={errorDe('empaque')}
              />

              <dl className='grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 text-sm'>
                <Linea nombre='Material' valor={calculo.material} />
                <Linea nombre='Luz' valor={calculo.energia} />
                <Linea
                  nombre='Desgaste de la impresora'
                  valor={calculo.desgaste}
                />
                <Linea nombre='Trabajo a mano' valor={calculo.manoObra} />
                {calculo.diseno > 0 && (
                  <Linea nombre='Diseño' valor={calculo.diseno} />
                )}
                <Linea
                  nombre={`Colchón por fallas (${config?.porcentaje_falla ?? 0} %)`}
                  valor={calculo.falla}
                />
                <Linea nombre='Empaque' valor={calculo.empaque} />
                <div className='col-span-2 my-1 border-t' />
                <dt className='font-medium'>Costo por unidad</dt>
                <dd className='text-end font-medium tabular-nums'>
                  {formatoPesos(calculo.costo)}
                </dd>
                <dt className='text-muted-foreground'>
                  + margen {f.margenPct} %, redondeado al mil
                </dt>
                <dd className='text-end tabular-nums'>
                  {formatoPesos(calculo.precioCalculado)}
                </dd>
              </dl>

              {calculo.avisos.length > 0 && (
                <ul className='grid gap-1 rounded-lg bg-marca-amarillo/20 p-3 text-sm'>
                  {calculo.avisos.map((a) => (
                    <li key={a} className='flex gap-2'>
                      <AlertTriangle className='mt-0.5 size-4 shrink-0 text-marca-naranja' />
                      {a}
                    </li>
                  ))}
                </ul>
              )}

              <label className='flex items-center gap-3 text-sm'>
                <Checkbox
                  checked={f.subirAMano}
                  onCheckedChange={(v) => set('subirAMano')(v === true)}
                />
                Quiero subir el precio a mano
              </label>
              {f.subirAMano && (
                <div className='grid gap-3'>
                  <CampoNumero
                    etiqueta='Precio de fábrica a mano'
                    unidad='COP'
                    valor={f.precioManual}
                    onChange={set('precioManual')}
                    ayuda={`Redondo a mil. Mínimo ${formatoPesos(calculo.precioCalculado)} (el calculado).`}
                    error={
                      errorDe('precioManual') ??
                      (Number(f.precioManual) > 0 &&
                      !esPrecioRedondo(Number(f.precioManual))
                        ? `Debe ser redondo a mil: usa ${formatoPesos(redondearPrecio(Number(f.precioManual)))}.`
                        : undefined)
                    }
                  />
                  <Campo
                    etiqueta='¿Por qué lo subes?'
                    error={errorDe('notaAjuste')}
                  >
                    {(id) => (
                      <Input
                        id={id}
                        value={f.notaAjuste}
                        placeholder='Ejemplo: diseño exclusivo, alta demanda'
                        onChange={(e) => set('notaAjuste')(e.target.value)}
                      />
                    )}
                  </Campo>
                </div>
              )}

              <div className='rounded-xl bg-accent p-4'>
                <p className='text-sm text-accent-foreground/80'>
                  Precio de fábrica
                </p>
                <p className='text-3xl font-bold text-primary tabular-nums'>
                  {formatoPesos(precioFinal)}
                </p>
                {precioFinal > 0 && (
                  <p className='mt-1 text-sm text-muted-foreground'>
                    El comercial podrá venderlo hasta{' '}
                    <strong className='text-foreground tabular-nums'>
                      {formatoPesos(precioMaximoComercial(precioFinal, tope))}
                    </strong>{' '}
                    (+{tope} %).
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---------- Barra de guardar ---------- */}
        <div className='sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur lg:col-span-2'>
          {error && (
            <p
              className='me-auto text-sm font-medium text-destructive'
              role='alert'
            >
              {error.mensaje}
            </p>
          )}
          <Button type='submit' size='lg' disabled={guardar.isPending}>
            {guardar.isPending ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Save />
            )}
            {producto ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </Pagina>
  )
}

function Linea({ nombre, valor }: { nombre: string; valor: number }) {
  return (
    <>
      <dt className='text-muted-foreground'>{nombre}</dt>
      <dd className='text-end tabular-nums'>{formatoPesos(valor)}</dd>
    </>
  )
}

// ============================================================
// Fotos y archivos
// ============================================================

function SeccionArchivos({ producto }: { producto: ProductoDetalle | null }) {
  const queryClient = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState<string | null>(null)

  const actualizar = (p: ProductoDetalle) => {
    queryClient.setQueryData(['taller', 'producto', p.id], { producto: p })
    queryClient.invalidateQueries({ queryKey: ['taller', 'productos'] })
  }

  const subir = async (archivos: FileList | null) => {
    if (!producto || !archivos?.length) return
    for (const archivo of Array.from(archivos)) {
      setSubiendo(archivo.name)
      try {
        const { producto: p } = await subirArchivo(producto.id, archivo)
        actualizar(p)
      } catch (e) {
        toast.error(mensajeDeError(e))
      }
    }
    setSubiendo(null)
    if (entrada.current) entrada.current.value = ''
  }

  const portada = useMutation({
    mutationFn: (archivoId: number) => marcarPortada(producto!.id, archivoId),
    onSuccess: ({ producto: p }) => {
      actualizar(p)
      toast.success('Foto principal cambiada.')
    },
  })
  const borrar = useMutation({
    mutationFn: (archivoId: number) => borrarArchivo(producto!.id, archivoId),
    onSuccess: ({ producto: p }) => {
      actualizar(p)
      toast.success('Archivo borrado.')
    },
  })

  const fotos = producto?.archivos.filter((a) => a.tipo === 'imagen') ?? []
  const otros = producto?.archivos.filter((a) => a.tipo !== 'imagen') ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Fotos y archivos</CardTitle>
        <CardDescription>
          La foto principal sale en el catálogo y en el PDF. Guarda aquí también
          el 3MF de cada cama.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4'>
        {!producto ? (
          <p className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
            Primero crea el producto (botón de abajo) y luego podrás subir fotos
            y archivos.
          </p>
        ) : (
          <>
            {fotos.length > 0 && (
              <ul className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
                {fotos.map((a) => (
                  <li
                    key={a.id}
                    className='group relative overflow-hidden rounded-lg border'
                  >
                    <img
                      src={a.url}
                      alt={a.nombre}
                      className='aspect-square w-full bg-muted object-contain p-2'
                    />
                    {a.esPortada && (
                      <Badge className='absolute top-2 left-2 bg-primary'>
                        <Star /> Principal
                      </Badge>
                    )}
                    <div className='absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2'>
                      {!a.esPortada && (
                        <Button
                          type='button'
                          size='sm'
                          variant='secondary'
                          onClick={() => portada.mutate(a.id)}
                        >
                          <Star /> Principal
                        </Button>
                      )}
                      <Button
                        type='button'
                        size='icon'
                        variant='secondary'
                        aria-label={`Borrar ${a.nombre}`}
                        onClick={() => borrar.mutate(a.id)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {otros.length > 0 && (
              <ul className='divide-y rounded-lg border'>
                {otros.map((a) => (
                  <li
                    key={a.id}
                    className='flex items-center gap-3 px-3 py-2 text-sm'
                  >
                    <FileBox className='size-5 shrink-0 text-muted-foreground' />
                    {a.url ? (
                      <a
                        href={a.url}
                        target='_blank'
                        rel='noreferrer'
                        className='min-w-0 flex-1 truncate underline-offset-4 hover:underline'
                      >
                        {a.nombre}
                      </a>
                    ) : (
                      <span className='min-w-0 flex-1 truncate'>
                        {a.nombre}
                      </span>
                    )}
                    <span className='text-muted-foreground tabular-nums'>
                      {formatoTamano(a.tamanoBytes)}
                    </span>
                    <Button
                      type='button'
                      size='icon'
                      variant='ghost'
                      aria-label={`Borrar ${a.nombre}`}
                      onClick={() => borrar.mutate(a.id)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <input
              ref={entrada}
              type='file'
              multiple
              accept='image/jpeg,image/png,image/webp,.3mf,.stl'
              className='hidden'
              onChange={(e) => subir(e.target.files)}
            />
            <Button
              type='button'
              variant='outline'
              className='justify-self-start'
              disabled={!!subiendo}
              onClick={() => entrada.current?.click()}
            >
              {subiendo ? <Loader2 className='animate-spin' /> : <ImagePlus />}
              {subiendo
                ? `Subiendo ${subiendo}…`
                : 'Subir fotos o archivos 3MF / STL'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Colores para vender
// ============================================================

function TarjetaColores({
  producto,
  bobinas,
  escogeColor,
  colores,
  bobinaReferencia,
  onEscoge,
  onColores,
  error,
}: {
  producto: ProductoDetalle | null
  bobinas: {
    id: number
    color: string
    colorHex: string
    material: string
    serial: string
    activa: boolean
  }[]
  escogeColor: boolean
  colores: number[]
  bobinaReferencia: number | null
  onEscoge: (v: boolean) => void
  onColores: (ids: number[]) => void
  error?: string
}) {
  const stockDe = new Map(producto?.colores.map((c) => [c.bobinaId, c.stock]))
  const opciones = bobinas
    .filter((b) => b.activa || colores.includes(b.id))
    .map((b) => {
      const stock = stockDe.get(b.id) ?? 0
      return {
        bobinaId: b.id,
        color: b.color,
        colorHex: b.colorHex,
        detalle: [b.material, b.serial, stock > 0 && `${stock} en stock`]
          .filter(Boolean)
          .join(' · '),
      }
    })
  // Lo que ya había impreso, al prender los colores, queda en este color
  const sinColor = producto && !producto.escogeColor ? producto.stock : 0
  const destino =
    bobinaReferencia && colores.includes(bobinaReferencia)
      ? bobinaReferencia
      : colores[0]
  const nombreDestino = bobinas.find((b) => b.id === destino)?.color

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Colores para vender</CardTitle>
        <CardDescription>
          Si este producto se hace en varios colores, el comercial escoge uno al
          cotizar. El precio es el mismo en todos.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4'>
        <label className='flex items-start gap-3'>
          <Switch
            checked={escogeColor}
            onCheckedChange={onEscoge}
            className='mt-0.5'
          />
          <span className='grid gap-0.5'>
            <span className='font-medium'>El cliente puede escoger el color</span>
            <span className='text-sm text-muted-foreground'>
              {escogeColor
                ? 'Marca solo los colores que se venden en este modelo.'
                : 'Apagado: siempre se hace con la bobina de arriba.'}
            </span>
          </span>
        </label>
        {escogeColor && (
          <div className='grid gap-2'>
            <span className='text-sm font-medium'>
              Colores preaprobados ({colores.length})
            </span>
            {opciones.length === 0 ? (
              <p className='text-sm text-muted-foreground'>
                Primero agrega bobinas en la pestaña Bobinas.
              </p>
            ) : (
              <BotonesColor
                multiple
                etiqueta='Colores preaprobados'
                opciones={opciones}
                seleccion={colores}
                onChange={onColores}
                invalido={!!error}
              />
            )}
            {error ? (
              <p className='text-sm font-medium text-destructive'>{error}</p>
            ) : (
              <p className='text-sm text-muted-foreground'>
                Mínimo 2. Las demás bobinas del taller no le aparecen al comercial.
              </p>
            )}
            {sinColor > 0 && nombreDestino && (
              <p className='rounded-lg bg-marca-amarillo/20 p-3 text-sm'>
                Las {sinColor} unidades que ya hay en stock quedarán como{' '}
                <strong>{nombreDestino}</strong>. Si son de otros colores,
                repártelas después con “Stock”.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================
// Stock
// ============================================================

function BotonStock({ producto }: { producto: ProductoDetalle }) {
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<'entra' | 'sale'>('entra')
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [color, setColor] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const n = Number(cantidad) || 0
  const conColor = producto.escogeColor
  const elegido = producto.colores.find((c) => c.bobinaId === color)

  const guardar = useMutation({
    mutationFn: () =>
      ajustarStock(producto.id, modo === 'entra' ? n : -n, nota, color),
    onSuccess: ({ stock }) => {
      queryClient.invalidateQueries({ queryKey: ['taller'] })
      toast.success(
        elegido
          ? `Listo. Ahora hay ${elegido.stock + (modo === 'entra' ? n : -n)} en ${elegido.color} (${stock} en total).`
          : `Listo. Ahora hay ${stock} en stock.`
      )
      setAbierto(false)
      setCantidad('')
      setNota('')
      setError(null)
    },
    onError: (e) => setError(mensajeDeError(e)),
  })

  return (
    <>
      <Button variant='outline' onClick={() => setAbierto(true)}>
        <PackagePlus />
        Stock: <span className='tabular-nums'>{producto.stock}</span>
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
            <DialogDescription>
              Hoy hay {producto.stock} unidades de {producto.nombre} ya
              impresas
              {conColor && producto.colores.length > 0
                ? `: ${producto.colores
                    .map((c) => `${c.stock} ${c.color.toLowerCase()}`)
                    .join(', ')}.`
                : '.'}
            </DialogDescription>
          </DialogHeader>
          <div
            className='grid grid-cols-2 gap-2'
            role='radiogroup'
            aria-label='Entra o sale'
          >
            {(['entra', 'sale'] as const).map((m) => (
              <button
                key={m}
                type='button'
                role='radio'
                aria-checked={modo === m}
                onClick={() => setModo(m)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm font-medium',
                  modo === m
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
              >
                {m === 'entra'
                  ? 'Entran (se imprimieron)'
                  : 'Salen (dañadas, regalo…)'}
              </button>
            ))}
          </div>
          {conColor && (
            <div className='grid gap-2'>
              <span className='text-sm font-medium'>¿De qué color?</span>
              <BotonesColor
                etiqueta='Color de las unidades'
                opciones={producto.colores.map((c) => ({
                  bobinaId: c.bobinaId,
                  color: c.color,
                  colorHex: c.colorHex,
                  detalle: `${c.stock} en stock`,
                }))}
                seleccion={color ? [color] : []}
                onChange={([id]) => setColor(id ?? null)}
              />
            </div>
          )}
          <CampoNumero
            etiqueta='Cantidad'
            unidad='unid.'
            valor={cantidad}
            onChange={setCantidad}
          />
          <Campo etiqueta='Nota (opcional)'>
            {(id) => (
              <Input
                id={id}
                value={nota}
                placeholder='Ejemplo: lote de octubre'
                onChange={(e) => setNota(e.target.value)}
              />
            )}
          </Campo>
          {error && (
            <p className='text-sm font-medium text-destructive' role='alert'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setAbierto(false)}>
              Cancelar
            </Button>
            <Button
              disabled={n <= 0 || (conColor && !color) || guardar.isPending}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending && <Loader2 className='animate-spin' />}
              {modo === 'entra' ? `Sumar ${n || ''}` : `Restar ${n || ''}`}
              {elegido && ` ${elegido.color.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ============================================================
// Vista del comercial (solo lectura, sin costos)
// ============================================================

function VistaComercial({ producto }: { producto: ProductoDetalle }) {
  const { data: config } = useQuery(consultaConfiguracion)
  const tope = config?.tope_comercial ?? 25
  const fotos = producto.archivos.filter((a) => a.tipo === 'imagen')
  const [foto, setFoto] = useState(0)

  return (
    <Pagina
      titulo={producto.nombre}
      descripcion={`${producto.sku} · ${producto.categoria || 'Sin categoría'}`}
    >
      <VolverAlTaller />
      <div className='grid gap-6 md:grid-cols-2'>
        <div className='grid gap-3'>
          <div className='aspect-square overflow-hidden rounded-xl border bg-muted'>
            {fotos[foto] ? (
              <img
                src={fotos[foto].url}
                alt={producto.nombre}
                className='size-full object-contain p-4'
              />
            ) : (
              <div className='flex size-full items-center justify-center text-muted-foreground'>
                <Box className='size-12 opacity-50' />
              </div>
            )}
          </div>
          {fotos.length > 1 && (
            <div className='flex gap-2 overflow-x-auto'>
              {fotos.map((a, i) => (
                <button
                  key={a.id}
                  type='button'
                  onClick={() => setFoto(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  className={cn(
                    'size-16 shrink-0 overflow-hidden rounded-lg border-2',
                    i === foto ? 'border-primary' : 'border-transparent'
                  )}
                >
                  <img src={a.url} alt='' className='size-full object-cover' />
                </button>
              ))}
            </div>
          )}
        </div>
        <Card>
          <CardContent className='grid gap-4'>
            <div className='flex flex-wrap gap-2'>
              <EstadoProductoBadge estado={producto.estado} />
              {producto.multicolor && (
                <Badge variant='secondary'>Varios colores</Badge>
              )}
              {producto.tipo === 'personalizado' && (
                <Badge variant='secondary'>Personalizado</Badge>
              )}
            </div>
            {producto.descripcion && <p>{producto.descripcion}</p>}
            <div className='rounded-xl bg-accent p-4'>
              <p className='text-sm text-accent-foreground/80'>
                Precio de fábrica
              </p>
              <p className='text-3xl font-bold text-primary tabular-nums'>
                {producto.precioFabrica > 0
                  ? formatoPesos(producto.precioFabrica)
                  : 'Sin precio aún'}
              </p>
              {producto.precioFabrica > 0 && (
                <p className='mt-1 text-sm text-muted-foreground'>
                  Puedes venderlo entre {formatoPesos(producto.precioFabrica)} y{' '}
                  <strong className='text-foreground tabular-nums'>
                    {formatoPesos(
                      precioMaximoComercial(producto.precioFabrica, tope)
                    )}
                  </strong>
                  . Lo que subas es tu ganancia.
                </p>
              )}
            </div>
            <dl className='grid grid-cols-2 gap-y-2 text-sm'>
              <dt className='text-muted-foreground'>Días para fabricarlo</dt>
              <dd className='text-end tabular-nums'>
                {producto.diasFabricacion}
              </dd>
              <dt className='text-muted-foreground'>Ya impresos en stock</dt>
              <dd className='text-end tabular-nums'>{producto.stock}</dd>
            </dl>
            {producto.escogeColor && (
              <div className='grid gap-2'>
                <p className='text-sm font-medium'>
                  Colores que puedes ofrecer
                </p>
                <ul className='flex flex-wrap gap-2'>
                  {producto.colores.map((c) => (
                    <li key={c.bobinaId}>
                      <EtiquetaColor
                        color={`${nombreColor(c)} · ${c.stock} en stock`}
                        colorHex={c.colorHex}
                        className='text-sm'
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {producto.estado !== 'activo' && (
              <p className='rounded-lg bg-marca-amarillo/20 p-3 text-sm'>
                {ESTADOS_INFO[producto.estado].explicacion}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Pagina>
  )
}
