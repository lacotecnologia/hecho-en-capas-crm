import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getDb } from '../db/index.js'
import { productoArchivos, productos } from '../db/schema.js'
import { coloresDe } from '../stock.js'

/**
 * Lo que la página web pública (hechoencapas.vercel.app) lee del CRM.
 * Sin sesión: solo devuelve lo que ya se ve en la web (nunca costos,
 * archivos 3MF/STL ni datos de clientes).
 */
export const rutasTienda = new Hono()

// Es información pública del catálogo: cualquier página puede leerla.
rutasTienda.use('*', cors({ origin: '*', allowMethods: ['GET', 'OPTIONS'], maxAge: 600 }))

/** Primera frase de la descripción, para la tarjeta. */
function corto(texto: string) {
  const t = texto.trim().replace(/\s+/g, ' ')
  const frase = t.split(/(?<=[.!?])\s/)[0] ?? ''
  if (frase.length <= 120) return frase
  const recorte = frase.slice(0, 117)
  return recorte.slice(0, recorte.lastIndexOf(' ')) + '…'
}

export type VarianteWeb = {
  id: number
  tamano: string
  /** null = "Consulta el precio". */
  precio: number | null
  personalizado: boolean
  dias: number
  fotos: string[]
  colores: { nombre: string; hex: string }[]
  enStock: boolean
}

export type TarjetaWeb = {
  id: string
  nombre: string
  categoria: string
  etiqueta: string
  corto: string
  descripcion: string
  variantes: VarianteWeb[]
}

rutasTienda.get('/productos', async (c) => {
  const db = getDb()
  const filas = await db
    .select()
    .from(productos)
    .where(
      and(
        isNull(productos.borradoEn),
        eq(productos.enWeb, true),
        ne(productos.estado, 'inactivo')
      )
    )
    .orderBy(asc(productos.id))

  const ids = filas.map((p) => p.id)
  const fotos = ids.length
    ? await db
        .select({ productoId: productoArchivos.productoId, url: productoArchivos.url })
        .from(productoArchivos)
        .where(and(inArray(productoArchivos.productoId, ids), eq(productoArchivos.tipo, 'imagen')))
        .orderBy(desc(productoArchivos.esPortada), asc(productoArchivos.id))
    : []
  const fotosDe = new Map<number, string[]>()
  for (const f of fotos) fotosDe.set(f.productoId, [...(fotosDe.get(f.productoId) ?? []), f.url])
  const colores = await coloresDe(
    db,
    filas.filter((p) => p.escogeColor).map((p) => p.id)
  )

  // Un grupo = una tarjeta con botones de tamaño. Sin grupo = una tarjeta propia.
  const tarjetas = new Map<string, TarjetaWeb>()
  for (const p of filas) {
    const clave = p.grupoWeb ? `g:${p.grupoWeb.toLowerCase()}` : `p:${p.id}`
    const variante: VarianteWeb = {
      id: p.id,
      tamano: p.grupoWeb ? p.tamanoWeb : '',
      // Si el precio de fábrica subió por encima del de la web, mejor que pregunten.
      precio: p.precioWeb !== null && p.precioWeb >= p.precioFabrica ? p.precioWeb : null,
      personalizado: p.tipo === 'personalizado' || p.personalizaTexto,
      // Solo se promete un tiempo cuando el producto ya está costeado y listo.
      dias: p.estado === 'activo' ? p.diasFabricacion : 0,
      fotos: fotosDe.get(p.id) ?? [],
      colores: (colores.get(p.id) ?? [])
        .filter((x) => x.activa)
        .map((x) => ({ nombre: x.color, hex: x.colorHex })),
      enStock: p.tipo === 'catalogo' && p.stock > 0,
    }
    const t = tarjetas.get(clave)
    if (t) {
      t.variantes.push(variante)
      if (!t.etiqueta && p.etiquetaWeb) t.etiqueta = p.etiquetaWeb
      continue
    }
    tarjetas.set(clave, {
      id: p.grupoWeb ? clave.slice(2).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-') : String(p.id),
      nombre: p.grupoWeb || p.nombre,
      categoria: p.categoria,
      etiqueta: p.etiquetaWeb,
      corto: corto(p.descripcion),
      descripcion: p.descripcion,
      variantes: [variante],
    })
  }

  c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  return c.json({ productos: [...tarjetas.values()] })
})
