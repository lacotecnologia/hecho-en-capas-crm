import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import {
  type Cargo,
  type CotizacionEntrada,
  type LineaCotizacion,
  calcularCotizacion,
  validarColoresCotizacion,
  validarPreciosCotizacion,
} from '../shared/cotizacion.js'
import { getDb } from './db/index.js'
import {
  cotizacionCargos,
  cotizacionLineas,
  productoArchivos,
  productos,
} from './db/schema.js'
import { leerConfiguracion } from './rutas/configuracion.js'
import { coloresDe } from './stock.js'

/** Lógica compartida para armar y guardar cotizaciones (CRM y tienda en línea). */

export function anioBogota() {
  return Number(
    new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric' }).format(
      new Date()
    )
  )
}

/**
 * Valida la entrada contra el catálogo actual y arma las líneas con los
 * precios de fábrica de hoy (quedan congelados cuando se envía).
 */
export async function armar(entrada: CotizacionEntrada, opciones: { precioTienda?: boolean } = {}) {
  const db = getDb()
  const config = await leerConfiguracion()
  const ids = [...new Set(entrada.lineas.map((l) => l.productoId))]
  const prods = ids.length
    ? await db
        .select()
        .from(productos)
        .where(and(inArray(productos.id, ids), isNull(productos.borradoEn)))
    : []
  const mapa = new Map(prods.map((p) => [p.id, p]))
  // Pedidos de la tienda: el precio es el "precio en la tienda" que fijó el administrador
  // (sin el tope del comercial, pero nunca por debajo del precio de fábrica).
  if (opciones.precioTienda) {
    for (const l of entrada.lineas) {
      const p = mapa.get(l.productoId)
      if (!p || p.estado !== 'activo' || !p.enTienda || !p.precioTienda || p.precioTienda < p.precioFabrica) {
        return {
          ok: false as const,
          mensaje: `"${p?.nombre ?? 'Uno de los productos'}" ya no está disponible en la tienda. Quítalo del carrito.`,
          campo: 'lineas',
        }
      }
      l.precioVenta = p.precioTienda
    }
  } else {
    const v = validarPreciosCotizacion(entrada.lineas, mapa, entrada.descuento, config.tope_comercial)
    if (!v.ok) return v
  }
  const colores = await coloresDe(
    db,
    prods.filter((p) => p.escogeColor).map((p) => p.id)
  )
  const vc = validarColoresCotizacion(
    entrada.lineas,
    new Map(
      prods.map((p) => [
        p.id,
        { nombre: p.nombre, escogeColor: p.escogeColor, colores: colores.get(p.id) ?? [] },
      ])
    )
  )
  if (!vc.ok) return vc

  const fotos = ids.length
    ? await db
        .select({ productoId: productoArchivos.productoId, url: productoArchivos.url })
        .from(productoArchivos)
        .where(and(inArray(productoArchivos.productoId, ids), eq(productoArchivos.tipo, 'imagen')))
        .orderBy(desc(productoArchivos.esPortada), asc(productoArchivos.id))
    : []
  const portada = new Map<number, string>()
  for (const f of fotos) if (!portada.has(f.productoId)) portada.set(f.productoId, f.url)

  const lineas: LineaCotizacion[] = entrada.lineas.map((l) => {
    const p = mapa.get(l.productoId)!
    const color = p.escogeColor
      ? (colores.get(p.id) ?? []).find((c) => c.bobinaId === l.bobinaId)
      : undefined
    const stock = p.escogeColor ? (color?.stock ?? 0) : p.stock
    return {
      productoId: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      imagen: portada.get(p.id) ?? null,
      cantidad: l.cantidad,
      precioFabrica: p.precioFabrica,
      precioVenta: l.precioVenta,
      personalizado: p.tipo === 'personalizado',
      diasFabricacion: p.diasFabricacion,
      desdeStock: stock >= l.cantidad,
      bobinaId: color?.bobinaId ?? null,
      color: color?.color ?? '',
      colorHex: color?.colorHex ?? '',
    }
  })
  const resumen = calcularCotizacion(
    lineas,
    entrada.cargos,
    entrada.descuento,
    entrada.modalidad,
    config
  )
  return { ok: true as const, lineas, resumen, config }
}

export async function guardarHijos(
  tx: Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0],
  cotizacionId: number,
  lineas: LineaCotizacion[],
  cargos: Cargo[]
) {
  await tx.delete(cotizacionLineas).where(eq(cotizacionLineas.cotizacionId, cotizacionId))
  await tx.delete(cotizacionCargos).where(eq(cotizacionCargos.cotizacionId, cotizacionId))
  if (lineas.length) {
    await tx
      .insert(cotizacionLineas)
      .values(lineas.map((l, orden) => ({ ...l, cotizacionId, orden })))
  }
  if (cargos.length) {
    await tx.insert(cotizacionCargos).values(cargos.map((cg) => ({ ...cg, cotizacionId })))
  }
}

export const columnasResumen = (r: Awaited<ReturnType<typeof armar>> & { ok: true }) => ({
  subtotal: r.resumen.subtotal,
  totalCargos: r.resumen.cargos,
  total: r.resumen.total,
  ganancia: r.resumen.ganancia,
  anticipoPct: r.resumen.anticipoPct,
  anticipo: r.resumen.anticipo,
  diasFabricacion: r.resumen.diasFabricacion,
  diasEnvio: r.resumen.diasEnvio,
})
