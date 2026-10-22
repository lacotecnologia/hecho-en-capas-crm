/**
 * Reglas de la cotización. Las usan el servidor, la pantalla (resumen en
 * vivo) y la versión de prueba, para que todos den el mismo total.
 */
import { precioMaximoComercial } from './costos.js'

// ---------- Estados ----------

export const ESTADOS_COTIZACION = [
  'borrador',
  'enviada',
  'aprobada',
  'rechazada',
  'vencida',
  'reemplazada',
] as const
export type EstadoCotizacion = (typeof ESTADOS_COTIZACION)[number]

export const ESTADOS_COT_INFO: Record<
  EstadoCotizacion,
  { nombre: string; explicacion: string }
> = {
  borrador: {
    nombre: 'Borrador',
    explicacion: 'Todavía no se ha enviado. Puedes cambiar lo que quieras.',
  },
  enviada: {
    nombre: 'Enviada',
    explicacion: 'El cliente la tiene. Falta saber si la acepta.',
  },
  aprobada: {
    nombre: 'Aprobada',
    explicacion: 'El cliente aceptó. Lista para convertirla en pedido.',
  },
  rechazada: {
    nombre: 'No aceptada',
    explicacion: 'El cliente no la aceptó.',
  },
  vencida: {
    nombre: 'Vencida',
    explicacion: 'Pasaron los días de vigencia sin respuesta.',
  },
  reemplazada: {
    nombre: 'Cambiada',
    explicacion: 'Se hizo una versión nueva de esta cotización.',
  },
}

// ---------- Entrega ----------

export const MODALIDADES = ['recoge', 'local', 'nacional'] as const
export type Modalidad = (typeof MODALIDADES)[number]

export const MODALIDADES_INFO: Record<Modalidad, { nombre: string; corto: string }> = {
  recoge: { nombre: 'Recoge en el taller', corto: 'Recoge' },
  local: { nombre: 'Domicilio en Pereira y área metropolitana', corto: 'Domicilio' },
  nacional: { nombre: 'Envío nacional con transportadora', corto: 'Envío nacional' },
}

export const CARGOS_SUGERIDOS = [
  'Envío',
  'Diseño adicional',
  'Empaque especial',
  'Urgencia',
]

// ---------- Tipos ----------

export type Cliente = {
  id: number
  nombre: string
  whatsapp: string
  email: string
  ciudad: string
  direccion: string
  documento: string
}

export type LineaCotizacion = {
  productoId: number
  nombre: string
  descripcion: string
  imagen: string | null
  cantidad: number
  precioFabrica: number
  precioVenta: number
  personalizado: boolean
  diasFabricacion: number
  /** Hay stock suficiente: no hay que imprimir. */
  desdeStock: boolean
}

export type Cargo = { concepto: string; valor: number }

export type ResumenCotizacion = {
  subtotal: number
  cargos: number
  descuento: number
  total: number
  /** Lo que gana el comercial (venta − fábrica − descuento). No sale en el PDF. */
  ganancia: number
  anticipoPct: number
  anticipo: number
  saldo: number
  diasFabricacion: number
  diasEnvio: number
}

export type CotizacionResumen = {
  id: number
  codigo: string
  version: number
  estado: EstadoCotizacion
  cliente: { id: number; nombre: string } | null
  comercial: { id: number; nombre: string }
  total: number
  ganancia: number
  lineas: number
  creadaEn: string
  enviadaEn: string | null
  venceEn: string | null
}

export type CotizacionDetalle = Omit<CotizacionResumen, 'cliente' | 'lineas'> & {
  cliente: Cliente | null
  modalidad: Modalidad
  lineas: LineaCotizacion[]
  cargos: Cargo[]
  notas: string
  motivoRechazo: string
  imagenes: { id: number; url: string; nombre: string }[]
  resumen: ResumenCotizacion
  /** Id de la versión siguiente, si esta fue cambiada. */
  reemplazadaPor: number | null
}

// ---------- Cálculos ----------

/** Valores de Configuración que usa la cotización (anticipo y días de envío). */
type ConfigCotizacion = Record<string, number>

export function diasDeEnvio(modalidad: Modalidad, config: ConfigCotizacion) {
  if (modalidad === 'local') return config.dias_envio_local ?? 0
  if (modalidad === 'nacional') return config.dias_envio_nacional ?? 0
  return 0
}

export function calcularCotizacion(
  lineas: Pick<
    LineaCotizacion,
    'cantidad' | 'precioFabrica' | 'precioVenta' | 'personalizado' | 'diasFabricacion' | 'desdeStock'
  >[],
  cargos: Cargo[],
  descuento: number,
  modalidad: Modalidad,
  config: ConfigCotizacion
): ResumenCotizacion {
  const subtotal = lineas.reduce((s, l) => s + l.cantidad * l.precioVenta, 0)
  const fabrica = lineas.reduce((s, l) => s + l.cantidad * l.precioFabrica, 0)
  const totalCargos = cargos.reduce((s, c) => s + c.valor, 0)
  const total = Math.max(0, subtotal + totalCargos - descuento)
  const hayPersonalizado = lineas.some((l) => l.personalizado)
  const anticipoPct = hayPersonalizado ? (config.anticipo_personalizados ?? 0) : 0
  const anticipo = Math.round((total * anticipoPct) / 100)
  return {
    subtotal,
    cargos: totalCargos,
    descuento,
    total,
    ganancia: subtotal - fabrica - descuento,
    anticipoPct,
    anticipo,
    saldo: total - anticipo,
    diasFabricacion: Math.max(
      0,
      ...lineas.map((l) => (l.desdeStock ? 0 : l.diasFabricacion))
    ),
    diasEnvio: diasDeEnvio(modalidad, config),
  }
}

/** Suma días sin contar domingos. Devuelve la fecha en formato AAAA-MM-DD. */
export function sumarDiasHabiles(desde: Date, dias: number) {
  const fecha = new Date(desde)
  let quedan = dias
  while (quedan > 0) {
    fecha.setDate(fecha.getDate() + 1)
    if (fecha.getDay() !== 0) quedan--
  }
  return fecha
}

/** COT-2026-0007, y COT-2026-0007-v2 desde la segunda versión. */
export function codigoCotizacion(anio: number, numero: number, version: number) {
  const base = `COT-${anio}-${String(numero).padStart(4, '0')}`
  return version > 1 ? `${base}-v${version}` : base
}

// ---------- Validaciones ----------

export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; mensaje: string; campo?: string }

const malo = (mensaje: string, campo?: string) => ({ ok: false, mensaje, campo }) as const
const fmt = (n: number) => `$\u00a0${n.toLocaleString('es-CO')}`

export type ClienteEntrada = Omit<Cliente, 'id'>

export function validarCliente(c: Record<string, unknown>): Resultado<ClienteEntrada> {
  const t = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
  const nombre = t(c.nombre, 120)
  if (nombre.length < 2) return malo('Escribe el nombre del cliente.', 'nombre')
  const whatsapp = t(c.whatsapp, 30)
  if (whatsapp && !/^[+\d\s()-]{7,30}$/.test(whatsapp)) {
    return malo('El WhatsApp solo lleva números. Ejemplo: 300 123 4567', 'whatsapp')
  }
  const email = t(c.email, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return malo('El correo no se ve bien escrito. Ejemplo: nombre@gmail.com', 'email')
  }
  return {
    ok: true,
    datos: {
      nombre,
      whatsapp,
      email,
      ciudad: t(c.ciudad, 60),
      direccion: t(c.direccion, 200),
      documento: t(c.documento, 30),
    },
  }
}

/** Lo que manda la pantalla al guardar. */
export type CotizacionEntrada = {
  clienteId: number | null
  modalidad: Modalidad
  lineas: { productoId: number; cantidad: number; precioVenta: number }[]
  cargos: Cargo[]
  descuento: number
  notas: string
}

export function leerEntradaCotizacion(
  c: Record<string, unknown>
): Resultado<CotizacionEntrada> {
  const entero = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.round(n) : NaN
  }
  const modalidad = (MODALIDADES as readonly string[]).includes(String(c.modalidad))
    ? (c.modalidad as Modalidad)
    : 'local'
  const lineasCrudas = Array.isArray(c.lineas) ? c.lineas : []
  if (lineasCrudas.length > 50) return malo('Una cotización puede tener hasta 50 productos.')
  const lineas = lineasCrudas.map((l: Record<string, unknown>) => ({
    productoId: entero(l?.productoId),
    cantidad: entero(l?.cantidad),
    precioVenta: entero(l?.precioVenta),
  }))
  for (const l of lineas) {
    if (!(l.cantidad >= 1 && l.cantidad <= 100_000)) {
      return malo('La cantidad de cada producto debe ser 1 o más.', 'lineas')
    }
    if (!(l.precioVenta >= 0)) return malo('Escribe el precio de venta de cada producto.', 'lineas')
  }
  const cargosCrudos = Array.isArray(c.cargos) ? c.cargos : []
  if (cargosCrudos.length > 10) return malo('Puedes agregar hasta 10 cargos.')
  const cargos: Cargo[] = []
  for (const x of cargosCrudos as Record<string, unknown>[]) {
    const concepto = String(x?.concepto ?? '').trim().slice(0, 60)
    const valor = entero(x?.valor)
    if (!concepto) return malo('Escribe qué es cada cargo. Ejemplo: Envío.', 'cargos')
    if (!(valor >= 0 && valor <= 100_000_000)) {
      return malo(`Escribe el valor de "${concepto}".`, 'cargos')
    }
    cargos.push({ concepto, valor })
  }
  const descuento = c.descuento === '' || c.descuento == null ? 0 : entero(c.descuento)
  if (!(descuento >= 0)) return malo('El descuento debe ser 0 o más.', 'descuento')
  const clienteId = entero(c.clienteId)
  return {
    ok: true,
    datos: {
      clienteId: clienteId > 0 ? clienteId : null,
      modalidad,
      lineas,
      cargos,
      descuento,
      notas: String(c.notas ?? '').trim().slice(0, 1000),
    },
  }
}

type ProductoParaCotizar = {
  id: number
  nombre: string
  estado: string
  precioFabrica: number
}

/** Reglas de precio por línea y del descuento. */
export function validarPreciosCotizacion(
  lineas: { productoId: number; cantidad: number; precioVenta: number }[],
  productos: Map<number, ProductoParaCotizar>,
  descuento: number,
  topePct: number
): Resultado<true> {
  let ganancia = 0
  for (const l of lineas) {
    const p = productos.get(l.productoId)
    if (!p) return malo('Uno de los productos ya no existe. Quítalo de la cotización.', 'lineas')
    if (p.estado !== 'activo') {
      return malo(
        `"${p.nombre}" no está listo para vender. Pídele al taller que le ponga precio.`,
        'lineas'
      )
    }
    const maximo = precioMaximoComercial(p.precioFabrica, topePct)
    if (l.precioVenta < p.precioFabrica) {
      return malo(
        `El precio de "${p.nombre}" no puede ser menor que el de fábrica (${fmt(p.precioFabrica)}).`,
        'lineas'
      )
    }
    if (l.precioVenta > maximo) {
      return malo(
        `El precio de "${p.nombre}" pasa el tope del ${topePct} %: el máximo es ${fmt(maximo)}.`,
        'lineas'
      )
    }
    ganancia += (l.precioVenta - p.precioFabrica) * l.cantidad
  }
  if (descuento > ganancia) {
    return malo(
      `El descuento no puede ser mayor que tu ganancia (${fmt(ganancia)}); si no, se vendería por debajo del precio de fábrica.`,
      'descuento'
    )
  }
  return { ok: true, datos: true }
}

/** Lo que debe tener una cotización para poder enviarla. */
export function validarParaEnviar(c: {
  clienteId: number | null
  lineas: unknown[]
}): Resultado<true> {
  if (!c.clienteId) return malo('Elige el cliente antes de enviar la cotización.', 'clienteId')
  if (c.lineas.length === 0) return malo('Agrega al menos un producto antes de enviarla.', 'lineas')
  return { ok: true, datos: true }
}
