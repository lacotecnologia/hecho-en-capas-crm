/**
 * Comisiones del comercial. La comisión es la ganancia del pedido
 * (venta − fábrica − descuento); se gana cuando el pedido queda Cerrado
 * y el administrador la paga cuando decide.
 * Lo usan el servidor y la pantalla para que den lo mismo.
 */

/** Ganan comisión las personas con rol Comercial que no son administradoras. */
export function ganaComision(roles: readonly string[]) {
  return roles.includes('comercial') && !roles.includes('admin')
}

export const TIPOS_MOVIMIENTO = ['ganada', 'descuento', 'ajuste'] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]
export const TIPOS_MOVIMIENTO_INFO: Record<TipoMovimiento, string> = {
  ganada: 'Pedido cerrado',
  descuento: 'Devolución al cliente',
  ajuste: 'Ajuste del administrador',
}

export const METODOS_COMISION = [
  'efectivo',
  'nequi',
  'daviplata',
  'transferencia',
  'por_fuera',
] as const
export type MetodoComision = (typeof METODOS_COMISION)[number]
export const METODOS_COMISION_INFO: Record<MetodoComision, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  transferencia: 'Transferencia',
  por_fuera: 'Ya se pagó por fuera',
}

export type MovimientoComision = {
  id: number
  tipo: TipoMovimiento
  monto: number
  nota: string
  pedido: { id: number; codigo: string; cliente: string } | null
  creadoEn: string
  pagoId: number | null
}

export type PagoComision = {
  id: number
  total: number
  metodo: MetodoComision
  referencia: string
  comprobanteUrl: string | null
  nota: string
  porFuera: boolean
  pagadoPor: string
  creadoEn: string
  /** Lo que se liquidó en este pago. */
  movimientos: MovimientoComision[]
}

/** Pedidos abiertos del comercial: su comisión todavía no se ha ganado. */
export type PedidoPorGanar = {
  id: number
  codigo: string
  cliente: string
  estado: string
  ganancia: number
}

export type ResumenComisiones = {
  comercial: { id: number; nombre: string; activo: boolean }
  /** Ganancia de pedidos abiertos (aún no cerrados). */
  porGanar: number
  /** Ganado y no pagado (puede ser negativo si hay descuentos). */
  porPagar: number
  /** Pagado en el mes actual (hora de Colombia). */
  pagadoMes: number
  pedidosPorGanar: PedidoPorGanar[]
  pendientes: MovimientoComision[]
  pagos: PagoComision[]
}

// ---------- Reglas ----------

type Malo = { ok: false; mensaje: string; campo?: string }
const malo = (mensaje: string, campo?: string): Malo => ({ ok: false, mensaje, campo })
const fmt = (n: number) => `$\u00a0${n.toLocaleString('es-CO')}`

/** Saldo por pagar = suma de los movimientos sin pago. */
export function saldoPendiente(movs: { monto: number; pagoId: number | null }[]) {
  return movs.filter((m) => m.pagoId === null).reduce((s, m) => s + m.monto, 0)
}

/**
 * Cuánto se descuenta de la comisión por una devolución al cliente:
 * lo devuelto, pero nunca más de lo que le queda de comisión en ese pedido.
 */
export function descuentoPorDevolucion(devuelto: number, comisionRestante: number) {
  return Math.max(0, Math.min(devuelto, comisionRestante))
}

export type PagoComisionEntrada = {
  metodo: MetodoComision
  referencia: string
  comprobanteUrl: string | null
  nota: string
  /** El saldo que vio el administrador al pagar (para no pagar algo distinto). */
  total: number
}

export function validarPagoComision(
  c: Record<string, unknown>,
  saldo: number
): { ok: true; datos: PagoComisionEntrada } | Malo {
  const metodo = String(c.metodo ?? '') as MetodoComision
  if (!(METODOS_COMISION as readonly string[]).includes(metodo)) {
    return malo('Escoge cómo le pagaste: efectivo, Nequi, Daviplata o transferencia.', 'metodo')
  }
  const total = Math.round(Number(c.total))
  if (saldo <= 0) {
    return malo(
      saldo < 0
        ? `No hay nada que pagar: los descuentos superan lo ganado por ${fmt(-saldo)}. Se compensa con las próximas comisiones.`
        : 'No hay comisiones por pagar.'
    )
  }
  if (total !== saldo) {
    return malo(
      `Lo pendiente cambió mientras mirabas: ahora es ${fmt(saldo)}. Revisa y vuelve a darle a Pagar.`,
      'total'
    )
  }
  const referencia = String(c.referencia ?? '').trim().slice(0, 80)
  const nota = String(c.nota ?? '').trim().slice(0, 300)
  const url = c.comprobanteUrl ? String(c.comprobanteUrl) : null
  if (metodo !== 'efectivo' && metodo !== 'por_fuera' && !referencia && !url) {
    return malo(
      'Escribe la referencia de la transferencia o sube la foto del comprobante.',
      'referencia'
    )
  }
  return { ok: true, datos: { metodo, referencia, comprobanteUrl: url, nota, total } }
}

export function validarAjusteComision(
  c: Record<string, unknown>
): { ok: true; datos: { monto: number; nota: string } } | Malo {
  const monto = Math.round(Number(c.monto))
  if (!Number.isFinite(monto) || monto === 0 || Math.abs(monto) > 10_000_000) {
    return malo('Escribe el valor del ajuste (más de 0).', 'monto')
  }
  const nota = String(c.nota ?? '').trim().slice(0, 300)
  if (nota.length < 5) {
    return malo('Escribe por qué haces el ajuste (queda en el historial del comercial).', 'nota')
  }
  return { ok: true, datos: { monto, nota } }
}
