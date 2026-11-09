// Catálogo de la tienda: lo pide al CRM y lo deja en un solo formato.
// Si el CRM no responde, usa la lista fija de data.js para que la página nunca quede vacía.
import { CONFIG } from './config.js'
import { PRODUCTOS, CATEGORIAS, COLORES } from './data.js'

/**
 * Tarjeta = lo que se ve en la tienda. Cada tarjeta tiene una o varias variantes (tamaños);
 * cada variante es un producto del CRM con su precio, fotos y colores.
 *  { id, nombre, categoria, etiqueta, corto, descripcion,
 *    variantes: [{ id, tamano, precio|null, personalizado, dias, fotos[], colores[{nombre,hex}] }] }
 */

const nombreCategoria = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.nombre]))

function deLista(p) {
  const base = {
    precio: p.precio ?? null,
    personalizado: !!p.personalizado,
    dias: p.dias || 0,
    fotos: p.fotos || [],
    colores: (p.colores || []).map((c) => ({ nombre: COLORES[c].nombre, hex: COLORES[c].hex })),
  }
  const tamanos = p.tamanos?.length > 1 ? p.tamanos : ['']
  return {
    id: p.id,
    nombre: p.nombre,
    categoria: nombreCategoria[p.categoria] || p.categoria,
    etiqueta: p.etiqueta || '',
    corto: p.corto,
    descripcion: p.detalle,
    variantes: tamanos.map((t, i) => ({ ...base, id: `${p.id}-${i}`, tamano: t })),
  }
}

function deCRM(t) {
  return {
    id: String(t.id),
    nombre: t.nombre,
    categoria: t.categoria || 'Otros',
    etiqueta: t.etiqueta || '',
    corto: t.corto || t.descripcion || 'Hecho en impresión 3D, capa por capa.',
    descripcion: t.descripcion || 'Hecho en impresión 3D, capa por capa.',
    variantes: t.variantes.map((v) => ({
      id: String(v.id),
      tamano: v.tamano || '',
      precio: typeof v.precio === 'number' ? v.precio : null,
      personalizado: !!v.personalizado,
      dias: v.dias || 0,
      fotos: v.fotos || [],
      colores: v.colores || [],
    })),
  }
}

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
/** Edición limitada primero, luego Más vendido, luego el resto (en su orden). */
const PRIORIDAD = ['edicion limitada', 'mas vendido']
export function prioridad(t) {
  const i = PRIORIDAD.indexOf(sinTildes(t.etiqueta))
  return i === -1 ? PRIORIDAD.length : i
}
export const esDestacado = (t) => prioridad(t) < PRIORIDAD.length
const ordenar = (tarjetas) => tarjetas.map((t, i) => [t, i]).sort((a, b) => prioridad(a[0]) - prioridad(b[0]) || a[1] - b[1]).map(([t]) => t)

/** Devuelve { tarjetas, origen: 'crm' | 'lista' }, ya ordenadas. */
export async function cargarCatalogo() {
  if (CONFIG.CRM_PRODUCTOS) {
    const ctrl = new AbortController()
    const espera = setTimeout(() => ctrl.abort(), 8000)
    try {
      const r = await fetch(CONFIG.CRM_PRODUCTOS, { signal: ctrl.signal })
      if (!r.ok) throw new Error(`CRM ${r.status}`)
      const datos = await r.json()
      if (!Array.isArray(datos.productos)) throw new Error('respuesta rara')
      return { tarjetas: ordenar(datos.productos.map(deCRM)), origen: 'crm' }
    } catch (e) {
      console.warn('[tienda] No se pudo leer el CRM; se muestra la lista guardada.', e)
    } finally {
      clearTimeout(espera)
    }
  }
  return { tarjetas: ordenar(PRODUCTOS.map(deLista)), origen: 'lista' }
}

/** Filtros en el orden en que aparecen las categorías, más "A tu medida" si aplica. */
export function filtrosDe(tarjetas) {
  const cats = [...new Set(tarjetas.map((t) => t.categoria).filter(Boolean))]
  // "Otros" (productos sin categoría) siempre de último.
  cats.sort((a, b) => (a === 'Otros') - (b === 'Otros'))
  const hayMedida = tarjetas.some((t) => t.variantes.some((v) => v.personalizado))
  return [
    { id: 'todo', nombre: 'Todo' },
    ...cats.map((c) => ({ id: c, nombre: c })),
    ...(hayMedida ? [{ id: 'medida', nombre: 'A tu medida' }] : []),
  ]
}
