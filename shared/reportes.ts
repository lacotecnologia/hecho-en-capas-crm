/** Reportes del mes: ventas, ganancia de cada comercial, cuentas por cobrar y productos. */
import { type EstadoPago } from './entregas.js'

export type ReporteMes = {
  /** AAAA-MM */
  mes: string
  ventas: { total: number; pedidos: number; ticket: number; cobrado: number }
  /** Ventas de cada día del mes (pedidos creados ese día). */
  porDia: { dia: number; total: number; pedidos: number }[]
  comerciales: {
    id: number
    nombre: string
    pedidos: number
    ventas: number
    ganancia: number
    /** Ganancia de los pedidos que ya están pagados completos: lista para liquidar. */
    gananciaPagada: number
  }[]
  pedidos: {
    id: number
    codigo: string
    cliente: string
    comercial: string
    fecha: string
    total: number
    ganancia: number
    estadoPago: EstadoPago
  }[]
  /** Pedidos entregados que aún deben plata (de cualquier mes). */
  porCobrar: {
    id: number
    codigo: string
    cliente: string
    whatsapp: string
    comercial: string
    entregadoEn: string | null
    saldo: number
  }[]
  productos: { productoId: number; nombre: string; unidades: number; ventas: number }[]
  envios: { cobrado: number; costoReal: number; conCosto: number }
}

/** "2026-10" del mes actual en hora de Colombia. */
export function mesActual() {
  const d = new Date(Date.now() - 5 * 3_600_000)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function moverMes(mes: string, delta: number) {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Inicio y fin del mes en hora de Colombia (UTC-5). */
export function limitesMes(mes: string) {
  const [a, m] = mes.split('-').map(Number)
  const desde = new Date(Date.UTC(a, m - 1, 1) + 5 * 3_600_000)
  const hasta = new Date(Date.UTC(a, m, 1) + 5 * 3_600_000)
  const dias = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return { desde, hasta, dias }
}

/** Día del mes (1-31) de una fecha, en hora de Colombia. */
export const diaBogota = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).getUTCDate()

export const MES_VALIDO = /^\d{4}-(0[1-9]|1[0-2])$/
