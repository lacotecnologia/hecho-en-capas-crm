/**
 * Clientes por comercial: cada comercial ve y maneja solo los suyos;
 * el administrador ve todos y puede pasarlos de un comercial a otro.
 */
import { type Cliente } from './cotizacion.js'

/** Fila de la lista "Clientes". */
export type ClienteFila = Cliente & {
  comercial: { id: number; nombre: string } | null
  cotizaciones: number
  pedidos: number
  /** Suma de los pedidos no cancelados. */
  comprado: number
  /** Último pedido o cotización (ISO). */
  ultimoMovimiento: string | null
}

export type MovimientoCliente = {
  id: number
  codigo: string
  estado: string
  total: number
  creadoEn: string
  /** Si lo hizo otro comercial (solo lo ve el admin). */
  comercial: string
}

/** Ficha del cliente. */
export type ClienteFicha = {
  cliente: Cliente
  comercial: { id: number; nombre: string } | null
  creadoEn: string
  cotizaciones: MovimientoCliente[]
  pedidos: MovimientoCliente[]
  comprado: number
  /** Por qué no se puede borrar (null = sí se puede). */
  noSePuedeBorrar: string | null
  /** Para el admin: a quién se le puede pasar. */
  comerciales: { id: number; nombre: string }[]
}

export const NO_ES_TUYO =
  'Ese cliente no está en tu lista. Búscalo de nuevo o créalo como cliente tuyo.'

export const TIENE_PEDIDOS =
  'Este cliente ya tiene pedidos, por eso no se puede borrar: así no se pierde lo que ha comprado. Si un pedido se canceló, ese no cuenta.'
