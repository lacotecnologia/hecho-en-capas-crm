/**
 * Pedidos y cola de impresión en la versión de prueba: imita /api/pedidos y
 * /api/cola en el navegador, con las mismas reglas del servidor.
 */
import { type ValoresConfig } from '@shared/configuracion'
import {
  calcularCotizacion,
  type Cargo,
  type Modalidad,
  sumarDiasHabiles,
} from '@shared/cotizacion'
import {
  costoEnvioCobrado,
  type Entrega,
  type EntregaLista,
  estadoPago,
  type PedidoPorCobrar,
  puedeSalir,
  type ResumenCobros,
  validarEntregada,
  validarNovedad,
  validarProgramacion,
  validarReembolso,
} from '@shared/entregas'
import { type Pendiente } from '@shared/inicio'
import {
  anticipoPendiente,
  calcularEstadoPedido,
  codigoPedido,
  codigoSeguimiento,
  type EstadoOrden,
  type EstadoPedido,
  estimarOrden,
  type LineaPedido,
  type MetodoPago,
  type OrdenCola,
  type PedidoDetalle,
  type PedidoResumen,
  puedeProducir,
  sumarHoras,
  tipoDePago,
  type TipoPago,
  validarFalla,
  validarImpresoraParaOrden,
  validarMotivoCancelacion,
  validarNota,
  validarPago,
} from '@shared/pedidos'
import {
  diaBogota,
  limitesMes,
  MES_VALIDO,
  mesActual,
  type ReporteMes,
} from '@shared/reportes'
import { type Rol } from '@shared/roles'
import {
  type EstadoLineaCliente,
  normalizarCodigo,
  type SeguimientoPublico,
  textoEventoCliente,
} from '@shared/seguimiento'
import { ApiError } from '@/lib/api'
import { type CotizarDemo } from './cotizar-demo'
import { portadaDe, type TallerDemo } from './taller-demo'

type LineaDemo = Omit<LineaPedido, 'estado'>

type PedidoDemo = {
  id: number
  anio: number
  numero: number
  codigo: string
  seguimiento: string
  cotizacionId: number
  clienteId: number
  comercialId: number
  estado: EstadoPedido
  modalidad: Modalidad
  subtotal: number
  descuento: number
  total: number
  ganancia: number
  anticipoPct: number
  anticipo: number
  requiereAnticipo: boolean
  producirSinAnticipo: boolean
  diasFabricacion: number
  diasEnvio: number
  fechaCompromiso: string | null
  notas: string
  motivoCancelacion: string
  numeroFactura?: string
  lineas: LineaDemo[]
  cargos: Cargo[]
  creadoEn: string
  actualizadoEn: string
}

type OrdenDemo = {
  id: number
  pedidoId: number | null
  lineaId: number | null
  productoId: number
  cantidad: number
  estado: EstadoOrden
  impresoraId: number | null
  bobinaId: number | null
  operadorId: number | null
  inicio: string | null
  finEstimado: string | null
  finReal: string | null
  intentos: number
  gramosPerdidos: number
  motivoFalla: string
  actualizadoEn: string
}

type PagoDemo = {
  id: number
  pedidoId: number
  tipo: TipoPago
  metodo: MetodoPago
  monto: number
  referencia: string
  comprobanteUrl?: string | null
  nota?: string
  usuarioId: number
  creadoEn: string
}

type EntregaDemo = Omit<Entrega, 'mensajero'> & { mensajeroId: number | null }

type EventoDemo = {
  id: number
  entidad: 'pedido' | 'orden'
  entidadId: number
  de: string | null
  a: string | null
  nota: string
  visibleCliente: boolean
  usuarioId: number | null
  creadoEn: string
}

export type PedidosDemo = {
  pedidos: PedidoDemo[]
  ordenes: OrdenDemo[]
  pagos: PagoDemo[]
  historial: EventoDemo[]
  entregas?: EntregaDemo[]
}

export const pedidosInicial = (): PedidosDemo => ({
  pedidos: [],
  ordenes: [],
  pagos: [],
  historial: [],
})

type Persona = { id: number; nombre: string; roles: Rol[] }

const fallo = (status: number, mensaje: string, campo?: string): never => {
  throw new ApiError(status, mensaje, campo)
}
const SIN_PERMISO =
  'No tienes permiso para hacer esto. Pídeselo al administrador.'
const NO_EXISTE = 'No encontramos ese pedido.'
const NO_EXISTE_ORDEN =
  'No encontramos esa orden. Puede que la hayan cancelado.'
const DE_ENTREGA: EstadoPedido[] = [
  'listo',
  'en_entrega',
  'entregado',
  'cerrado',
]
const ahora = () => new Date().toISOString()
const sig = (lista: { id: number }[]) =>
  Math.max(0, ...lista.map((x) => x.id)) + 1

export type ContextoDemo = {
  d: PedidosDemo
  cot: CotizarDemo
  taller: TallerDemo
  config: ValoresConfig
  nombres: Map<number, string>
  /** Personas con rol de Entregas (para elegir mensajero). */
  mensajeros: { id: number; nombre: string }[]
  textos: Record<string, string>
}

/** El pedido que salió de una cotización (para la pantalla de la cotización). */
export function pedidoDeCotizacion(d: PedidosDemo, cotizacionId: number) {
  const p = d.pedidos.find((x) => x.cotizacionId === cotizacionId)
  return p ? { id: p.id, codigo: p.codigo } : null
}

export function atenderPedidos(
  ctx: ContextoDemo,
  u: Persona,
  ruta: string,
  metodo: string,
  c: Record<string, unknown>
): unknown {
  const { d, cot, taller, config, nombres, mensajeros, textos } = ctx
  d.entregas ??= []
  const entregas = d.entregas
  const tiene = (...r: Rol[]) => u.roles.some((x) => r.includes(x))
  const esAdmin = tiene('admin')
  const veDinero = tiene('admin', 'comercial')
  const veSaldo = veDinero || tiene('entregas')

  const anotar = (
    e: Omit<
      EventoDemo,
      'id' | 'creadoEn' | 'usuarioId' | 'de' | 'a' | 'nota' | 'visibleCliente'
    > &
      Partial<EventoDemo>
  ) =>
    d.historial.push({
      de: null,
      a: null,
      nota: '',
      visibleCliente: false,
      usuarioId: u.id,
      ...e,
      id: sig(d.historial),
      creadoEn: ahora(),
    })

  const pagado = (pid: number) =>
    d.pagos.filter((x) => x.pedidoId === pid).reduce((s, x) => s + x.monto, 0)
  const estadoLinea = (p: PedidoDemo, l: LineaDemo): EstadoOrden =>
    l.desdeStock
      ? 'listo'
      : (d.ordenes.find((o) => o.lineaId === l.id && o.pedidoId === p.id)
          ?.estado ?? 'en_cola')

  const recalcular = (p: PedidoDemo) => {
    const base = { ...p, pagado: pagado(p.id) }
    if (p.estado !== 'cancelado' && puedeProducir(base)) {
      for (const o of d.ordenes.filter(
        (x) => x.pedidoId === p.id && x.estado === 'espera_anticipo'
      )) {
        o.estado = 'en_cola'
        o.actualizadoEn = ahora()
        anotar({
          entidad: 'orden',
          entidadId: o.id,
          de: 'espera_anticipo',
          a: 'en_cola',
        })
      }
      if (!p.fechaCompromiso) {
        p.fechaCompromiso = sumarDiasHabiles(
          new Date(),
          p.diasFabricacion + p.diasEnvio
        ).toISOString()
      }
    }
    const ent = entregas.find((x) => x.pedidoId === p.id)
    const estado = calcularEstadoPedido({
      ...base,
      cancelado: p.estado === 'cancelado',
      estadosLineas: p.lineas.map((l) => estadoLinea(p, l)),
      enEntrega: ent?.estado === 'programada' || ent?.estado === 'en_camino',
      entregado: ent?.estado === 'entregada',
    })
    if (estado !== p.estado) {
      anotar({
        entidad: 'pedido',
        entidadId: p.id,
        de: p.estado,
        a: estado,
        visibleCliente: true,
      })
      p.estado = estado
    }
    p.actualizadoEn = ahora()
  }

  const puedeVer = (p: PedidoDemo) =>
    tiene('admin', 'fabricacion') ||
    (tiene('comercial') && p.comercialId === u.id) ||
    (tiene('entregas') && DE_ENTREGA.includes(p.estado))
  const puedeCobrar = (p: PedidoDemo) =>
    esAdmin || (tiene('comercial') && p.comercialId === u.id)

  const resumen = (p: PedidoDemo): PedidoResumen => {
    const lineas = p.lineas.map((l) => estadoLinea(p, l))
    return {
      id: p.id,
      codigo: p.codigo,
      seguimiento: p.seguimiento,
      estado: p.estado,
      cliente: {
        id: p.clienteId,
        nombre: cot.clientes.find((x) => x.id === p.clienteId)?.nombre ?? '—',
      },
      comercial: {
        id: p.comercialId,
        nombre: nombres.get(p.comercialId) ?? '—',
      },
      total: p.total,
      pagado: veSaldo ? pagado(p.id) : 0,
      estadoPago: estadoPago({
        ...p,
        pagado: pagado(p.id),
        cancelado: p.estado === 'cancelado',
      }),
      avance: {
        listas: lineas.filter((e) => e === 'listo').length,
        total: lineas.length,
      },
      fechaCompromiso: p.fechaCompromiso,
      creadoEn: p.creadoEn,
    }
  }

  const detalle = (p: PedidoDemo): PedidoDetalle => {
    const cliente = cot.clientes.find((x) => x.id === p.clienteId)!
    const cotizacion = cot.cotizaciones.find((x) => x.id === p.cotizacionId)!
    return {
      ...resumen(p),
      cotizacion: { id: cotizacion.id, codigo: cotizacion.codigo },
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        whatsapp: cliente.whatsapp,
        ciudad: cliente.ciudad,
        direccion: cliente.direccion,
      },
      modalidad: p.modalidad,
      lineas: p.lineas.map((l) => ({
        ...l,
        precioFabrica: veDinero ? l.precioFabrica : 0,
        estado: estadoLinea(p, l),
      })),
      cargos: p.cargos,
      descuento: p.descuento,
      subtotal: p.subtotal,
      ganancia: veDinero ? p.ganancia : 0,
      anticipoPct: p.anticipoPct,
      anticipo: p.anticipo,
      requiereAnticipo: p.requiereAnticipo,
      producirSinAnticipo: p.producirSinAnticipo,
      diasFabricacion: p.diasFabricacion,
      diasEnvio: p.diasEnvio,
      notas: p.notas,
      motivoCancelacion: p.motivoCancelacion,
      numeroFactura: p.numeroFactura ?? '',
      entrega: entregaVista(entregas.find((x) => x.pedidoId === p.id)),
      pagos: veDinero
        ? d.pagos
            .filter((x) => x.pedidoId === p.id)
            .map((x) => ({
              ...x,
              comprobanteUrl: x.comprobanteUrl ?? null,
              nota: x.nota ?? '',
              usuario: nombres.get(x.usuarioId) ?? '—',
            }))
        : [],
      historial: d.historial
        .filter((h) => h.entidad === 'pedido' && h.entidadId === p.id)
        .filter((h) => veDinero || !h.nota.startsWith('Pago'))
        .sort((a, b) => b.id - a.id)
        .map((h) => ({
          id: h.id,
          de: h.de,
          a: h.a,
          nota: h.nota,
          visibleCliente: h.visibleCliente,
          usuario: h.usuarioId ? (nombres.get(h.usuarioId) ?? '—') : 'Sistema',
          creadoEn: h.creadoEn,
        })),
    }
  }

  const entregaVista = (e: EntregaDemo | undefined): Entrega | null =>
    e
      ? {
          ...e,
          mensajero: e.mensajeroId
            ? { id: e.mensajeroId, nombre: nombres.get(e.mensajeroId) ?? '—' }
            : null,
        }
      : null

  const crearEntrega = (p: PedidoDemo) => {
    if (entregas.some((x) => x.pedidoId === p.id)) return
    const cli = cot.clientes.find((x) => x.id === p.clienteId)
    entregas.push({
      id: sig(entregas),
      pedidoId: p.id,
      modalidad: p.modalidad,
      estado: 'por_programar',
      fechaProgramada: null,
      franja: '',
      direccion: p.modalidad === 'recoge' ? '' : (cli?.direccion ?? ''),
      ciudad: cli?.ciudad ?? '',
      recibe: cli?.nombre ?? '',
      telefono: cli?.whatsapp ?? '',
      quienLleva: null,
      mensajeroId: null,
      servicioTercero: '',
      transportadora: '',
      guia: '',
      costoCobrado: costoEnvioCobrado(p.cargos),
      costoReal: null,
      contraentrega: false,
      montoContraentrega: 0,
      evidenciaUrl: null,
      novedad: '',
      recibidoPor: '',
      entregadaEn: null,
      notas: '',
    })
  }

  const buscar = (id: string) => {
    const p = d.pedidos.find((x) => x.id === Number(id))
    if (!p || !puedeVer(p)) return fallo(404, NO_EXISTE)
    return p
  }

  // ===================== Seguimiento público (sin login) =====================
  const seg = ruta.match(/^\/seguimiento\/([^/?]+)$/)
  if (seg && metodo === 'GET') {
    const NO =
      'No encontramos un pedido con ese código. Revisa que esté bien escrito (empieza por HC-) o escríbenos.'
    const codigo = normalizarCodigo(decodeURIComponent(seg[1]))
    const p = codigo
      ? d.pedidos.find((x) => x.seguimiento === codigo)
      : undefined
    if (!p) return fallo(404, NO)
    const pag = pagado(p.id)
    const e = entregas.find((x) => x.pedidoId === p.id)
    const lineaCliente = (l: LineaDemo): EstadoLineaCliente => {
      const est = estadoLinea(p, l)
      return est === 'listo'
        ? 'listo'
        : est === 'espera_anticipo'
          ? 'esperando'
          : 'fabricando'
    }
    const vistos = new Set<string>()
    const eventos: SeguimientoPublico['eventos'] = []
    for (const ev of d.historial.filter(
      (h) => h.entidad === 'pedido' && h.entidadId === p.id && h.visibleCliente
    )) {
      const texto = textoEventoCliente(ev)
      if (!texto || vistos.has(texto)) continue
      vistos.add(texto)
      eventos.push({ fecha: ev.creadoEn, texto })
    }
    const r: SeguimientoPublico = {
      codigo: p.codigo,
      seguimiento: p.seguimiento,
      cliente: (cot.clientes.find((x) => x.id === p.clienteId)?.nombre ?? '')
        .split(' ')
        .slice(0, 3)
        .join(' '),
      estado: p.estado,
      fechaCompromiso: p.fechaCompromiso,
      modalidad: p.modalidad,
      lineas: p.lineas.map((l) => ({
        nombre: l.nombre,
        cantidad: l.cantidad,
        imagen: l.imagen,
        estado: lineaCliente(l),
      })),
      entrega:
        e && e.estado !== 'por_programar'
          ? {
              estado: e.estado,
              fechaProgramada: e.fechaProgramada,
              franja: e.franja,
              transportadora: e.transportadora,
              guia: e.guia,
              recibidoPor: e.recibidoPor,
              entregadaEn: e.entregadaEn,
            }
          : null,
      dinero: {
        total: p.total,
        pagado: pag,
        falta: Math.max(0, p.total - pag),
        anticipoPendiente:
          p.estado === 'cancelado'
            ? 0
            : anticipoPendiente({ ...p, pagado: pag }),
      },
      eventos: eventos.reverse(),
      negocio: {
        whatsapp: textos.negocio_whatsapp ?? '',
        email: textos.negocio_email ?? '',
        ciudad: textos.negocio_ciudad ?? '',
        datosPago: textos.datos_pago ?? '',
      },
    }
    return { pedido: r }
  }

  // ===================== Reportes =====================
  if (ruta.startsWith('/reportes') && metodo === 'GET') {
    if (!tiene('admin', 'comercial')) fallo(403, SIN_PERMISO)
    const mes =
      new URLSearchParams(ruta.split('?')[1] ?? '').get('mes') ?? mesActual()
    if (!MES_VALIDO.test(mes)) fallo(400, 'El mes debe tener la forma 2026-10.')
    const { desde, hasta, dias } = limitesMes(mes)
    const mios = (p: PedidoDemo) => esAdmin || p.comercialId === u.id
    const enMes = (f: string) => new Date(f) >= desde && new Date(f) < hasta
    const delMes = d.pedidos.filter(
      (p) => mios(p) && p.estado !== 'cancelado' && enMes(p.creadoEn)
    )
    const porDia = Array.from({ length: dias }, (_, i) => ({
      dia: i + 1,
      total: 0,
      pedidos: 0,
    }))
    const com = new Map<number, ReporteMes['comerciales'][number]>()
    for (const p of delMes) {
      const x = porDia[diaBogota(new Date(p.creadoEn)) - 1]
      x.total += p.total
      x.pedidos++
      const k = com.get(p.comercialId) ?? {
        id: p.comercialId,
        nombre: nombres.get(p.comercialId) ?? '—',
        pedidos: 0,
        ventas: 0,
        ganancia: 0,
        gananciaPagada: 0,
      }
      k.pedidos++
      k.ventas += p.total
      k.ganancia += p.ganancia
      if (pagado(p.id) >= p.total) k.gananciaPagada += p.ganancia
      com.set(p.comercialId, k)
    }
    const total = delMes.reduce((a, p) => a + p.total, 0)
    const idsMios = new Set(d.pedidos.filter(mios).map((p) => p.id))
    const prod = new Map<number, ReporteMes['productos'][number]>()
    for (const p of delMes) {
      for (const l of p.lineas) {
        const x = prod.get(l.productoId) ?? {
          productoId: l.productoId,
          nombre: l.nombre,
          unidades: 0,
          ventas: 0,
        }
        x.unidades += l.cantidad
        x.ventas += l.cantidad * l.precioVenta
        prod.set(l.productoId, x)
      }
    }
    const env = entregas.filter(
      (e) => delMes.some((p) => p.id === e.pedidoId) && e.costoReal !== null
    )
    const cliente = (id: number) => cot.clientes.find((x) => x.id === id)
    const r: ReporteMes = {
      mes,
      ventas: {
        total,
        pedidos: delMes.length,
        ticket: delMes.length ? Math.round(total / delMes.length) : 0,
        cobrado: d.pagos
          .filter((x) => idsMios.has(x.pedidoId) && enMes(x.creadoEn))
          .reduce((a, x) => a + x.monto, 0),
      },
      porDia,
      comerciales: [...com.values()].sort((a, b) => b.ventas - a.ventas),
      pedidos: delMes.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        cliente: cliente(p.clienteId)?.nombre ?? '—',
        comercial: nombres.get(p.comercialId) ?? '—',
        fecha: p.creadoEn,
        total: p.total,
        ganancia: p.ganancia,
        estadoPago: estadoPago({
          ...p,
          pagado: pagado(p.id),
          cancelado: false,
        }),
      })),
      porCobrar: d.pedidos
        .filter(
          (p) =>
            mios(p) && p.estado === 'entregado' && p.total - pagado(p.id) > 0
        )
        .map((p) => ({
          id: p.id,
          codigo: p.codigo,
          cliente: cliente(p.clienteId)?.nombre ?? '—',
          whatsapp: cliente(p.clienteId)?.whatsapp ?? '',
          comercial: nombres.get(p.comercialId) ?? '—',
          entregadoEn:
            entregas.find((e) => e.pedidoId === p.id)?.entregadaEn ?? null,
          saldo: p.total - pagado(p.id),
        })),
      productos: [...prod.values()]
        .sort((a, b) => b.unidades - a.unidades)
        .slice(0, 10),
      envios: {
        cobrado: env.reduce((a, e) => a + e.costoCobrado, 0),
        costoReal: env.reduce((a, e) => a + (e.costoReal ?? 0), 0),
        conCosto: env.length,
      },
    }
    return r
  }

  // ===================== Pendientes de Inicio =====================
  if (ruta === '/inicio' && metodo === 'GET') {
    const lista: Pendiente[] = []
    const agregar = (
      n: number,
      [uno, varios]: [string, string],
      url: string,
      tono: Pendiente['tono'] = 'normal'
    ) => {
      if (n > 0)
        lista.push({ cantidad: n, texto: n === 1 ? uno : varios, url, tono })
    }
    const mio = (comercialId: number) => esAdmin || comercialId === u.id
    const ahoraMs = Date.now()
    if (tiene('admin', 'comercial')) {
      agregar(
        cot.cotizaciones.filter(
          (x) =>
            mio(x.comercialId) &&
            x.estado === 'enviada' &&
            x.venceEn &&
            new Date(x.venceEn).getTime() <= ahoraMs + 2 * 86_400_000
        ).length,
        [
          'cotización vence en los próximos 2 días: llama al cliente',
          'cotizaciones vencen en los próximos 2 días: llama al cliente',
        ],
        '/cotizar',
        'urgente'
      )
      agregar(
        cot.cotizaciones.filter(
          (x) =>
            mio(x.comercialId) &&
            x.estado === 'aprobada' &&
            !d.pedidos.some((p) => p.cotizacionId === x.id)
        ).length,
        [
          'cotización aprobada por convertir en pedido',
          'cotizaciones aprobadas por convertir en pedido',
        ],
        '/cotizar',
        'urgente'
      )
      agregar(
        d.pedidos.filter((p) => mio(p.comercialId) && p.estado === 'confirmado')
          .length,
        ['pedido espera el anticipo', 'pedidos esperan el anticipo'],
        '/pedidos'
      )
      agregar(
        d.pedidos.filter(
          (p) =>
            mio(p.comercialId) &&
            p.estado === 'listo' &&
            (entregas.find((e) => e.pedidoId === p.id)?.estado ??
              'por_programar') === 'por_programar'
        ).length,
        [
          'pedido listo sin entrega programada',
          'pedidos listos sin entrega programada',
        ],
        '/entregas',
        'urgente'
      )
      agregar(
        d.pedidos.filter((p) => mio(p.comercialId) && p.estado === 'entregado')
          .length,
        [
          'pedido entregado aún debe plata',
          'pedidos entregados aún deben plata',
        ],
        '/cobros'
      )
    }
    if (tiene('admin', 'fabricacion')) {
      agregar(
        taller.productos.filter((x) => x.estado === 'solicitud').length,
        [
          'personalizado pedido por un comercial espera diseño y precio',
          'personalizados pedidos por los comerciales esperan diseño y precio',
        ],
        '/taller'
      )
      agregar(
        d.ordenes.filter(
          (o) =>
            o.estado === 'imprimiendo' &&
            o.finEstimado &&
            new Date(o.finEstimado).getTime() < ahoraMs
        ).length,
        [
          'impresión ya debió terminar: revisa la impresora',
          'impresiones ya debieron terminar: revisa las impresoras',
        ],
        '/cola',
        'urgente'
      )
      agregar(
        d.ordenes.filter(
          (o) => o.estado === 'en_cola' || o.estado === 'postproceso'
        ).length,
        [
          'orden en la cola o por terminar',
          'órdenes en la cola o por terminar',
        ],
        '/cola'
      )
    }
    if (tiene('entregas')) {
      const fin = new Date()
      fin.setHours(23, 59, 59, 999)
      agregar(
        entregas.filter(
          (e) =>
            (e.mensajeroId === u.id || e.modalidad === 'recoge') &&
            (e.estado === 'en_camino' ||
              (e.estado === 'programada' &&
                !!e.fechaProgramada &&
                new Date(e.fechaProgramada) <= fin))
        ).length,
        ['entrega para hoy', 'entregas para hoy'],
        '/entregas',
        'urgente'
      )
    }
    return { pendientes: lista }
  }

  // ===================== Pedidos =====================
  if (ruta.startsWith('/pedidos')) {
    if (!tiene('admin', 'comercial', 'fabricacion', 'entregas'))
      fallo(403, SIN_PERMISO)
    const soloVende = () =>
      tiene('admin', 'comercial') || fallo(403, SIN_PERMISO)

    if (ruta === '/pedidos' && metodo === 'GET') {
      return {
        pedidos: d.pedidos
          .filter(puedeVer)
          .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
          .map(resumen),
      }
    }

    if (ruta === '/pedidos' && metodo === 'POST') {
      soloVende()
      const cotizacion =
        cot.cotizaciones.find((x) => x.id === Number(c.cotizacionId)) ??
        fallo(404, 'No encontramos esa cotización.')
      if (!esAdmin && cotizacion.comercialId !== u.id)
        fallo(403, 'Esta cotización es de otro comercial.')
      const ya = d.pedidos.find((x) => x.cotizacionId === cotizacion.id)
      if (ya) fallo(409, `Esta cotización ya es el pedido ${ya.codigo}.`)
      if (cotizacion.estado !== 'aprobada') {
        fallo(
          400,
          'Solo se convierte en pedido una cotización que el cliente aceptó.'
        )
      }
      const r = calcularCotizacion(
        cotizacion.lineas,
        cotizacion.cargos,
        cotizacion.descuento,
        cotizacion.modalidad,
        config
      )
      if (cotizacion.congelado) Object.assign(r, cotizacion.congelado)
      const anio = new Date().getFullYear()
      const numero =
        Math.max(
          0,
          ...d.pedidos.filter((x) => x.anio === anio).map((x) => x.numero)
        ) + 1
      const requiereAnticipo = r.anticipo > 0
      const id = sig(d.pedidos)
      const codigo = codigoPedido(anio, numero)
      let lineaId = Math.max(
        0,
        ...d.pedidos.flatMap((x) => x.lineas.map((l) => l.id))
      )
      const lineas: LineaDemo[] = cotizacion.lineas.map((l) => {
        const prod = taller.productos.find((x) => x.id === l.productoId)
        const desdeStock =
          !l.personalizado && !!prod && prod.stock >= l.cantidad
        if (desdeStock) prod!.stock -= l.cantidad
        return {
          id: ++lineaId,
          productoId: l.productoId,
          nombre: l.nombre,
          descripcion: l.descripcion,
          imagen: l.imagen,
          cantidad: l.cantidad,
          precioFabrica: l.precioFabrica,
          precioVenta: l.precioVenta,
          personalizado: l.personalizado,
          desdeStock,
        }
      })
      const p: PedidoDemo = {
        id,
        anio,
        numero,
        codigo,
        seguimiento: codigoSeguimiento(),
        cotizacionId: cotizacion.id,
        clienteId: cotizacion.clienteId!,
        comercialId: cotizacion.comercialId,
        estado: 'confirmado',
        modalidad: cotizacion.modalidad,
        subtotal: r.subtotal,
        descuento: r.descuento,
        total: r.total,
        ganancia: r.ganancia,
        anticipoPct: r.anticipoPct,
        anticipo: r.anticipo,
        requiereAnticipo,
        producirSinAnticipo: false,
        diasFabricacion: r.diasFabricacion,
        diasEnvio: r.diasEnvio,
        fechaCompromiso: requiereAnticipo
          ? null
          : sumarDiasHabiles(
              new Date(),
              r.diasFabricacion + r.diasEnvio
            ).toISOString(),
        notas: cotizacion.notas,
        motivoCancelacion: '',
        lineas,
        cargos: cotizacion.cargos,
        creadoEn: ahora(),
        actualizadoEn: ahora(),
      }
      d.pedidos.push(p)
      crearEntrega(p)
      for (const l of lineas.filter((x) => !x.desdeStock)) {
        d.ordenes.push({
          id: sig(d.ordenes),
          pedidoId: id,
          lineaId: l.id,
          productoId: l.productoId,
          cantidad: l.cantidad,
          estado:
            l.personalizado && requiereAnticipo ? 'espera_anticipo' : 'en_cola',
          impresoraId: null,
          bobinaId: null,
          operadorId: null,
          inicio: null,
          finEstimado: null,
          finReal: null,
          intentos: 0,
          gramosPerdidos: 0,
          motivoFalla: '',
          actualizadoEn: ahora(),
        })
      }
      anotar({
        entidad: 'pedido',
        entidadId: id,
        a: 'confirmado',
        nota: `Creado desde la cotización ${cotizacion.codigo}.`,
        visibleCliente: true,
      })
      recalcular(p)
      return { pedido: detalle(p) }
    }

    let r = ruta.match(/^\/pedidos\/(\d+)$/)
    if (r && metodo === 'GET') return { pedido: detalle(buscar(r[1])) }

    r = ruta.match(/^\/pedidos\/(\d+)\/pagos$/)
    if (r && metodo === 'POST') {
      soloVende()
      const p = buscar(r[1])
      if (!puedeCobrar(p)) fallo(403, 'Este pedido es de otro comercial.')
      if (p.estado === 'cancelado')
        fallo(400, 'El pedido está cancelado: no se le registran pagos.')
      const antes = pagado(p.id)
      const v = validarPago(c, p.total - antes)
      if (!v.ok) return fallo(400, v.mensaje, v.campo)
      d.pagos.push({
        id: sig(d.pagos),
        pedidoId: p.id,
        tipo: tipoDePago({ ...p, pagadoAntes: antes, monto: v.datos.monto }),
        ...v.datos,
        comprobanteUrl: c.comprobanteUrl ? String(c.comprobanteUrl) : null,
        usuarioId: u.id,
        creadoEn: ahora(),
      })
      anotar({
        entidad: 'pedido',
        entidadId: p.id,
        nota: `Pago registrado: $ ${v.datos.monto.toLocaleString('es-CO')}`,
      })
      recalcular(p)
      return { pedido: detalle(p) }
    }

    r = ruta.match(/^\/pedidos\/(\d+)\/producir-sin-anticipo$/)
    if (r && metodo === 'POST') {
      if (!esAdmin) fallo(403, SIN_PERMISO)
      const p = buscar(r[1])
      if (p.estado !== 'confirmado')
        fallo(400, 'Este pedido ya está en producción.')
      p.producirSinAnticipo = true
      anotar({
        entidad: 'pedido',
        entidadId: p.id,
        nota: 'El administrador autorizó producir sin anticipo.',
      })
      recalcular(p)
      return { pedido: detalle(p) }
    }

    r = ruta.match(/^\/pedidos\/(\d+)\/cancelar$/)
    if (r && metodo === 'POST') {
      soloVende()
      const p = buscar(r[1])
      if (!puedeCobrar(p)) fallo(403, 'Este pedido es de otro comercial.')
      if (p.estado === 'cancelado')
        fallo(400, 'Este pedido ya estaba cancelado.')
      if (['en_entrega', 'entregado', 'cerrado'].includes(p.estado)) {
        fallo(400, 'Este pedido ya salió a entrega: no se puede cancelar.')
      }
      const v = validarMotivoCancelacion(c)
      if (!v.ok) return fallo(400, v.mensaje, v.campo)
      const ordenes = d.ordenes.filter((o) => o.pedidoId === p.id)
      if (
        !esAdmin &&
        ordenes.some((o) => !['espera_anticipo', 'en_cola'].includes(o.estado))
      ) {
        fallo(
          403,
          'El taller ya empezó a imprimir este pedido. Solo el administrador lo puede cancelar.'
        )
      }
      const devolver = [
        ...p.lineas.filter((l) => l.desdeStock),
        ...ordenes.filter((o) => o.estado === 'listo'),
      ]
      for (const x of devolver) {
        const prod = taller.productos.find((y) => y.id === x.productoId)
        if (prod) prod.stock += x.cantidad
      }
      for (const o of ordenes.filter((x) => x.estado !== 'listo'))
        o.estado = 'cancelada'
      anotar({
        entidad: 'pedido',
        entidadId: p.id,
        de: p.estado,
        a: 'cancelado',
        nota: v.motivo,
        visibleCliente: true,
      })
      p.estado = 'cancelado'
      p.motivoCancelacion = v.motivo
      p.actualizadoEn = ahora()
      return { pedido: detalle(p) }
    }

    r = ruta.match(/^\/pedidos\/(\d+)\/notas$/)
    if (r && metodo === 'POST') {
      const p = buscar(r[1])
      const v = validarNota(c)
      if (!v.ok) return fallo(400, v.mensaje, v.campo)
      anotar({
        entidad: 'pedido',
        entidadId: p.id,
        nota: v.nota,
        visibleCliente: v.visibleCliente,
      })
      return { pedido: detalle(p) }
    }
    r = ruta.match(/^\/pedidos\/(\d+)\/reembolso$/)
    if (r && metodo === 'POST') {
      if (!esAdmin) fallo(403, SIN_PERMISO)
      const p = buscar(r[1])
      const v = validarReembolso(c, pagado(p.id))
      if (!v.ok) return fallo(400, v.mensaje, v.campo)
      d.pagos.push({
        id: sig(d.pagos),
        pedidoId: p.id,
        tipo: 'reembolso',
        metodo: v.datos.metodo,
        monto: -v.datos.monto,
        referencia: '',
        nota: v.datos.motivo,
        usuarioId: u.id,
        creadoEn: ahora(),
      })
      // En un pedido que sigue, la devolución es un descuento: baja el total
      if (p.estado !== 'cancelado') p.total -= v.datos.monto
      anotar({
        entidad: 'pedido',
        entidadId: p.id,
        nota: `Pago devuelto al cliente: $ ${v.datos.monto.toLocaleString('es-CO')} — ${v.datos.motivo}`,
      })
      recalcular(p)
      return { pedido: detalle(p) }
    }

    r = ruta.match(/^\/pedidos\/(\d+)\/factura$/)
    if (r && metodo === 'PATCH') {
      soloVende()
      const p = buscar(r[1])
      if (!puedeCobrar(p)) fallo(403, 'Este pedido es de otro comercial.')
      p.numeroFactura = String(c.numeroFactura ?? '')
        .trim()
        .slice(0, 40)
      return { pedido: detalle(p) }
    }
    return undefined
  }

  // ===================== Entregas =====================
  if (ruta.startsWith('/entregas')) {
    if (!tiene('admin', 'comercial', 'entregas')) fallo(403, SIN_PERMISO)
    const veEntrega = (p: PedidoDemo) =>
      tiene('admin', 'entregas') || p.comercialId === u.id
    const programa = (p: PedidoDemo) =>
      esAdmin || (tiene('comercial') && p.comercialId === u.id)

    if (ruta === '/entregas' && metodo === 'GET') {
      const hace30 = Date.now() - 30 * 86_400_000
      for (const p of d.pedidos.filter((x) => DE_ENTREGA.includes(x.estado)))
        crearEntrega(p)
      const lista: EntregaLista[] = entregas
        .map((e) => ({ e, p: d.pedidos.find((x) => x.id === e.pedidoId)! }))
        .filter(({ p }) => p && DE_ENTREGA.includes(p.estado) && veEntrega(p))
        .filter(
          ({ e }) =>
            e.estado !== 'entregada' ||
            new Date(e.entregadaEn ?? 0).getTime() >= hace30
        )
        .sort((a, b) =>
          (a.e.fechaProgramada ?? '').localeCompare(b.e.fechaProgramada ?? '')
        )
        .map(({ e, p }) => {
          const cli = cot.clientes.find((x) => x.id === p.clienteId)
          return {
            ...entregaVista(e)!,
            pedido: {
              id: p.id,
              codigo: p.codigo,
              cliente: cli?.nombre ?? '—',
              whatsapp: cli?.whatsapp ?? '',
              listo: DE_ENTREGA.includes(p.estado),
              saldo: p.total - pagado(p.id),
              cancelado: false,
            },
          }
        })
      return { entregas: lista }
    }
    if (ruta === '/entregas/mensajeros' && metodo === 'GET') {
      if (!tiene('admin', 'comercial')) fallo(403, SIN_PERMISO)
      return { mensajeros }
    }
    const r = ruta.match(
      /^\/entregas\/(\d+)\/(programar|salir|entregada|novedad)$/
    )
    if (r && metodo === 'POST') {
      const e = entregas.find((x) => x.id === Number(r[1]))
      const p = e && d.pedidos.find((x) => x.id === e.pedidoId)
      if (!e || !p || !veEntrega(p))
        return fallo(404, 'No encontramos esa entrega.')
      if (p.estado === 'cancelado')
        fallo(400, 'El pedido se canceló: ya no se entrega.')
      const saldo = p.total - pagado(p.id)
      const accion = r[2]
      if (accion === 'programar') {
        if (!programa(p))
          fallo(
            403,
            'Solo el comercial del pedido o el administrador programan la entrega.'
          )
        if (!['listo', 'en_entrega'].includes(p.estado)) {
          fallo(
            400,
            'La entrega se programa cuando el pedido esté listo en el taller.'
          )
        }
        if (!['por_programar', 'programada'].includes(e.estado)) {
          fallo(400, 'Ya salió: si hubo un problema, usa “Hubo una novedad”.')
        }
        const v = validarProgramacion(
          c,
          e.modalidad,
          saldo,
          mensajeros.map((m) => m.id)
        )
        if (!v.ok) return fallo(400, v.mensaje, v.campo)
        Object.assign(e, v.datos, { estado: 'programada', novedad: '' })
        const cuando = new Intl.DateTimeFormat('es-CO', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date(v.datos.fechaProgramada))
        anotar({
          entidad: 'pedido',
          entidadId: p.id,
          nota:
            e.modalidad === 'recoge'
              ? `Listo para recoger el ${cuando}.`
              : e.modalidad === 'nacional'
                ? `Se despacha por ${v.datos.transportadora} el ${cuando}.`
                : `Entrega programada para el ${cuando}${v.datos.franja ? ` (${v.datos.franja.toLowerCase()})` : ''}.`,
          visibleCliente: true,
        })
      } else if (accion === 'salir') {
        if (e.modalidad === 'recoge')
          fallo(
            400,
            'En “recoge en el taller” no hay salida: marca directamente que la recogió.'
          )
        if (e.estado !== 'programada')
          fallo(
            400,
            e.estado === 'por_programar'
              ? 'Primero programa la entrega.'
              : 'Esta entrega ya salió.'
          )
        const ok = puedeSalir({
          listo: true,
          saldo,
          contraentrega: e.contraentrega,
          montoContraentrega: e.montoContraentrega,
        })
        if (!ok.ok) return fallo(400, ok.mensaje)
        const guia = String(c.guia ?? e.guia).trim()
        if (e.modalidad === 'nacional' && !guia)
          fallo(400, 'Escribe el número de guía de la transportadora.', 'guia')
        e.guia = guia
        if (c.costoReal !== undefined && c.costoReal !== '')
          e.costoReal = Math.round(Number(c.costoReal)) || 0
        e.estado = 'en_camino'
        anotar({
          entidad: 'pedido',
          entidadId: p.id,
          nota:
            e.modalidad === 'nacional'
              ? `Despachado por ${e.transportadora}. Guía ${guia}.`
              : 'Salió a entregar.',
          visibleCliente: true,
        })
      } else if (accion === 'entregada') {
        if (!['programada', 'en_camino'].includes(e.estado))
          fallo(400, 'Primero programa la entrega.')
        const ok = puedeSalir({
          listo: true,
          saldo,
          contraentrega: e.contraentrega,
          montoContraentrega: e.montoContraentrega,
        })
        if (!ok.ok) return fallo(400, ok.mensaje)
        const v = validarEntregada(c, e, saldo)
        if (!v.ok) return fallo(400, v.mensaje, v.campo)
        if (v.datos.montoCobrado > 0 && v.datos.metodo) {
          d.pagos.push({
            id: sig(d.pagos),
            pedidoId: p.id,
            tipo: tipoDePago({
              ...p,
              pagadoAntes: pagado(p.id),
              monto: v.datos.montoCobrado,
            }),
            metodo: v.datos.metodo,
            monto: v.datos.montoCobrado,
            referencia: 'Cobrado al entregar',
            usuarioId: u.id,
            creadoEn: ahora(),
          })
          anotar({
            entidad: 'pedido',
            entidadId: p.id,
            nota: `Pago registrado al entregar: $ ${v.datos.montoCobrado.toLocaleString('es-CO')}`,
          })
        }
        Object.assign(e, {
          estado: 'entregada',
          recibidoPor: v.datos.recibidoPor,
          evidenciaUrl: v.datos.evidenciaUrl,
          entregadaEn: ahora(),
          novedad: '',
        })
        anotar({
          entidad: 'pedido',
          entidadId: p.id,
          nota: `Entregado. Recibió: ${v.datos.recibidoPor}.`,
          visibleCliente: true,
        })
      } else {
        if (!['programada', 'en_camino'].includes(e.estado))
          fallo(400, 'Esta entrega no está en curso.')
        const v = validarNovedad(c)
        if (!v.ok) return fallo(400, v.mensaje, v.campo)
        e.estado = 'programada'
        e.novedad = v.motivo
        anotar({
          entidad: 'pedido',
          entidadId: p.id,
          nota: `Novedad en la entrega: ${v.motivo}. Hay que volver a programarla.`,
          visibleCliente: true,
        })
      }
      recalcular(p)
      return { entrega: entregaVista(e) }
    }
    return undefined
  }

  // ===================== Cobros =====================
  if (ruta === '/cobros' && metodo === 'GET') {
    if (!tiene('admin', 'comercial')) fallo(403, SIN_PERMISO)
    const mios = d.pedidos.filter((p) => esAdmin || p.comercialId === u.id)
    const fila = (p: PedidoDemo): PedidoPorCobrar => {
      const pag = pagado(p.id)
      const cancelado = p.estado === 'cancelado'
      const cli = cot.clientes.find((x) => x.id === p.clienteId)
      return {
        id: p.id,
        codigo: p.codigo,
        estado: p.estado,
        cliente: { nombre: cli?.nombre ?? '—', whatsapp: cli?.whatsapp ?? '' },
        comercial: nombres.get(p.comercialId) ?? '—',
        total: p.total,
        pagado: pag,
        saldo: p.total - pag,
        anticipoPendiente: cancelado
          ? 0
          : anticipoPendiente({ ...p, pagado: pag }),
        estadoPago: estadoPago({ ...p, pagado: pag, cancelado }),
        contraentrega:
          entregas.find((x) => x.pedidoId === p.id)?.contraentrega ?? false,
        fechaCompromiso: p.fechaCompromiso,
      }
    }
    const porCobrar = mios
      .filter((p) => p.estado !== 'cancelado' && p.total - pagado(p.id) > 0)
      .map(fila)
    const porDevolver = mios
      .filter((p) => p.estado === 'cancelado' && pagado(p.id) > 0)
      .map(fila)
    const ids = new Set(mios.map((p) => p.id))
    const lista = d.pagos
      .filter((x) => ids.has(x.pedidoId))
      .sort((a, b) => b.id - a.id)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const mes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const suma = (desde: Date) =>
      lista
        .filter((x) => new Date(x.creadoEn) >= desde)
        .reduce((s, x) => s + x.monto, 0)
    const r: ResumenCobros = {
      porCobrar,
      porDevolver,
      pagos: lista.map((x) => {
        const p = d.pedidos.find((y) => y.id === x.pedidoId)!
        return {
          id: x.id,
          tipo: x.tipo,
          metodo: x.metodo,
          monto: x.monto,
          referencia: x.referencia,
          nota: x.nota ?? '',
          comprobanteUrl: x.comprobanteUrl ?? null,
          usuario: nombres.get(x.usuarioId) ?? '—',
          creadoEn: x.creadoEn,
          pedido: {
            id: p.id,
            codigo: p.codigo,
            cliente:
              cot.clientes.find((y) => y.id === p.clienteId)?.nombre ?? '—',
          },
        }
      }),
      totales: {
        hoy: suma(hoy),
        mes: suma(mes),
        porCobrar: porCobrar.reduce((s, x) => s + x.saldo, 0),
      },
    }
    return r
  }

  // ===================== Cola =====================
  if (!ruta.startsWith('/cola')) return undefined
  if (!tiene('admin', 'fabricacion', 'comercial')) fallo(403, SIN_PERMISO)
  const deTaller = () =>
    tiene('admin', 'fabricacion') || fallo(403, SIN_PERMISO)

  const vista = (o: OrdenDemo): OrdenCola => {
    const prod = taller.productos.find((x) => x.id === o.productoId)!
    const p = d.pedidos.find((x) => x.id === o.pedidoId)
    const est = estimarOrden(prod.horas, prod.unidadesPorCama, o.cantidad)
    return {
      id: o.id,
      estado: o.estado,
      producto: {
        id: prod.id,
        nombre: prod.nombre,
        sku: prod.sku,
        imagen: portadaDe(taller, prod.id),
        multicolor: prod.multicolor,
        impresoraSugeridaId: prod.impresoraId,
        bobinaSugeridaId: prod.bobinaId,
      },
      cantidad: o.cantidad,
      horas: est.horas,
      camas: est.camas,
      pedido: p
        ? {
            id: p.id,
            codigo: p.codigo,
            cliente:
              cot.clientes.find((x) => x.id === p.clienteId)?.nombre ?? '',
          }
        : null,
      fechaCompromiso: p?.fechaCompromiso ?? null,
      impresoraId: o.impresoraId,
      bobinaId: o.bobinaId,
      operador: o.operadorId ? (nombres.get(o.operadorId) ?? null) : null,
      inicio: o.inicio,
      finEstimado: o.finEstimado,
      finReal: o.finReal,
      intentos: o.intentos,
      gramosPerdidos: o.gramosPerdidos,
      motivoFalla: o.motivoFalla,
    }
  }

  if (ruta === '/cola' && metodo === 'GET') {
    const semana = Date.now() - 7 * 86_400_000
    const lista = d.ordenes
      .filter(
        (o) =>
          ['en_cola', 'imprimiendo', 'postproceso'].includes(o.estado) ||
          (o.estado === 'listo' &&
            new Date(o.actualizadoEn).getTime() >= semana)
      )
      .map(vista)
      .sort(
        (a, b) =>
          (a.fechaCompromiso ?? '9').localeCompare(b.fechaCompromiso ?? '9') ||
          a.id - b.id
      )
    return {
      ordenes: lista,
      impresoras: taller.impresoras.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        multicolor: i.multicolor,
        activa: i.activa,
      })),
    }
  }

  if (ruta === '/cola/stock' && metodo === 'POST') {
    deTaller()
    const cantidad = Number(c.cantidad)
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 1000) {
      fallo(
        400,
        'Escribe cuántas unidades vas a imprimir (de 1 a 1000).',
        'cantidad'
      )
    }
    const prod =
      taller.productos.find((x) => x.id === Number(c.productoId)) ??
      fallo(400, 'Elige el producto.', 'productoId')
    if (prod.estado !== 'activo' || prod.tipo !== 'catalogo') {
      fallo(
        400,
        'Para stock solo se imprimen productos de catálogo que estén activos.',
        'productoId'
      )
    }
    const o: OrdenDemo = {
      id: sig(d.ordenes),
      pedidoId: null,
      lineaId: null,
      productoId: prod.id,
      cantidad,
      estado: 'en_cola',
      impresoraId: null,
      bobinaId: null,
      operadorId: null,
      inicio: null,
      finEstimado: null,
      finReal: null,
      intentos: 0,
      gramosPerdidos: 0,
      motivoFalla: '',
      actualizadoEn: ahora(),
    }
    d.ordenes.push(o)
    anotar({
      entidad: 'orden',
      entidadId: o.id,
      a: 'en_cola',
      nota: 'Para stock',
    })
    return { orden: vista(o) }
  }

  let r = ruta.match(/^\/cola\/(\d+)$/)
  if (r && metodo === 'DELETE') {
    deTaller()
    const o =
      d.ordenes.find((x) => x.id === Number(r![1])) ??
      fallo(404, NO_EXISTE_ORDEN)
    if (o.pedidoId)
      fallo(
        400,
        'Esta orden es de un pedido. Para quitarla hay que cancelar el pedido.'
      )
    if (o.estado !== 'en_cola')
      fallo(400, 'Solo se puede quitar una orden que no se ha empezado.')
    d.ordenes = d.ordenes.filter((x) => x.id !== o.id)
    return { ok: true }
  }

  r = ruta.match(/^\/cola\/(\d+)\/(empezar|terminar|fallo|listo|devolver)$/)
  if (r && metodo === 'POST') {
    deTaller()
    const o =
      d.ordenes.find((x) => x.id === Number(r![1])) ??
      fallo(404, NO_EXISTE_ORDEN)
    const accion = r[2]
    const desde: Record<string, EstadoOrden[]> = {
      empezar: ['en_cola'],
      terminar: ['imprimiendo'],
      fallo: ['imprimiendo', 'postproceso'],
      listo: ['postproceso'],
      devolver: ['imprimiendo'],
    }
    if (!desde[accion].includes(o.estado)) {
      fallo(
        409,
        'Esta orden cambió mientras la mirabas. Se actualizó la pantalla; revisa e intenta de nuevo.'
      )
    }
    const prod = taller.productos.find((x) => x.id === o.productoId)!
    const antes = o.estado
    let nota = ''
    if (accion === 'empezar') {
      const imp = taller.impresoras.find((i) => i.id === Number(c.impresoraId))
      const v = validarImpresoraParaOrden(prod, imp)
      if (!v.ok) return fallo(400, v.mensaje, v.campo)
      const ocupada = d.ordenes.find(
        (x) => x.impresoraId === imp!.id && x.estado === 'imprimiendo'
      )
      if (ocupada) {
        const n = taller.productos.find(
          (x) => x.id === ocupada.productoId
        )?.nombre
        fallo(
          400,
          `La ${imp!.nombre} está imprimiendo "${n}". Márcala como terminada primero.`,
          'impresoraId'
        )
      }
      const inicio = new Date()
      const est = estimarOrden(prod.horas, prod.unidadesPorCama, o.cantidad)
      Object.assign(o, {
        estado: 'imprimiendo',
        impresoraId: imp!.id,
        bobinaId: Number(c.bobinaId) || null,
        operadorId: u.id,
        inicio: inicio.toISOString(),
        finEstimado: sumarHoras(inicio, est.horas || 1).toISOString(),
        finReal: null,
        intentos: o.intentos + 1,
      })
    } else if (accion === 'terminar') {
      Object.assign(o, { estado: 'postproceso', finReal: ahora() })
    } else if (accion === 'fallo') {
      const v = validarFalla(c)
      if (!v.ok) return fallo(400, v.mensaje, v.campo)
      Object.assign(o, {
        estado: 'en_cola',
        impresoraId: null,
        inicio: null,
        finEstimado: null,
        finReal: null,
        motivoFalla: v.datos.motivo,
        gramosPerdidos: o.gramosPerdidos + v.datos.gramosPerdidos,
      })
      nota = `Falló: ${v.datos.motivo}`
    } else if (accion === 'listo') {
      o.estado = 'listo'
      if (!o.pedidoId) prod.stock += o.cantidad
    } else {
      Object.assign(o, {
        estado: 'en_cola',
        impresoraId: null,
        inicio: null,
        finEstimado: null,
        intentos: Math.max(0, o.intentos - 1),
      })
      nota = 'Se devolvió a la cola (se había empezado por error).'
    }
    o.actualizadoEn = ahora()
    anotar({ entidad: 'orden', entidadId: o.id, de: antes, a: o.estado, nota })
    const p = d.pedidos.find((x) => x.id === o.pedidoId)
    if (p) recalcular(p)
    return { orden: vista(o) }
  }

  return undefined
}
