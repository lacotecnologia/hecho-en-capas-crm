import { and, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { type Pendiente } from '../../shared/inicio.js'
import { getDb } from '../db/index.js'
import {
  cotizaciones,
  entregas,
  ordenesProduccion,
  pagosComision,
  pedidos,
  productos,
} from '../db/schema.js'
import { conSesion, type Variables } from '../sesion.js'

export const rutasInicio = new Hono<{ Variables: Variables }>()

rutasInicio.use('*', conSesion)

const contar = sql<number>`count(*)::int`

rutasInicio.get('/', async (c) => {
  const u = c.get('usuario')
  const db = getDb()
  const r = u.roles
  const admin = r.includes('admin')
  const vende = admin || r.includes('comercial')
  const taller = admin || r.includes('fabricacion')
  const entrega = r.includes('entregas')
  const ahora = new Date()
  const en2Dias = new Date(Date.now() + 2 * 86_400_000)
  const finHoy = new Date(Date.now() - 5 * 3_600_000)
  finHoy.setUTCHours(23, 59, 59, 999)
  const finDeHoy = new Date(finHoy.getTime() + 5 * 3_600_000)
  const cotMias = admin ? undefined : eq(cotizaciones.comercialId, u.id)
  const pedMios = admin ? undefined : eq(pedidos.comercialId, u.id)
  const lista: Pendiente[] = []
  const agregar = (
    n: number,
    [uno, varios]: [string, string],
    url: string,
    tono: Pendiente['tono'] = 'normal'
  ) => {
    if (n > 0) lista.push({ cantidad: n, texto: n === 1 ? uno : varios, url, tono })
  }

  if (vende) {
    const [porVencer] = await db
      .select({ n: contar })
      .from(cotizaciones)
      .where(
        and(
          eq(cotizaciones.estado, 'enviada'),
          lte(cotizaciones.venceEn, en2Dias),
          isNull(cotizaciones.borradoEn),
          cotMias
        )
      )
    agregar(porVencer.n, ['cotización vence en los próximos 2 días: llama al cliente', 'cotizaciones vencen en los próximos 2 días: llama al cliente'], '/cotizar', 'urgente')
    const [aprobadas] = await db
      .select({ n: contar })
      .from(cotizaciones)
      .where(
        and(
          eq(cotizaciones.estado, 'aprobada'),
          isNull(cotizaciones.borradoEn),
          sql`not exists (select 1 from pedidos p where p.cotizacion_id = ${cotizaciones.id})`,
          cotMias
        )
      )
    agregar(aprobadas.n, ['cotización aprobada por convertir en pedido', 'cotizaciones aprobadas por convertir en pedido'], '/cotizar', 'urgente')
    const [anticipo] = await db
      .select({ n: contar })
      .from(pedidos)
      .where(and(eq(pedidos.estado, 'confirmado'), pedMios))
    agregar(anticipo.n, ['pedido espera el anticipo', 'pedidos esperan el anticipo'], '/pedidos')
    const [programar] = await db
      .select({ n: contar })
      .from(entregas)
      .innerJoin(pedidos, eq(pedidos.id, entregas.pedidoId))
      .where(and(eq(entregas.estado, 'por_programar'), eq(pedidos.estado, 'listo'), pedMios))
    agregar(programar.n, ['pedido listo sin entrega programada', 'pedidos listos sin entrega programada'], '/entregas', 'urgente')
    const [deben] = await db
      .select({ n: contar })
      .from(pedidos)
      .where(and(eq(pedidos.estado, 'entregado'), pedMios))
    agregar(deben.n, ['pedido entregado aún debe plata', 'pedidos entregados aún deben plata'], '/cobros')
  }
  // Pedidos que van a llegar tarde: una orden pasó su hora límite (o va a
  // terminar después de ella)
  if (vende || taller) {
    const [riesgo] = await db
      .select({ n: sql<number>`count(distinct ${pedidos.id})::int` })
      .from(ordenesProduccion)
      .innerJoin(pedidos, eq(pedidos.id, ordenesProduccion.pedidoId))
      .where(
        and(
          inArray(ordenesProduccion.estado, ['en_cola', 'imprimiendo', 'postproceso']),
          isNull(pedidos.borradoEn),
          or(
            lt(ordenesProduccion.horaLimite, ahora),
            and(
              eq(ordenesProduccion.estado, 'imprimiendo'),
              sql`${ordenesProduccion.finEstimado} > ${ordenesProduccion.horaLimite}`
            )
          ),
          taller ? undefined : pedMios
        )
      )
    agregar(
      riesgo.n,
      [
        taller
          ? 'pedido va tarde para la hora prometida: revisa la cola'
          : 'pedido va tarde para la hora prometida: avísale al cliente',
        taller
          ? 'pedidos van tarde para la hora prometida: revisa la cola'
          : 'pedidos van tarde para la hora prometida: avísales a los clientes',
      ],
      taller ? '/cola' : '/pedidos',
      'urgente'
    )
  }
  if (taller) {
    const [solicitudes] = await db
      .select({ n: contar })
      .from(productos)
      .where(and(eq(productos.estado, 'solicitud'), isNull(productos.borradoEn)))
    agregar(solicitudes.n, ['personalizado pedido por un comercial espera diseño y precio', 'personalizados pedidos por los comerciales esperan diseño y precio'], '/taller')
    const [tarde] = await db
      .select({ n: contar })
      .from(ordenesProduccion)
      .where(and(eq(ordenesProduccion.estado, 'imprimiendo'), lt(ordenesProduccion.finEstimado, ahora)))
    agregar(tarde.n, ['impresión ya debió terminar: revisa la impresora', 'impresiones ya debieron terminar: revisa las impresoras'], '/cola', 'urgente')
    const [cola] = await db
      .select({ n: contar })
      .from(ordenesProduccion)
      .where(inArray(ordenesProduccion.estado, ['en_cola', 'postproceso']))
    agregar(cola.n, ['orden en la cola o por terminar', 'órdenes en la cola o por terminar'], '/cola')
  }
  if (entrega) {
    const [hoy] = await db
      .select({ n: contar })
      .from(entregas)
      .where(
        and(
          or(
            eq(entregas.estado, 'en_camino'),
            and(eq(entregas.estado, 'programada'), lte(entregas.fechaProgramada, finDeHoy))
          ),
          or(eq(entregas.mensajeroId, u.id), eq(entregas.modalidad, 'recoge'))
        )
      )
    agregar(hoy.n, ['entrega para hoy', 'entregas para hoy'], '/entregas', 'urgente')
  }
  if (admin) {
    const [porPagar] = await db
      .select({ n: contar })
      .from(
        sql`(select comercial_id from comisiones where pago_id is null group by comercial_id having sum(monto) > 0) as saldos`
      )
    agregar(porPagar.n, ['comercial tiene comisiones por pagar', 'comerciales tienen comisiones por pagar'], '/comisiones')
  } else if (r.includes('comercial')) {
    const [pagados] = await db
      .select({ n: contar })
      .from(pagosComision)
      .where(and(eq(pagosComision.comercialId, u.id), gte(pagosComision.creadoEn, new Date(Date.now() - 7 * 86_400_000))))
    agregar(pagados.n, ['pago de comisiones recibido esta semana', 'pagos de comisiones recibidos esta semana'], '/comisiones')
  }
  return c.json({ pendientes: lista })
})
