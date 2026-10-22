import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { type EstadoEntrega } from '../../shared/entregas.js'
import { anticipoPendiente, type EstadoOrden, type EstadoPedido } from '../../shared/pedidos.js'
import {
  type EstadoLineaCliente,
  normalizarCodigo,
  type SeguimientoPublico,
  textoEventoCliente,
} from '../../shared/seguimiento.js'
import { getDb } from '../db/index.js'
import {
  clientes,
  entregas,
  historialEstados,
  ordenesProduccion,
  pedidoLineas,
  pedidos,
} from '../db/schema.js'
import { totalPagado } from '../pedidos-logica.js'
import { leerTextos } from './configuracion.js'

/** Página pública: no pide sesión. Solo responde con el código exacto. */
export const rutasSeguimiento = new Hono()

const NO_EXISTE =
  'No encontramos un pedido con ese código. Revisa que esté bien escrito (empieza por HC-) o escríbenos.'

// Freno sencillo para que nadie pruebe códigos al azar (por instancia del servidor)
const intentos = new Map<string, { n: number; desde: number }>()
function demasiados(ip: string) {
  const ahora = Date.now()
  const r = intentos.get(ip)
  if (!r || ahora - r.desde > 60_000) {
    intentos.set(ip, { n: 1, desde: ahora })
    return false
  }
  r.n++
  return r.n > 30
}

rutasSeguimiento.get('/:codigo', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (demasiados(ip)) {
    return c.json({ mensaje: 'Demasiadas consultas seguidas. Espera un minuto e intenta de nuevo.' }, 429)
  }
  const codigo = normalizarCodigo(c.req.param('codigo'))
  if (!codigo) return c.json({ mensaje: NO_EXISTE }, 404)
  const db = getDb()
  const [p] = await db.select().from(pedidos).where(eq(pedidos.seguimiento, codigo))
  if (!p) return c.json({ mensaje: NO_EXISTE }, 404)

  const [cliente] = await db.select({ nombre: clientes.nombre }).from(clientes).where(eq(clientes.id, p.clienteId))
  const lineas = await db
    .select()
    .from(pedidoLineas)
    .where(eq(pedidoLineas.pedidoId, p.id))
    .orderBy(asc(pedidoLineas.orden))
  const ordenes = await db
    .select({ lineaId: ordenesProduccion.lineaId, estado: ordenesProduccion.estado })
    .from(ordenesProduccion)
    .where(eq(ordenesProduccion.pedidoId, p.id))
  const estadoOrden = new Map(ordenes.map((o) => [o.lineaId, o.estado as EstadoOrden]))
  const [e] = await db.select().from(entregas).where(eq(entregas.pedidoId, p.id))
  const eventos = await db
    .select()
    .from(historialEstados)
    .where(
      and(
        eq(historialEstados.entidad, 'pedido'),
        eq(historialEstados.entidadId, p.id),
        eq(historialEstados.visibleCliente, true)
      )
    )
    .orderBy(asc(historialEstados.id))
  const pagado = await db.transaction((tx) => totalPagado(tx, p.id))
  const textos = await leerTextos()

  const lineaCliente = (desdeStock: boolean, id: number): EstadoLineaCliente => {
    if (desdeStock) return 'listo'
    const o = estadoOrden.get(id)
    return o === 'listo' ? 'listo' : o === 'espera_anticipo' ? 'esperando' : 'fabricando'
  }
  // Una sola vez cada frase (por ejemplo, "Recibimos tu pedido")
  const vistos = new Set<string>()
  const lista: SeguimientoPublico['eventos'] = []
  for (const ev of eventos) {
    const texto = textoEventoCliente(ev)
    if (!texto || vistos.has(texto)) continue
    vistos.add(texto)
    lista.push({ fecha: ev.creadoEn.toISOString(), texto })
  }

  const r: SeguimientoPublico = {
    codigo: p.codigo,
    seguimiento: p.seguimiento,
    cliente: (cliente?.nombre ?? '').split(' ').slice(0, 3).join(' '),
    estado: p.estado as EstadoPedido,
    fechaCompromiso: p.fechaCompromiso?.toISOString() ?? null,
    modalidad: p.modalidad as SeguimientoPublico['modalidad'],
    lineas: lineas.map((l) => ({
      nombre: l.nombre,
      cantidad: l.cantidad,
      imagen: l.imagen,
      estado: lineaCliente(l.desdeStock, l.id),
    })),
    entrega:
      e && e.estado !== 'por_programar'
        ? {
            estado: e.estado as EstadoEntrega,
            fechaProgramada: e.fechaProgramada?.toISOString() ?? null,
            franja: e.franja,
            transportadora: e.transportadora,
            guia: e.guia,
            recibidoPor: e.recibidoPor,
            entregadaEn: e.entregadaEn?.toISOString() ?? null,
          }
        : null,
    dinero: {
      total: p.total,
      pagado,
      falta: Math.max(0, p.total - pagado),
      anticipoPendiente: p.estado === 'cancelado' ? 0 : anticipoPendiente({ ...p, pagado }),
    },
    eventos: lista.reverse(),
    negocio: {
      whatsapp: textos.negocio_whatsapp ?? '',
      email: textos.negocio_email ?? '',
      ciudad: textos.negocio_ciudad ?? '',
      datosPago: textos.datos_pago ?? '',
    },
  }
  return c.json({ pedido: r })
})
