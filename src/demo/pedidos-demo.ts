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
import { type Rol } from '@shared/roles'
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
  usuarioId: number
  creadoEn: string
}

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
  const { d, cot, taller, config, nombres } = ctx
  const tiene = (...r: Rol[]) => u.roles.some((x) => r.includes(x))
  const esAdmin = tiene('admin')
  const veDinero = tiene('admin', 'comercial')

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
    const estado = calcularEstadoPedido({
      ...base,
      cancelado: p.estado === 'cancelado',
      estadosLineas: p.lineas.map((l) => estadoLinea(p, l)),
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
      pagado: veDinero ? pagado(p.id) : 0,
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
      pagos: veDinero
        ? d.pagos
            .filter((x) => x.pedidoId === p.id)
            .map((x) => ({ ...x, usuario: nombres.get(x.usuarioId) ?? '—' }))
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

  const buscar = (id: string) => {
    const p = d.pedidos.find((x) => x.id === Number(id))
    if (!p || !puedeVer(p)) return fallo(404, NO_EXISTE)
    return p
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
    return undefined
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
