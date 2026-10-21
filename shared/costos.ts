/**
 * Cálculo del costo y del precio de fábrica de un producto.
 * Lo usan el servidor, la pantalla (para mostrar el desglose en vivo)
 * y la versión de prueba, así los tres dan siempre el mismo número.
 *
 * Costo = [material + energía + desgaste + mano de obra + diseño]
 *         × (1 + % falla) + empaque
 * Precio de fábrica = costo × (1 + margen), redondeado hacia arriba a la centena.
 */

export type DatosCosto = {
  /** Gramos por unidad, tomados del laminador (incluye purga). */
  gramos: number
  /** Precio del rollo (COP) y su peso en gramos. */
  precioRollo: number
  pesoRolloG: number
  /** Horas de impresión por unidad. */
  horas: number
  /** Consumo de la impresora en vatios (null = aún no medido). */
  potenciaW: number | null
  /** Precio de compra de la impresora y horas de vida útil. */
  precioImpresora: number
  vidaUtilH: number
  minPreparacion: number
  minPostproceso: number
  horasDiseno: number
  /** Unidades entre las que se reparte el diseño. */
  unidadesLote: number
  empaque: number
  margenPct: number
  // Valores de Configuración
  tarifaKwh: number
  tarifaHora: number
  tarifaDiseno: number
  fallaPct: number
}

export type DesgloseCosto = {
  material: number
  energia: number
  desgaste: number
  manoObra: number
  diseno: number
  subtotal: number
  falla: number
  empaque: number
  costo: number
  precioCalculado: number
  /** Avisos en palabras sencillas (datos que faltan). */
  avisos: string[]
}

const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0)

/** Redondea hacia arriba a la centena: 4.031 -> 4.100. */
export function redondearCentena(valor: number) {
  return Math.ceil(valor / 100) * 100
}

export function calcularCosto(d: DatosCosto): DesgloseCosto {
  const avisos: string[] = []

  const precioGramo = n(d.pesoRolloG) > 0 ? n(d.precioRollo) / d.pesoRolloG : 0
  if (precioGramo === 0) avisos.push('Elige la bobina para calcular el material.')
  if (d.potenciaW === null) {
    avisos.push(
      'Falta el consumo de la impresora: la energía queda en 0 hasta que lo midas.'
    )
  }
  if (n(d.gramos) === 0) avisos.push('Escribe los gramos que marca el laminador.')
  if (n(d.horas) === 0) avisos.push('Escribe las horas de impresión.')

  const material = n(d.gramos) * precioGramo
  const energia = n(d.horas) * (n(d.potenciaW ?? 0) / 1000) * n(d.tarifaKwh)
  const desgaste =
    n(d.vidaUtilH) > 0 ? n(d.horas) * (n(d.precioImpresora) / d.vidaUtilH) : 0
  const manoObra =
    ((n(d.minPreparacion) + n(d.minPostproceso)) / 60) * n(d.tarifaHora)
  const diseno =
    (n(d.horasDiseno) * n(d.tarifaDiseno)) / Math.max(1, n(d.unidadesLote))

  const subtotal = material + energia + desgaste + manoObra + diseno
  const falla = subtotal * (n(d.fallaPct) / 100)
  const empaque = n(d.empaque)
  const costo = Math.round(subtotal + falla + empaque)
  const precioCalculado =
    costo > 0 ? redondearCentena(costo * (1 + n(d.margenPct) / 100)) : 0

  return {
    material: Math.round(material),
    energia: Math.round(energia),
    desgaste: Math.round(desgaste),
    manoObra: Math.round(manoObra),
    diseno: Math.round(diseno),
    subtotal: Math.round(subtotal),
    falla: Math.round(falla),
    empaque: Math.round(empaque),
    costo,
    precioCalculado,
    avisos,
  }
}

/** Lo máximo que el comercial puede cobrar por unidad. */
export function precioMaximoComercial(precioFabrica: number, topePct: number) {
  return Math.floor(precioFabrica * (1 + topePct / 100))
}

/** Costo por hora de una impresora (desgaste + energía), para mostrarlo. */
export function costoHoraImpresora(
  precioImpresora: number,
  vidaUtilH: number,
  potenciaW: number | null,
  tarifaKwh: number
) {
  const desgaste = vidaUtilH > 0 ? precioImpresora / vidaUtilH : 0
  const energia = ((potenciaW ?? 0) / 1000) * tarifaKwh
  return { desgaste: Math.round(desgaste), energia: Math.round(energia) }
}
