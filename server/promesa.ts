/**
 * Estado real del taller para la calculadora de entrega (shared/promesa.ts):
 * impresoras, lo que está en cola y las existencias.
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { type Modalidad } from '../shared/cotizacion.js'
import {
  calcularPromesa,
  claveExistencia,
  type EstadoTaller,
  type LineaPromesa,
} from '../shared/promesa.js'
import { type getDb } from './db/index.js'
import {
  entregas,
  impresoras,
  ordenesProduccion,
  pedidoLineas,
  pedidos,
  productoColores,
  productos,
} from './db/schema.js'
import { type Tx } from './pedidos-logica.js'
import { leerAgendaDb } from './rutas/configuracion.js'

type Db = ReturnType<typeof getDb> | Tx

/** Impresoras activas (cuándo quedan libres) y la cola en su orden. */
export async function estadoTaller(
  db: Db,
  /** Deja por fuera las órdenes de este pedido (para recalcularlo a él). */
  excluirPedidoId?: number
): Promise<EstadoTaller> {
  const imps = await db
    .select({
      id: impresoras.id,
      nombre: impresoras.nombre,
      multicolor: impresoras.multicolor,
      // Columna con su tabla: dentro de un select, drizzle la escribiría sin ella
      libreEn: sql<Date | null>`(select max(o.fin_estimado) from ordenes_produccion o where o.impresora_id = "impresoras"."id" and o.estado = 'imprimiendo')`,
    })
    .from(impresoras)
    .where(and(eq(impresoras.activa, true), isNull(impresoras.borradoEn)))
    .orderBy(asc(impresoras.id))
  const cola = await db
    .select({
      cantidad: ordenesProduccion.cantidad,
      horas: productos.horas,
      unidadesPorCama: productos.unidadesPorCama,
      minPreparacion: productos.minPreparacion,
      multicolor: productos.multicolor,
    })
    .from(ordenesProduccion)
    .innerJoin(productos, eq(productos.id, ordenesProduccion.productoId))
    .leftJoin(pedidos, eq(pedidos.id, ordenesProduccion.pedidoId))
    .where(
      and(
        eq(ordenesProduccion.estado, 'en_cola'),
        isNull(pedidos.borradoEn),
        excluirPedidoId
          ? sql`${ordenesProduccion.pedidoId} is distinct from ${excluirPedidoId}`
          : undefined
      )
    )
    .orderBy(
      sql`${ordenesProduccion.horaLimite} asc nulls last`,
      sql`${pedidos.fechaCompromiso} asc nulls last`,
      asc(ordenesProduccion.id)
    )
  return {
    impresoras: imps.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      multicolor: i.multicolor,
      libreEn: i.libreEn ? new Date(i.libreEn).toISOString() : null,
    })),
    cola: cola.map((o) => ({
      horas: o.horas * o.cantidad,
      camas: Math.ceil(o.cantidad / Math.max(1, o.unidadesPorCama)),
      minPreparacion: o.minPreparacion * o.cantidad,
      multicolor: o.multicolor,
    })),
  }
}

export type LineaParaPromesa = {
  clave: string
  productoId: number
  cantidad: number
  bobinaId: number | null
  textos: string[]
}

/** Arma las líneas de la calculadora con la ficha de cada producto y sus existencias. */
export async function datosPromesa(db: Db, lineas: LineaParaPromesa[]) {
  const ids = [...new Set(lineas.map((l) => l.productoId))]
  const prods = ids.length
    ? await db.select().from(productos).where(inArray(productos.id, ids))
    : []
  const mapa = new Map(prods.map((p) => [p.id, p]))
  const colores = ids.length
    ? await db
        .select({
          productoId: productoColores.productoId,
          bobinaId: productoColores.bobinaId,
          stock: productoColores.stock,
        })
        .from(productoColores)
        .where(inArray(productoColores.productoId, ids))
    : []
  const existencias: Record<string, number> = {}
  for (const p of prods) if (!p.escogeColor) existencias[claveExistencia(p.id, null)] = p.stock
  for (const c of colores) existencias[claveExistencia(c.productoId, c.bobinaId)] = c.stock

  const lineasPromesa: LineaPromesa[] = []
  for (const l of lineas) {
    const p = mapa.get(l.productoId)
    if (!p) continue
    const personaliza = l.textos.length > 0
    lineasPromesa.push({
      clave: l.clave,
      nombre: p.nombre,
      cantidad: l.cantidad,
      claveExistencia: claveExistencia(p.id, p.escogeColor ? l.bobinaId : null),
      horasPorUnidad: p.horas,
      unidadesPorCama: p.unidadesPorCama,
      minPreparacion: p.minPreparacion,
      minAcabado: p.minPostproceso,
      multicolor: p.multicolor,
      usaExistencias: !personaliza,
      minDiseno: personaliza ? p.minPersonalizar * l.cantidad : 0,
    })
  }
  return { lineas: lineasPromesa, existencias }
}

/** La promesa de entrega con el estado del taller de este momento. */
export async function promesaAhora(
  db: Db,
  lineas: LineaParaPromesa[],
  modalidad: Modalidad,
  desde = new Date()
) {
  const [agenda, taller, datos] = await Promise.all([
    leerAgendaDb(),
    estadoTaller(db),
    datosPromesa(db, lineas),
  ])
  return calcularPromesa({
    desde,
    lineas: datos.lineas,
    modalidad,
    agenda,
    taller,
    existencias: datos.existencias,
  })
}

/** Franja de entrega según la hora prometida. */
function franjaDe(entregaEn: string) {
  const h = (new Date(entregaEn).getUTCHours() + 24 - 5) % 24
  const m = new Date(entregaEn).getUTCMinutes()
  const min = h * 60 + m
  if (min <= 12 * 60) return 'Mañana (8 a 12)'
  if (min <= 17 * 60) return 'Tarde (12 a 5)'
  return 'Noche (5 a 8)'
}

/**
 * Calcula y guarda el compromiso de un pedido: fecha y hora de entrega,
 * hora en que debe quedar listo, hora límite de cada orden y la fecha
 * sugerida de la entrega. Lo que ya salió de existencias cuenta como listo.
 */
export async function comprometerPedido(tx: Tx, pedidoId: number, desde = new Date()) {
  const [p] = await tx.select().from(pedidos).where(eq(pedidos.id, pedidoId))
  if (!p) return null
  const lineas = await tx.select().from(pedidoLineas).where(eq(pedidoLineas.pedidoId, pedidoId))
  const datos = await datosPromesa(
    tx,
    lineas.map((l) => ({
      clave: String(l.id),
      productoId: l.productoId,
      cantidad: l.cantidad,
      bobinaId: l.bobinaId,
      textos: l.textos,
    }))
  )
  // Las existencias que cuentan son las que ya se separaron para este pedido
  const existencias: Record<string, number> = {}
  for (const lp of datos.lineas) {
    const l = lineas.find((x) => String(x.id) === lp.clave)!
    existencias[lp.claveExistencia] = (existencias[lp.claveExistencia] ?? 0) + l.deStock
  }
  const [agenda, taller] = await Promise.all([leerAgendaDb(), estadoTaller(tx, pedidoId)])
  const r = calcularPromesa({
    desde,
    lineas: datos.lineas,
    modalidad: p.modalidad as Modalidad,
    agenda,
    taller,
    existencias,
  })
  if (!r.ok) return r
  await tx
    .update(pedidos)
    .set({
      fechaCompromiso: new Date(r.entregaEn),
      listoCompromiso: new Date(r.listoEn),
      actualizadoEn: new Date(),
    })
    .where(eq(pedidos.id, pedidoId))
  for (const l of r.lineas) {
    if (!l.aImprimir) continue
    await tx
      .update(ordenesProduccion)
      .set({ horaLimite: new Date(l.listaEn) })
      .where(
        and(
          eq(ordenesProduccion.lineaId, Number(l.clave)),
          inArray(ordenesProduccion.estado, ['espera_anticipo', 'en_cola'])
        )
      )
  }
  await tx
    .update(entregas)
    .set({ fechaProgramada: new Date(r.entregaEn), franja: franjaDe(r.entregaEn) })
    .where(and(eq(entregas.pedidoId, pedidoId), eq(entregas.estado, 'por_programar')))
  return r
}
