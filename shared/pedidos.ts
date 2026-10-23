/**
 * Pedidos, órdenes de producción y pagos: tipos, nombres en español y reglas
 * que usan el servidor, la pantalla y la versión de prueba.
 */
import { type Cargo, type Modalidad } from './cotizacion.js'
import { type Entrega, type EstadoPago } from './entregas.js'

// ---------- Estados ----------

/**
 * El estado del pedido no lo mueve nadie a mano: se calcula con las órdenes,
 * los pagos y (desde la fase 5) la entrega.
 */
export const ESTADOS_PEDIDO = [
  'confirmado',
  'en_produccion',
  'listo',
  'en_entrega',
  'entregado',
  'cerrado',
  'cancelado',
] as const
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]

export const ESTADOS_PEDIDO_INFO: Record<EstadoPedido, { nombre: string; ayuda: string }> = {
  confirmado: {
    nombre: 'Esperando anticipo',
    ayuda: 'El cliente aceptó. Falta el anticipo para empezar a imprimir lo personalizado.',
  },
  en_produccion: { nombre: 'En producción', ayuda: 'El taller lo está fabricando.' },
  listo: { nombre: 'Listo', ayuda: 'Todo está impreso y empacado. Falta entregarlo.' },
  en_entrega: { nombre: 'En entrega', ayuda: 'Va camino al cliente.' },
  entregado: { nombre: 'Entregado', ayuda: 'El cliente lo recibió.' },
  cerrado: { nombre: 'Cerrado', ayuda: 'Entregado y pagado completo.' },
  cancelado: { nombre: 'Cancelado', ayuda: 'Se canceló y no sigue.' },
}

/** Pasos que se ven en la línea de tiempo del pedido (y del seguimiento). */
export const PASOS_PEDIDO: { estado: EstadoPedido; nombre: string }[] = [
  { estado: 'confirmado', nombre: 'Confirmado' },
  { estado: 'en_produccion', nombre: 'En producción' },
  { estado: 'listo', nombre: 'Listo' },
  { estado: 'en_entrega', nombre: 'En entrega' },
  { estado: 'entregado', nombre: 'Entregado' },
]

export const ESTADOS_ORDEN = [
  'espera_anticipo',
  'en_cola',
  'imprimiendo',
  'postproceso',
  'listo',
  'cancelada',
] as const
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number]

export const ESTADOS_ORDEN_INFO: Record<EstadoOrden, { nombre: string; ayuda: string }> = {
  espera_anticipo: {
    nombre: 'Espera el anticipo',
    ayuda: 'Entra a la cola cuando el cliente pague el anticipo.',
  },
  en_cola: { nombre: 'En cola', ayuda: 'Lista para imprimir, en orden de entrega.' },
  imprimiendo: { nombre: 'Imprimiendo', ayuda: 'Está en una impresora ahora mismo.' },
  postproceso: {
    nombre: 'Terminando',
    ayuda: 'Ya salió de la impresora: quitar soportes, limpiar y empacar.',
  },
  listo: { nombre: 'Listo', ayuda: 'Terminado y empacado.' },
  cancelada: { nombre: 'Cancelada', ayuda: 'Ya no se imprime.' },
}

/** Columnas del tablero de la cola. */
export const COLUMNAS_COLA: EstadoOrden[] = ['en_cola', 'imprimiendo', 'postproceso', 'listo']

export const METODOS_PAGO = ['efectivo', 'nequi', 'daviplata', 'transferencia', 'datafono'] as const
export type MetodoPago = (typeof METODOS_PAGO)[number]
export const METODOS_PAGO_INFO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  transferencia: 'Transferencia',
  datafono: 'Datáfono',
}

export type TipoPago = 'anticipo' | 'abono' | 'saldo' | 'reembolso'
export const TIPOS_PAGO_INFO: Record<TipoPago, string> = {
  anticipo: 'Anticipo',
  abono: 'Abono',
  saldo: 'Pago final',
  reembolso: 'Devolución',
}

// ---------- Tipos ----------

export type LineaPedido = {
  id: number
  productoId: number
  nombre: string
  descripcion: string
  imagen: string | null
  cantidad: number
  precioFabrica: number
  precioVenta: number
  personalizado: boolean
  /** Salió del stock: no se imprime. */
  desdeStock: boolean
  /** Estado de su orden (o "listo" si salió del stock). */
  estado: EstadoOrden
  /** Color escogido por el cliente (null si el producto no escoge color). */
  bobinaId: number | null
  color: string
  colorHex: string
}

export type Pago = {
  id: number
  tipo: TipoPago
  metodo: MetodoPago
  monto: number
  referencia: string
  usuario: string
  creadoEn: string
  /** Foto del comprobante (opcional). */
  comprobanteUrl: string | null
  /** Motivo de una devolución. */
  nota: string
}

export type EventoHistorial = {
  id: number
  /** null = nota sin cambio de estado */
  de: string | null
  a: string | null
  nota: string
  visibleCliente: boolean
  usuario: string
  creadoEn: string
}

export type PedidoResumen = {
  id: number
  codigo: string
  seguimiento: string
  estado: EstadoPedido
  cliente: { id: number; nombre: string }
  comercial: { id: number; nombre: string }
  total: number
  pagado: number
  /** Líneas listas / total de líneas */
  avance: { listas: number; total: number }
  fechaCompromiso: string | null
  creadoEn: string
  estadoPago: EstadoPago
}

export type PedidoDetalle = PedidoResumen & {
  cotizacion: { id: number; codigo: string }
  cliente: {
    id: number
    nombre: string
    whatsapp: string
    ciudad: string
    direccion: string
  }
  modalidad: Modalidad
  lineas: LineaPedido[]
  cargos: Cargo[]
  descuento: number
  subtotal: number
  ganancia: number
  anticipoPct: number
  anticipo: number
  requiereAnticipo: boolean
  producirSinAnticipo: boolean
  diasFabricacion: number
  diasEnvio: number
  notas: string
  motivoCancelacion: string
  numeroFactura: string
  entrega: Entrega | null
  pagos: Pago[]
  historial: EventoHistorial[]
}

export type OrdenCola = {
  id: number
  estado: EstadoOrden
  producto: {
    id: number
    nombre: string
    sku: string
    imagen: string | null
    multicolor: boolean
    impresoraSugeridaId: number | null
    bobinaSugeridaId: number | null
  }
  cantidad: number
  /** Color que hay que imprimir (lo pidió el cliente o es para stock de ese color). */
  color: { bobinaId: number; color: string; colorHex: string; material: string } | null
  /** Horas estimadas para toda la orden. */
  horas: number
  camas: number
  pedido: { id: number; codigo: string; cliente: string } | null
  fechaCompromiso: string | null
  impresoraId: number | null
  bobinaId: number | null
  operador: string | null
  inicio: string | null
  finEstimado: string | null
  finReal: string | null
  intentos: number
  gramosPerdidos: number
  motivoFalla: string
}

// ---------- Reglas ----------

/** PED-2026-0001 */
export function codigoPedido(anio: number, numero: number) {
  return `PED-${anio}-${String(numero).padStart(4, '0')}`
}

/** Letras y números que no se confunden al dictarlos (sin 0/O, 1/I/L). */
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** Código para que el cliente siga su pedido: HC-7K4P2Q */
export function codigoSeguimiento(azar: () => number = Math.random) {
  let c = ''
  for (let i = 0; i < 6; i++) c += ALFABETO[Math.floor(azar() * ALFABETO.length)]
  return `HC-${c}`
}

/** Tiempo de una orden: las horas de la ficha son por unidad. */
export function estimarOrden(horasPorUnidad: number, unidadesPorCama: number, cantidad: number) {
  return {
    horas: Math.round(horasPorUnidad * cantidad * 100) / 100,
    camas: Math.ceil(cantidad / Math.max(1, unidadesPorCama)),
  }
}

export function sumarHoras(desde: Date, horas: number) {
  return new Date(desde.getTime() + horas * 3_600_000)
}

/** Cuánto anticipo falta (0 si ya está o no aplica). */
export function anticipoPendiente(p: {
  requiereAnticipo: boolean
  anticipo: number
  pagado: number
}) {
  return p.requiereAnticipo ? Math.max(0, p.anticipo - p.pagado) : 0
}

/** ¿Puede imprimirse lo personalizado? */
export function puedeProducir(p: {
  requiereAnticipo: boolean
  producirSinAnticipo: boolean
  anticipo: number
  pagado: number
}) {
  return p.producirSinAnticipo || anticipoPendiente(p) === 0
}

/**
 * Estado del pedido a partir de sus líneas y pagos.
 * (La entrega se suma en la fase 5.)
 */
export function calcularEstadoPedido(p: {
  cancelado: boolean
  requiereAnticipo: boolean
  producirSinAnticipo: boolean
  anticipo: number
  pagado: number
  total: number
  estadosLineas: EstadoOrden[]
  entregado?: boolean
  enEntrega?: boolean
}): EstadoPedido {
  if (p.cancelado) return 'cancelado'
  if (p.entregado) return p.pagado >= p.total ? 'cerrado' : 'entregado'
  const activas = p.estadosLineas.filter((e) => e !== 'cancelada')
  const todoListo = activas.length > 0 && activas.every((e) => e === 'listo')
  // La entrega programada o en camino solo cuenta si ya está todo impreso
  if (p.enEntrega && todoListo) return 'en_entrega'
  if (!puedeProducir(p)) return 'confirmado'
  if (todoListo) return 'listo'
  return 'en_produccion'
}

/** Qué tipo de pago es, según lo que ya se ha pagado. */
export function tipoDePago(p: {
  requiereAnticipo: boolean
  anticipo: number
  total: number
  pagadoAntes: number
  monto: number
}): TipoPago {
  if (p.pagadoAntes + p.monto >= p.total) return 'saldo'
  if (p.requiereAnticipo && p.pagadoAntes < p.anticipo) return 'anticipo'
  return 'abono'
}

type Malo = { ok: false; mensaje: string; campo?: string }
const malo = (mensaje: string, campo?: string): Malo => ({ ok: false, mensaje, campo })
const fmt = (n: number) => `$\u00a0${n.toLocaleString('es-CO')}`

export type PagoEntrada = { monto: number; metodo: MetodoPago; referencia: string }

export function validarPago(
  c: Record<string, unknown>,
  saldo: number
): { ok: true; datos: PagoEntrada } | Malo {
  const monto = Math.round(Number(c.monto))
  if (!Number.isFinite(monto) || monto <= 0) {
    return malo('Escribe cuánto pagó el cliente. Ejemplo: 50000', 'monto')
  }
  if (saldo <= 0) return malo('Este pedido ya está pagado completo.', 'monto')
  if (monto > saldo) {
    return malo(`Es más de lo que falta por pagar (${fmt(saldo)}).`, 'monto')
  }
  const metodo = String(c.metodo ?? '') as MetodoPago
  if (!(METODOS_PAGO as readonly string[]).includes(metodo)) {
    return malo('Elige cómo pagó: efectivo, Nequi, Daviplata…', 'metodo')
  }
  const referencia = String(c.referencia ?? '').trim().slice(0, 80)
  return { ok: true, datos: { monto, metodo, referencia } }
}

export type FallaEntrada = { motivo: string; gramosPerdidos: number }

export function validarFalla(c: Record<string, unknown>): { ok: true; datos: FallaEntrada } | Malo {
  const motivo = String(c.motivo ?? '').trim().slice(0, 300)
  if (motivo.length < 3) {
    return malo('Cuenta qué pasó. Ejemplo: se despegó de la cama.', 'motivo')
  }
  const g = c.gramosPerdidos === '' || c.gramosPerdidos == null ? 0 : Number(c.gramosPerdidos)
  if (!Number.isFinite(g) || g < 0 || g > 5000) {
    return malo('Escribe los gramos que se perdieron (0 si no sabes).', 'gramosPerdidos')
  }
  return { ok: true, datos: { motivo, gramosPerdidos: Math.round(g) } }
}

/** La Kobra no imprime multicolor. */
export function validarImpresoraParaOrden(
  producto: { nombre: string; multicolor: boolean },
  impresora: { nombre: string; multicolor: boolean; activa: boolean } | undefined
): { ok: true } | Malo {
  if (!impresora) return malo('Elige en qué impresora se imprime.', 'impresoraId')
  if (!impresora.activa) return malo(`La ${impresora.nombre} está apagada en el sistema.`, 'impresoraId')
  if (producto.multicolor && !impresora.multicolor) {
    return malo(
      `"${producto.nombre}" es de varios colores y la ${impresora.nombre} solo imprime un color.`,
      'impresoraId'
    )
  }
  return { ok: true }
}

export function validarMotivoCancelacion(c: Record<string, unknown>): { ok: true; motivo: string } | Malo {
  const motivo = String(c.motivo ?? '').trim().slice(0, 300)
  if (motivo.length < 3) return malo('Escribe por qué se cancela.', 'motivo')
  return { ok: true, motivo }
}

export function validarNota(c: Record<string, unknown>): { ok: true; nota: string; visibleCliente: boolean } | Malo {
  const nota = String(c.nota ?? '').trim().slice(0, 500)
  if (nota.length < 2) return malo('Escribe la nota.', 'nota')
  return { ok: true, nota, visibleCliente: c.visibleCliente === true }
}

/**
 * Si la orden pide un color, la bobina que carga el taller debe ser de ese
 * mismo color y material (puede ser otro rollo igual).
 */
export function validarBobinaParaColor(
  pedido: { color: string; material: string } | null,
  elegida: { color: string; material: string } | null
): { ok: true } | { ok: false; mensaje: string; campo: string } {
  if (!pedido) return { ok: true }
  const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  if (!elegida) {
    return { ok: false, mensaje: `Esta orden es en ${pedido.color}: escoge la bobina que vas a usar.`, campo: 'bobinaId' }
  }
  if (!igual(pedido.color, elegida.color) || !igual(pedido.material, elegida.material)) {
    return {
      ok: false,
      mensaje: `Esta orden es en ${pedido.color} (${pedido.material}). Carga una bobina de ese color, no ${elegida.color} (${elegida.material}).`,
      campo: 'bobinaId',
    }
  }
  return { ok: true }
}
