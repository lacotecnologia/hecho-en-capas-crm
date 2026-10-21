const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
const decimales = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })

/** 4100 -> "$ 4.100" */
export const formatoPesos = (n: number) =>
  `$\u00a0${pesos.format(Math.round(n))}`

/** 1.5 -> "1,5" */
export const formatoNumero = (n: number) => decimales.format(n)

/** 2_400_000 bytes -> "2,3 MB" */
export function formatoTamano(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${decimales.format(bytes / 1024)} KB`
  return `${decimales.format(bytes / 1024 / 1024)} MB`
}

/** "1,5" o "1.5" -> 1.5 ; vacío -> 0 */
export function leerNumero(texto: string) {
  const n = Number(String(texto).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

/** Precio por gramo de una bobina. */
export function precioGramo(b: { precioRollo: number; pesoG: number }) {
  return b.pesoG > 0 ? b.precioRollo / b.pesoG : 0
}
