/**
 * Borrado lógico (solo el administrador). Borrar = esconder de las listas;
 * la fila se queda en la base de datos y se puede recuperar.
 */
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  type ElementoPapelera,
  esTipoPapelera,
  NOMBRES_PAPELERA,
  type TipoPapelera,
} from '../../shared/papelera.js'
import { getDb } from '../db/index.js'
import {
  bobinas,
  clientes,
  cotizaciones,
  impresoras,
  ordenesProduccion,
  pedidos,
  productoColores,
  productos,
  usuarios,
} from '../db/schema.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'

export const rutasPapelera = new Hono<{ Variables: Variables }>()

rutasPapelera.use('*', conSesion, soloRoles('admin'))

const TABLAS = {
  producto: productos,
  cliente: clientes,
  cotizacion: cotizaciones,
  pedido: pedidos,
  bobina: bobinas,
  impresora: impresoras,
} as const

const pesos = (n: number) => `$\u00a0${n.toLocaleString('es-CO')}`
const fecha = (d: Date | null) => d?.toISOString() ?? ''

// ===================== Lista =====================

rutasPapelera.get('/', async (c) => {
  const db = getDb()
  const quien = new Map(
    (await db.select({ id: usuarios.id, nombre: usuarios.nombre }).from(usuarios)).map(
      (u) => [u.id, u.nombre]
    )
  )
  const por = (id: number | null) => (id ? (quien.get(id) ?? '—') : '—')
  const elementos: ElementoPapelera[] = []

  for (const p of await db.select().from(productos).where(isNotNull(productos.borradoEn))) {
    elementos.push({
      tipo: 'producto',
      id: p.id,
      nombre: `${p.sku ?? ''} · ${p.nombre}`,
      detalle: [p.categoria, p.stock > 0 && `${p.stock} en stock`].filter(Boolean).join(' · '),
      borradoEn: fecha(p.borradoEn),
      borradoPor: por(p.borradoPor),
    })
  }
  for (const x of await db.select().from(clientes).where(isNotNull(clientes.borradoEn))) {
    elementos.push({
      tipo: 'cliente',
      id: x.id,
      nombre: x.nombre,
      detalle: [x.whatsapp, x.ciudad].filter(Boolean).join(' · '),
      borradoEn: fecha(x.borradoEn),
      borradoPor: por(x.borradoPor),
    })
  }
  const nombresClientes = async (ids: number[]) =>
    new Map(
      ids.length
        ? (
            await db
              .select({ id: clientes.id, nombre: clientes.nombre })
              .from(clientes)
              .where(inArray(clientes.id, ids))
          ).map((x) => [x.id, x.nombre])
        : []
    )
  const cots = await db.select().from(cotizaciones).where(isNotNull(cotizaciones.borradoEn))
  const cliCots = await nombresClientes(cots.flatMap((x) => (x.clienteId ? [x.clienteId] : [])))
  for (const x of cots) {
    elementos.push({
      tipo: 'cotizacion',
      id: x.id,
      nombre: x.codigo,
      detalle: [x.clienteId && cliCots.get(x.clienteId), pesos(x.total)].filter(Boolean).join(' · '),
      borradoEn: fecha(x.borradoEn),
      borradoPor: por(x.borradoPor),
    })
  }
  const peds = await db.select().from(pedidos).where(isNotNull(pedidos.borradoEn))
  const cliPeds = await nombresClientes(peds.map((x) => x.clienteId))
  for (const x of peds) {
    elementos.push({
      tipo: 'pedido',
      id: x.id,
      nombre: x.codigo,
      detalle: [cliPeds.get(x.clienteId), pesos(x.total), 'cancelado'].filter(Boolean).join(' · '),
      borradoEn: fecha(x.borradoEn),
      borradoPor: por(x.borradoPor),
    })
  }
  for (const b of await db.select().from(bobinas).where(isNotNull(bobinas.borradoEn))) {
    elementos.push({
      tipo: 'bobina',
      id: b.id,
      nombre: `${b.material} ${b.color}`,
      detalle: [b.marca, b.serial].filter(Boolean).join(' · '),
      borradoEn: fecha(b.borradoEn),
      borradoPor: por(b.borradoPor),
    })
  }
  for (const i of await db.select().from(impresoras).where(isNotNull(impresoras.borradoEn))) {
    elementos.push({
      tipo: 'impresora',
      id: i.id,
      nombre: i.nombre,
      detalle: i.modelo,
      borradoEn: fecha(i.borradoEn),
      borradoPor: por(i.borradoPor),
    })
  }
  elementos.sort((a, b) => b.borradoEn.localeCompare(a.borradoEn))
  return c.json({ elementos })
})

// ===================== Borrar =====================

/** Lo que impide borrar algo, en palabras sencillas (o null si se puede). */
async function impedimento(tipo: TipoPapelera, id: number): Promise<string | null> {
  const db = getDb()
  if (tipo === 'pedido') {
    const [p] = await db.select({ estado: pedidos.estado }).from(pedidos).where(eq(pedidos.id, id))
    if (p && p.estado !== 'cancelado') {
      return 'Para borrar un pedido, primero cancélalo. Así el stock vuelve a su lugar y sus órdenes salen de la cola.'
    }
  }
  if (tipo === 'cotizacion') {
    const [p] = await db
      .select({ codigo: pedidos.codigo })
      .from(pedidos)
      .where(and(eq(pedidos.cotizacionId, id), isNull(pedidos.borradoEn)))
    if (p) return `Esta cotización ya es el pedido ${p.codigo}. Borra primero el pedido.`
  }
  if (tipo === 'bobina') {
    const usos = await db
      .select({ nombre: productos.nombre })
      .from(productoColores)
      .innerJoin(productos, eq(productos.id, productoColores.productoId))
      .where(
        and(
          eq(productoColores.bobinaId, id),
          eq(productos.escogeColor, true),
          isNull(productos.borradoEn)
        )
      )
    if (usos.length) {
      return `Esta bobina es un color preaprobado de: ${usos.map((u) => u.nombre).join(', ')}. Quítala de esos productos primero.`
    }
  }
  if (tipo === 'impresora') {
    const [o] = await db
      .select({ id: ordenesProduccion.id })
      .from(ordenesProduccion)
      .where(and(eq(ordenesProduccion.impresoraId, id), eq(ordenesProduccion.estado, 'imprimiendo')))
    if (o) return 'Esta impresora está imprimiendo. Márcala como terminada antes de borrarla.'
  }
  return null
}

async function cambiar(
  tipo: TipoPapelera,
  id: number,
  borrar: boolean,
  usuarioId: number
) {
  const t = TABLAS[tipo]
  const [fila] = await getDb()
    .update(t)
    .set(
      borrar
        ? { borradoEn: new Date(), borradoPor: usuarioId }
        : { borradoEn: null, borradoPor: null }
    )
    .where(and(eq(t.id, id), borrar ? isNull(t.borradoEn) : isNotNull(t.borradoEn)))
    .returning({ id: t.id })
  return !!fila
}

rutasPapelera.post('/:tipo/:id/borrar', async (c) => {
  const tipo = c.req.param('tipo')
  const id = Number(c.req.param('id')) || 0
  if (!esTipoPapelera(tipo)) return c.json({ mensaje: 'No se puede borrar eso.' }, 400)
  const nombre = NOMBRES_PAPELERA[tipo]
  const motivo = await impedimento(tipo, id)
  if (motivo) return c.json({ mensaje: motivo }, 400)
  const ok = await cambiar(tipo, id, true, c.get('usuario').id)
  if (!ok) {
    return c.json(
      { mensaje: `No encontramos ${nombre.articulo} ${nombre.singular}. Puede que ya esté en la Papelera.` },
      404
    )
  }
  return c.json({ ok: true })
})

rutasPapelera.post('/:tipo/:id/recuperar', async (c) => {
  const tipo = c.req.param('tipo')
  const id = Number(c.req.param('id')) || 0
  if (!esTipoPapelera(tipo)) return c.json({ mensaje: 'No se puede recuperar eso.' }, 400)
  const ok = await cambiar(tipo, id, false, c.get('usuario').id)
  if (!ok) {
    const nombre = NOMBRES_PAPELERA[tipo]
    return c.json(
      { mensaje: `${nombre.articulo === 'el' ? 'Ese' : 'Esa'} ${nombre.singular} ya no está en la Papelera.` },
      404
    )
  }
  return c.json({ ok: true })
})
