/**
 * Stock de producto terminado. Todo movimiento pasa por aquí para que el
 * total del producto y el stock de cada color nunca se descuadren.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { type ColorProducto, nombreColor } from '../shared/taller.js'
import { type getDb } from './db/index.js'
import { bobinas, movimientosStock, productoColores, productos } from './db/schema.js'
import { type Tx } from './pedidos-logica.js'

type Db = ReturnType<typeof getDb> | Tx

/** Colores preaprobados de varios productos, en el orden que los dejó el taller. */
export async function coloresDe(db: Db, ids: number[]) {
  const mapa = new Map<number, ColorProducto[]>()
  if (ids.length === 0) return mapa
  const filas = await db
    .select({
      productoId: productoColores.productoId,
      bobinaId: productoColores.bobinaId,
      stock: productoColores.stock,
      color: bobinas.color,
      colorHex: bobinas.colorHex,
      material: bobinas.material,
      activa: bobinas.activa,
    })
    .from(productoColores)
    .innerJoin(bobinas, eq(bobinas.id, productoColores.bobinaId))
    .where(inArray(productoColores.productoId, ids))
    .orderBy(asc(productoColores.orden), asc(productoColores.id))
  for (const { productoId, ...c } of filas) {
    const lista = mapa.get(productoId) ?? []
    lista.push(c)
    mapa.set(productoId, lista)
  }
  return mapa
}

/** Stock disponible de un producto (o de uno de sus colores). */
export async function stockDisponible(db: Db, productoId: number, bobinaId: number | null) {
  const [p] = await db
    .select({ stock: productos.stock, escogeColor: productos.escogeColor })
    .from(productos)
    .where(eq(productos.id, productoId))
  if (!p) return 0
  if (!p.escogeColor) return p.stock
  if (!bobinaId) return 0
  const [c] = await db
    .select({ stock: productoColores.stock })
    .from(productoColores)
    .where(and(eq(productoColores.productoId, productoId), eq(productoColores.bobinaId, bobinaId)))
  return c?.stock ?? 0
}

/**
 * Suma (o resta, con cantidad negativa) unidades al stock y deja el
 * movimiento en el historial. Devuelve un error en palabras sencillas si
 * no alcanza.
 */
export async function moverStock(
  tx: Tx,
  m: {
    productoId: number
    bobinaId: number | null
    cantidad: number
    tipo: 'produccion' | 'venta' | 'ajuste'
    nota: string
    pedidoId?: number | null
    ordenId?: number | null
    usuarioId: number
  }
): Promise<{ ok: true; stock: number } | { ok: false; error: string }> {
  const [p] = await tx
    .select({ stock: productos.stock, escogeColor: productos.escogeColor })
    .from(productos)
    .where(eq(productos.id, m.productoId))
    .for('update')
  if (!p) return { ok: false, error: 'No encontramos ese producto.' }
  if (p.stock + m.cantidad < 0) {
    return { ok: false, error: `No alcanza el stock: hay ${p.stock}.` }
  }

  const bobinaId = p.escogeColor ? m.bobinaId : null
  if (p.escogeColor) {
    if (!bobinaId) return { ok: false, error: 'Escoge de qué color son las unidades.' }
    const [c] = await tx
      .select({ id: productoColores.id, stock: productoColores.stock })
      .from(productoColores)
      .where(and(eq(productoColores.productoId, m.productoId), eq(productoColores.bobinaId, bobinaId)))
      .for('update')
    if (!c) {
      if (m.cantidad < 0) return { ok: false, error: 'Ese color no tiene stock.' }
      // Se imprimió (o volvió) un color que ya no estaba en la lista: vuelve a ella.
      await tx
        .insert(productoColores)
        .values({ productoId: m.productoId, bobinaId, stock: m.cantidad, orden: 99 })
    } else {
      if (c.stock + m.cantidad < 0) {
        const [b] = await tx
          .select({ color: bobinas.color, material: bobinas.material })
          .from(bobinas)
          .where(eq(bobinas.id, bobinaId))
        return {
          ok: false,
          error: `No alcanza el stock de ${b ? nombreColor(b) : 'ese color'}: hay ${c.stock}.`,
        }
      }
      await tx
        .update(productoColores)
        .set({ stock: sql`${productoColores.stock} + ${m.cantidad}` })
        .where(eq(productoColores.id, c.id))
    }
  }

  await tx
    .update(productos)
    .set({ stock: p.stock + m.cantidad, actualizadoEn: new Date() })
    .where(eq(productos.id, m.productoId))
  await tx.insert(movimientosStock).values({
    productoId: m.productoId,
    bobinaId,
    tipo: m.tipo,
    cantidad: m.cantidad,
    nota: m.nota,
    pedidoId: m.pedidoId ?? null,
    ordenId: m.ordenId ?? null,
    usuarioId: m.usuarioId,
  })
  return { ok: true, stock: p.stock + m.cantidad }
}
