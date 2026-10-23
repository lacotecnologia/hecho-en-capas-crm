/**
 * Papelera: lo que el administrador borró. Nada se pierde: queda guardado
 * y se puede recuperar.
 */

export const TIPOS_PAPELERA = [
  'producto',
  'cliente',
  'cotizacion',
  'pedido',
  'bobina',
  'impresora',
] as const
export type TipoPapelera = (typeof TIPOS_PAPELERA)[number]

export const NOMBRES_PAPELERA: Record<
  TipoPapelera,
  { singular: string; plural: string; articulo: 'el' | 'la' }
> = {
  producto: { singular: 'producto', plural: 'Productos', articulo: 'el' },
  cliente: { singular: 'cliente', plural: 'Clientes', articulo: 'el' },
  cotizacion: { singular: 'cotización', plural: 'Cotizaciones', articulo: 'la' },
  pedido: { singular: 'pedido', plural: 'Pedidos', articulo: 'el' },
  bobina: { singular: 'bobina', plural: 'Bobinas', articulo: 'la' },
  impresora: { singular: 'impresora', plural: 'Impresoras', articulo: 'la' },
}

export function esTipoPapelera(v: string): v is TipoPapelera {
  return (TIPOS_PAPELERA as readonly string[]).includes(v)
}

export type ElementoPapelera = {
  tipo: TipoPapelera
  id: number
  /** Lo que identifica el elemento: "HC-0003 · Soporte", "PED-2026-0004"… */
  nombre: string
  /** Una línea de ayuda: cliente, total, color… */
  detalle: string
  borradoEn: string
  borradoPor: string
}
