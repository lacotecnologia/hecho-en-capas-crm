import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { type Context, Hono } from 'hono'
import {
  estimarOrden,
  type EstadoOrden,
  type OrdenCola,
  sumarHoras,
  validarBobinaParaColor,
  validarFalla,
  validarImpresoraParaOrden,
} from '../../shared/pedidos.js'
import { getDb } from '../db/index.js'
import {
  bobinas,
  clientes,
  impresoras,
  ordenesProduccion,
  pedidos,
  productoArchivos,
  productos,
  usuarios,
} from '../db/schema.js'
import { anotar, recalcularPedido, type Tx } from '../pedidos-logica.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'
import { coloresDe, moverStock } from '../stock.js'

export const rutasCola = new Hono<{ Variables: Variables }>()

rutasCola.use('*', conSesion)

const ve = soloRoles('admin', 'fabricacion', 'comercial')
const deTaller = soloRoles('admin', 'fabricacion')

const NO_EXISTE = 'No encontramos esa orden. Puede que la hayan cancelado.'

/** La bobina del color que pidió el cliente (distinta de la que se usó al imprimir). */
const colorPedido = alias(bobinas, 'color_pedido')

async function listar(ids?: number[]): Promise<OrdenCola[]> {
  const db = getDb()
  const haceUnaSemana = new Date(Date.now() - 7 * 86_400_000)
  const filas = await db
    .select({
      o: ordenesProduccion,
      producto: {
        id: productos.id,
        nombre: productos.nombre,
        sku: productos.sku,
        multicolor: productos.multicolor,
        horas: productos.horas,
        unidadesPorCama: productos.unidadesPorCama,
        impresoraId: productos.impresoraId,
        bobinaId: productos.bobinaId,
      },
      pedidoCodigo: pedidos.codigo,
      fechaCompromiso: pedidos.fechaCompromiso,
      cliente: clientes.nombre,
      operador: usuarios.nombre,
      color: {
        bobinaId: colorPedido.id,
        color: colorPedido.color,
        colorHex: colorPedido.colorHex,
        material: colorPedido.material,
      },
    })
    .from(ordenesProduccion)
    .innerJoin(productos, eq(productos.id, ordenesProduccion.productoId))
    .leftJoin(colorPedido, eq(colorPedido.id, ordenesProduccion.colorBobinaId))
    .leftJoin(pedidos, eq(pedidos.id, ordenesProduccion.pedidoId))
    .leftJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .leftJoin(usuarios, eq(usuarios.id, ordenesProduccion.operadorId))
    .where(
      ids
        ? inArray(ordenesProduccion.id, ids)
        : and(
            // Si se borró el pedido, sus órdenes ya no se muestran
            isNull(pedidos.borradoEn),
            or(
            inArray(ordenesProduccion.estado, ['en_cola', 'imprimiendo', 'postproceso']),
            and(
              eq(ordenesProduccion.estado, 'listo'),
              gte(ordenesProduccion.actualizadoEn, haceUnaSemana)
            )
          ))
    )
    // Primero lo que se le prometió antes al cliente; lo de stock al final
    .orderBy(
      sql`${pedidos.fechaCompromiso} asc nulls last`,
      asc(ordenesProduccion.id)
    )
  const prodIds = [...new Set(filas.map((f) => f.producto.id))]
  const fotos = prodIds.length
    ? await db
        .select({ productoId: productoArchivos.productoId, url: productoArchivos.url })
        .from(productoArchivos)
        .where(and(inArray(productoArchivos.productoId, prodIds), eq(productoArchivos.tipo, 'imagen')))
        .orderBy(desc(productoArchivos.esPortada), asc(productoArchivos.id))
    : []
  const portada = new Map<number, string>()
  for (const f of fotos) if (!portada.has(f.productoId)) portada.set(f.productoId, f.url)

  return filas.map(({ o, producto, pedidoCodigo, fechaCompromiso, cliente, operador, color }) => {
    const est = estimarOrden(producto.horas, producto.unidadesPorCama, o.cantidad)
    return {
      id: o.id,
      estado: o.estado as EstadoOrden,
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        sku: producto.sku ?? '',
        imagen: portada.get(producto.id) ?? null,
        multicolor: producto.multicolor,
        impresoraSugeridaId: producto.impresoraId,
        bobinaSugeridaId: color?.bobinaId ?? producto.bobinaId,
      },
      cantidad: o.cantidad,
      color: color?.bobinaId ? { ...color, bobinaId: color.bobinaId } : null,
      horas: est.horas,
      camas: est.camas,
      pedido:
        o.pedidoId && pedidoCodigo
          ? { id: o.pedidoId, codigo: pedidoCodigo, cliente: cliente ?? '' }
          : null,
      fechaCompromiso: fechaCompromiso?.toISOString() ?? null,
      impresoraId: o.impresoraId,
      bobinaId: o.bobinaId,
      operador,
      inicio: o.inicio?.toISOString() ?? null,
      finEstimado: o.finEstimado?.toISOString() ?? null,
      finReal: o.finReal?.toISOString() ?? null,
      intentos: o.intentos,
      gramosPerdidos: o.gramosPerdidos,
      motivoFalla: o.motivoFalla,
    }
  })
}

const una = async (id: number) => (await listar([id]))[0]

rutasCola.get('/', ve, async (c) => {
  const db = getDb()
  const lista = await listar()
  const imps = await db
    .select({ id: impresoras.id, nombre: impresoras.nombre, multicolor: impresoras.multicolor, activa: impresoras.activa })
    .from(impresoras)
    .where(isNull(impresoras.borradoEn))
    .orderBy(asc(impresoras.id))
  return c.json({ ordenes: lista, impresoras: imps })
})

/** Mueve una orden de estado, validando de dónde viene. */
async function mover(
  c: Context<{ Variables: Variables }>,
  desde: EstadoOrden[],
  hacia: EstadoOrden,
  cambios: (
    tx: Tx,
    o: typeof ordenesProduccion.$inferSelect
  ) => Promise<Partial<typeof ordenesProduccion.$inferInsert> | { error: string; campo?: string }>,
  nota?: (o: typeof ordenesProduccion.$inferSelect) => string
) {
  const u = c.get('usuario')
  const id = Number(c.req.param('id')) || 0
  const db = getDb()
  const r = await db.transaction(async (tx) => {
    const [o] = await tx
      .select()
      .from(ordenesProduccion)
      .where(eq(ordenesProduccion.id, id))
      .for('update')
    if (!o) return { error: NO_EXISTE, status: 404 as const }
    if (!desde.includes(o.estado as EstadoOrden)) {
      return {
        error: 'Esta orden cambió mientras la mirabas. Se actualizó la pantalla; revisa e intenta de nuevo.',
        status: 409 as const,
      }
    }
    const extra = await cambios(tx, o)
    if ('error' in extra) return { error: extra.error, campo: extra.campo, status: 400 as const }
    await tx
      .update(ordenesProduccion)
      .set({ ...extra, estado: hacia, actualizadoEn: new Date() })
      .where(eq(ordenesProduccion.id, id))
    await anotar(tx, {
      entidad: 'orden',
      entidadId: id,
      de: o.estado,
      a: hacia,
      nota: nota?.(o) ?? '',
      usuarioId: u.id,
    })
    if (o.pedidoId) await recalcularPedido(tx, o.pedidoId, u.id)
    return { ok: true as const }
  })
  if ('error' in r) return c.json({ mensaje: r.error, campo: 'campo' in r ? r.campo : undefined }, r.status)
  return c.json({ orden: await una(id) })
}

rutasCola.post('/:id/empezar', deTaller, async (c) => {
  const u = c.get('usuario')
  const cuerpo = await c.req.json().catch(() => ({}))
  const impresoraId = Number(cuerpo.impresoraId) || 0
  const bobinaId = Number(cuerpo.bobinaId) || null
  return mover(c, ['en_cola'], 'imprimiendo', async (tx, o) => {
    const [imp] = await tx
      .select()
      .from(impresoras)
      .where(and(eq(impresoras.id, impresoraId), isNull(impresoras.borradoEn)))
    const [prod] = await tx.select().from(productos).where(eq(productos.id, o.productoId))
    const v = validarImpresoraParaOrden(prod, imp)
    if (!v.ok) return { error: v.mensaje, campo: v.campo }
    const [ocupada] = await tx
      .select({ id: ordenesProduccion.id, nombre: productos.nombre })
      .from(ordenesProduccion)
      .innerJoin(productos, eq(productos.id, ordenesProduccion.productoId))
      .where(and(eq(ordenesProduccion.impresoraId, impresoraId), eq(ordenesProduccion.estado, 'imprimiendo')))
    if (ocupada) {
      return {
        error: `La ${imp.nombre} está imprimiendo "${ocupada.nombre}". Márcala como terminada primero.`,
        campo: 'impresoraId',
      }
    }
    const [b] = bobinaId
      ? await tx.select().from(bobinas).where(eq(bobinas.id, bobinaId))
      : []
    if (bobinaId && !b) return { error: 'Esa bobina no existe.', campo: 'bobinaId' }
    if (o.colorBobinaId) {
      const [pedida] = await tx.select().from(bobinas).where(eq(bobinas.id, o.colorBobinaId))
      const vc = validarBobinaParaColor(pedida ?? null, b ?? null)
      if (!vc.ok) return { error: vc.mensaje, campo: vc.campo }
    }
    const inicio = new Date()
    const est = estimarOrden(prod.horas, prod.unidadesPorCama, o.cantidad)
    return {
      impresoraId,
      bobinaId,
      operadorId: u.id,
      inicio,
      finEstimado: sumarHoras(inicio, est.horas || 1),
      finReal: null,
      intentos: o.intentos + 1,
    }
  })
})

rutasCola.post('/:id/terminar', deTaller, (c) =>
  mover(c, ['imprimiendo'], 'postproceso', async () => ({ finReal: new Date() }))
)

rutasCola.post('/:id/fallo', deTaller, async (c) => {
  const v = validarFalla(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  return mover(
    c,
    ['imprimiendo', 'postproceso'],
    'en_cola',
    async (_tx, o) => ({
      impresoraId: null,
      inicio: null,
      finEstimado: null,
      finReal: null,
      motivoFalla: v.datos.motivo,
      gramosPerdidos: o.gramosPerdidos + v.datos.gramosPerdidos,
    }),
    () => `Falló: ${v.datos.motivo}${v.datos.gramosPerdidos ? ` (${v.datos.gramosPerdidos} g perdidos)` : ''}`
  )
})

rutasCola.post('/:id/listo', deTaller, async (c) => {
  const u = c.get('usuario')
  return mover(c, ['postproceso'], 'listo', async (tx, o) => {
    // Lo que se imprime para stock entra al inventario
    if (!o.pedidoId) {
      const m = await moverStock(tx, {
        productoId: o.productoId,
        bobinaId: o.colorBobinaId,
        cantidad: o.cantidad,
        tipo: 'produccion',
        nota: `Impreso para stock (orden ${o.id})`,
        ordenId: o.id,
        usuarioId: u.id,
      })
      if (!m.ok) return { error: m.error }
    }
    return { finReal: o.finReal }
  })
})

/** Volver un paso atrás si se marcó por error (sin tocar el stock). */
rutasCola.post('/:id/devolver', deTaller, (c) =>
  mover(c, ['imprimiendo'], 'en_cola', async (_tx, o) => ({
    impresoraId: null,
    inicio: null,
    finEstimado: null,
    intentos: Math.max(0, o.intentos - 1),
  }), () => 'Se devolvió a la cola (se había empezado por error).')
)

// ----- Imprimir para stock -----

rutasCola.post('/stock', deTaller, async (c) => {
  const u = c.get('usuario')
  const cuerpo = await c.req.json().catch(() => ({}))
  const productoId = Number(cuerpo.productoId) || 0
  const cantidad = Number(cuerpo.cantidad)
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) {
    return c.json({ mensaje: 'Escribe cuántas unidades vas a imprimir (de 1 a 1000).', campo: 'cantidad' }, 400)
  }
  const db = getDb()
  const [p] = await db
    .select()
    .from(productos)
    .where(and(eq(productos.id, productoId), isNull(productos.borradoEn)))
  if (!p) return c.json({ mensaje: 'Elige el producto.', campo: 'productoId' }, 400)
  if (p.estado !== 'activo' || p.tipo !== 'catalogo') {
    return c.json(
      { mensaje: 'Para stock solo se imprimen productos de catálogo que estén activos.', campo: 'productoId' },
      400
    )
  }
  let colorBobinaId: number | null = null
  if (p.escogeColor) {
    const colores = (await coloresDe(db, [p.id])).get(p.id) ?? []
    const elegido = colores.find((x) => x.bobinaId === Number(cuerpo.bobinaId))
    if (!elegido) {
      return c.json({ mensaje: 'Escoge de qué color vas a imprimir.', campo: 'bobinaId' }, 400)
    }
    colorBobinaId = elegido.bobinaId
  }
  const id = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(ordenesProduccion)
      .values({ productoId, cantidad, colorBobinaId, estado: 'en_cola', creadoPor: u.id })
      .returning({ id: ordenesProduccion.id })
    await anotar(tx, { entidad: 'orden', entidadId: o.id, a: 'en_cola', nota: 'Para stock', usuarioId: u.id })
    return o.id
  })
  return c.json({ orden: await una(id) }, 201)
})

rutasCola.delete('/:id', deTaller, async (c) => {
  const id = Number(c.req.param('id')) || 0
  const db = getDb()
  const [o] = await db.select().from(ordenesProduccion).where(eq(ordenesProduccion.id, id))
  if (!o) return c.json({ mensaje: NO_EXISTE }, 404)
  if (o.pedidoId) {
    return c.json(
      { mensaje: 'Esta orden es de un pedido. Para quitarla hay que cancelar el pedido.' },
      400
    )
  }
  if (o.estado !== 'en_cola') {
    return c.json({ mensaje: 'Solo se puede quitar una orden que no se ha empezado.' }, 400)
  }
  await db.delete(ordenesProduccion).where(eq(ordenesProduccion.id, id))
  return c.json({ ok: true })
})
