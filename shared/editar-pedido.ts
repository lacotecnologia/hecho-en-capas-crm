/**
 * Modificar un pedido (solo el administrador). Lo usan pantalla y servidor.
 */
import { esPrecioRedondo, precioMaximoComercial, redondearPrecio } from './costos.js'
import { type Cargo, MODALIDADES, type Modalidad, type Resultado } from './cotizacion.js'
import { type EstadoOrden, type EstadoPedido } from './pedidos.js'

/** Pedidos que el admin puede modificar. Cerrado ya pagó comisión; cancelado no sigue. */
export const PEDIDO_MODIFICABLE: EstadoPedido[] = [
  'confirmado',
  'en_produccion',
  'listo',
  'en_entrega',
  'entregado',
]

/** Con el pedido saliendo o entregado ya no se cambian productos (solo dinero). */
const SIN_CAMBIAR_PRODUCTOS: EstadoPedido[] = ['en_entrega', 'entregado']

/** La entrega se cambia solo mientras no ha salido. */
export const ENTREGA_MODIFICABLE = ['por_programar', 'programada']

/** Lo que ya se empezó a imprimir no se cambia (solo su precio). */
const ORDEN_EMPEZADA: EstadoOrden[] = ['imprimiendo', 'postproceso', 'listo']

export function motivoNoModificable(estado: EstadoPedido): string | null {
  if (estado === 'cancelado') return 'El pedido está cancelado: ya no se modifica.'
  if (estado === 'cerrado') {
    return 'El pedido ya se cerró y la comisión quedó ganada: ya no se modifica. Si hay que devolver plata, usa “Devolver plata al cliente”.'
  }
  return null
}

/** Por qué una línea solo deja cambiar el precio (null = se puede cambiar todo). */
export function lineaBloqueada(
  estadoPedido: EstadoPedido,
  l: { desdeStock: boolean; estado: EstadoOrden }
): string | null {
  if (SIN_CAMBIAR_PRODUCTOS.includes(estadoPedido)) {
    return 'El pedido ya salió a entrega: solo se puede cambiar el precio.'
  }
  if (!l.desdeStock && ORDEN_EMPEZADA.includes(l.estado)) {
    return 'El taller ya la empezó: solo se puede cambiar el precio.'
  }
  return null
}

export type LineaEdicion = {
  /** Línea que ya existía (sin id = nueva). */
  id: number | null
  productoId: number
  cantidad: number
  precioVenta: number
  bobinaId: number | null
  textos: string[]
}

export type DatosEntregaEdicion = {
  modalidad: Modalidad
  direccion: string
  ciudad: string
  recibe: string
  telefono: string
}

export type EdicionPedido = {
  lineas: LineaEdicion[]
  cargos: Cargo[]
  descuento: number
  notas: string
  /** null = la entrega no se toca. */
  entrega: DatosEntregaEdicion | null
  /** Fecha prometida puesta a mano (ISO); null = no se tocó. */
  fechaCompromiso: string | null
}

const malo = (mensaje: string, campo?: string) => ({ ok: false, mensaje, campo }) as const
const fmt = (n: number) => `$\u00a0${n.toLocaleString('es-CO')}`

export function leerEdicionPedido(c: Record<string, unknown>): Resultado<EdicionPedido> {
  const entero = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.round(n) : NaN
  }
  const crudas = Array.isArray(c.lineas) ? (c.lineas as Record<string, unknown>[]) : []
  if (!crudas.length) return malo('El pedido debe tener al menos un producto.', 'lineas')
  if (crudas.length > 50) return malo('Un pedido puede tener hasta 50 productos.', 'lineas')
  const lineas: LineaEdicion[] = crudas.map((l) => ({
    id: entero(l?.id) > 0 ? entero(l?.id) : null,
    productoId: entero(l?.productoId),
    cantidad: entero(l?.cantidad),
    precioVenta: entero(l?.precioVenta),
    bobinaId: entero(l?.bobinaId) > 0 ? entero(l?.bobinaId) : null,
    textos: (Array.isArray(l?.textos) ? l.textos : [])
      .map((t) => String(t ?? '').trim().replace(/\s+/g, ' '))
      .filter((t) => t.length > 0)
      .slice(0, 500),
  }))
  for (const l of lineas) {
    if (!(l.productoId > 0)) return malo('Uno de los productos no es válido. Quítalo y agrégalo de nuevo.', 'lineas')
    if (!(l.cantidad >= 1 && l.cantidad <= 100_000)) {
      return malo('La cantidad de cada producto debe ser 1 o más.', 'lineas')
    }
    if (!(l.precioVenta >= 0)) return malo('Escribe el precio de cada producto.', 'lineas')
  }
  const ids = lineas.map((l) => l.id).filter(Boolean)
  if (new Set(ids).size !== ids.length) return malo('Un producto quedó repetido. Recarga la página.', 'lineas')

  const cargosCrudos = Array.isArray(c.cargos) ? (c.cargos as Record<string, unknown>[]) : []
  if (cargosCrudos.length > 10) return malo('Puedes poner hasta 10 cargos.', 'cargos')
  const cargos: Cargo[] = []
  for (const x of cargosCrudos) {
    const concepto = String(x?.concepto ?? '').trim().slice(0, 60)
    const valor = entero(x?.valor)
    if (!concepto && !valor) continue
    if (!concepto) return malo('Escribe qué es cada cargo. Ejemplo: Envío.', 'cargos')
    if (!(valor >= 0 && valor <= 100_000_000)) return malo(`Escribe el valor de "${concepto}".`, 'cargos')
    cargos.push({ concepto, valor })
  }
  const descuento = c.descuento === '' || c.descuento == null ? 0 : entero(c.descuento)
  if (!(descuento >= 0)) return malo('El descuento debe ser 0 o más.', 'descuento')

  let entrega: DatosEntregaEdicion | null = null
  if (c.entrega && typeof c.entrega === 'object') {
    const e = c.entrega as Record<string, unknown>
    const modalidad = String(e.modalidad)
    if (!(MODALIDADES as readonly string[]).includes(modalidad)) {
      return malo('Escoge cómo se entrega.', 'modalidad')
    }
    const t = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
    entrega = {
      modalidad: modalidad as Modalidad,
      direccion: t(e.direccion, 160),
      ciudad: t(e.ciudad, 60),
      recibe: t(e.recibe, 80),
      telefono: t(e.telefono, 30),
    }
  }

  let fechaCompromiso: string | null = null
  if (c.fechaCompromiso) {
    const f = new Date(String(c.fechaCompromiso))
    if (Number.isNaN(f.getTime())) return malo('La fecha prometida no es válida.', 'fechaCompromiso')
    fechaCompromiso = f.toISOString()
  }
  return {
    ok: true,
    datos: {
      lineas,
      cargos,
      descuento,
      notas: String(c.notas ?? '').trim().slice(0, 1000),
      entrega,
      fechaCompromiso,
    },
  }
}

/**
 * Precios del pedido: las mismas reglas de la cotización (redondo a mil, nunca
 * por debajo de fábrica, máximo el tope del comercial, descuento ≤ ganancia).
 * `fabrica` es el de la línea: el guardado si ya existía, el de hoy si es nueva.
 */
export function validarPreciosPedido(
  lineas: { nombre: string; cantidad: number; precioVenta: number; fabrica: number }[],
  descuento: number,
  topePct: number
): Resultado<true> {
  let ganancia = 0
  for (const l of lineas) {
    const maximo = precioMaximoComercial(l.fabrica, topePct)
    if (l.precioVenta !== l.fabrica && !esPrecioRedondo(l.precioVenta)) {
      return malo(
        `El precio de "${l.nombre}" debe ser redondo a mil: usa ${fmt(Math.min(maximo, Math.max(l.fabrica, redondearPrecio(l.precioVenta))))}.`,
        'lineas'
      )
    }
    if (l.precioVenta < l.fabrica) {
      return malo(`El precio de "${l.nombre}" no puede ser menor que el de fábrica (${fmt(l.fabrica)}).`, 'lineas')
    }
    if (l.precioVenta > maximo) {
      return malo(`El precio de "${l.nombre}" pasa el tope del ${topePct} %: el máximo es ${fmt(maximo)}.`, 'lineas')
    }
    ganancia += (l.precioVenta - l.fabrica) * l.cantidad
  }
  if (descuento > ganancia) {
    return malo(
      `El descuento no puede ser mayor que la ganancia del comercial (${fmt(ganancia)}); si no, se vendería por debajo del precio de fábrica.`,
      'descuento'
    )
  }
  return { ok: true, datos: true }
}

/** El total nuevo no puede quedar por debajo de lo que el cliente ya pagó. */
export function validarTotalContraPagado(total: number, pagado: number): Resultado<true> {
  if (total < pagado) {
    return malo(
      `El cliente ya pagó ${fmt(pagado)} y el total quedaría en ${fmt(total)}. Si hay que devolverle plata, primero usa “Devolver plata al cliente”.`,
      'total'
    )
  }
  return { ok: true, datos: true }
}
