/**
 * Clientes y cotizaciones en la versión de prueba: imita /api/clientes y
 * /api/cotizaciones en el navegador con las mismas reglas del servidor.
 */
import { type ValoresConfig } from '@shared/configuracion'
import {
  type Cargo,
  type Cliente,
  type CotizacionDetalle,
  type CotizacionEntrada,
  type CotizacionResumen,
  type EstadoCotizacion,
  type LineaCotizacion,
  type Modalidad,
  calcularCotizacion,
  codigoCotizacion,
  leerEntradaCotizacion,
  validarCliente,
  validarParaEnviar,
  validarPreciosCotizacion,
} from '@shared/cotizacion'
import { type Rol } from '@shared/roles'
import { skuDe } from '@shared/taller'
import { ApiError } from '@/lib/api'
import { portadaDe, type TallerDemo } from './taller-demo'

export type CotizacionDemo = {
  id: number
  anio: number
  numero: number
  version: number
  codigo: string
  estado: EstadoCotizacion
  clienteId: number | null
  comercialId: number
  modalidad: Modalidad
  descuento: number
  notas: string
  lineas: LineaCotizacion[]
  cargos: Cargo[]
  imagenes: { id: number; url: string; nombre: string }[]
  /** Anticipo y días congelados al enviar. */
  congelado: {
    anticipoPct: number
    anticipo: number
    diasFabricacion: number
    diasEnvio: number
  } | null
  motivoRechazo: string
  reemplazaId: number | null
  creadaEn: string
  actualizadaEn: string
  enviadaEn: string | null
  venceEn: string | null
}

export type CotizarDemo = {
  clientes: Cliente[]
  cotizaciones: CotizacionDemo[]
}

export function cotizarInicial(): CotizarDemo {
  return {
    clientes: [
      {
        id: 1,
        nombre: 'Café La Molienda',
        whatsapp: '310 222 3344',
        email: '',
        ciudad: 'Pereira',
        direccion: 'Cra. 7 # 20-15',
        documento: '',
      },
    ],
    cotizaciones: [],
  }
}

type Persona = { id: number; nombre: string; roles: Rol[] }

const fallo = (status: number, mensaje: string, campo?: string): never => {
  throw new ApiError(status, mensaje, campo)
}
const SIN_PERMISO =
  'No tienes permiso para hacer esto. Pídeselo al administrador.'
const NO_EXISTE = 'No encontramos esa cotización.'
const SOLO_BORRADOR =
  'Esta cotización ya se envió y no se puede cambiar. Usa “Hacer cambios” para crear una versión nueva.'
const ahora = () => new Date().toISOString()
const sig = (lista: { id: number }[]) =>
  Math.max(0, ...lista.map((x) => x.id)) + 1

export function atenderCotizar(
  d: CotizarDemo,
  taller: TallerDemo,
  config: ValoresConfig,
  nombres: Map<number, string>,
  u: Persona,
  ruta: string,
  metodo: string,
  c: Record<string, unknown>,
  pedidoDe: (
    cotizacionId: number
  ) => { id: number; codigo: string } | null = () => null
): unknown {
  const esAdmin = u.roles.includes('admin')
  const vende = esAdmin || u.roles.includes('comercial')
  const ve = vende || u.roles.includes('fabricacion')
  const soloVende = () => vende || fallo(403, SIN_PERMISO)

  // ---- Clientes ----
  if (ruta.startsWith('/clientes')) {
    soloVende()
    const [base, query = ''] = ruta.split('?')
    if (base === '/clientes' && metodo === 'GET') {
      const q = (new URLSearchParams(query).get('q') ?? '').trim().toLowerCase()
      return {
        clientes: d.clientes
          .filter(
            (x) =>
              !q ||
              [x.nombre, x.whatsapp, x.documento].some((t) =>
                t.toLowerCase().includes(q)
              )
          )
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
          .slice(0, 50),
      }
    }
    if (base === '/clientes' && metodo === 'POST') {
      const v = validarCliente(c)
      if (!v.ok) return fallo(400, v.mensaje, v.campo)
      const nuevo = { id: sig(d.clientes), ...v.datos }
      d.clientes.push(nuevo)
      return { cliente: nuevo }
    }
    const r = base.match(/^\/clientes\/(\d+)$/)
    if (r && metodo === 'PATCH') {
      const v = validarCliente(c)
      if (!v.ok) return fallo(400, v.mensaje, v.campo)
      const x =
        d.clientes.find((y) => y.id === Number(r[1])) ??
        fallo(404, 'No encontramos ese cliente.')
      Object.assign(x, v.datos)
      return { cliente: x }
    }
    return undefined
  }

  if (!ruta.startsWith('/cotizaciones')) return undefined
  if (!ve) fallo(403, SIN_PERMISO)

  // Las enviadas cuya vigencia pasó quedan vencidas
  for (const x of d.cotizaciones) {
    if (
      x.estado === 'enviada' &&
      x.venceEn &&
      new Date(x.venceEn) < new Date()
    ) {
      x.estado = 'vencida'
    }
  }

  const cargar = (id: string, paraCambiar: boolean) => {
    const cot =
      d.cotizaciones.find((x) => x.id === Number(id)) ?? fallo(404, NO_EXISTE)
    const propia = cot.comercialId === u.id
    if (
      !esAdmin &&
      !propia &&
      (paraCambiar || !u.roles.includes('fabricacion'))
    ) {
      fallo(
        403,
        'Esta cotización es de otro comercial. Solo él o el administrador la pueden cambiar.'
      )
    }
    if (paraCambiar) soloVende()
    return cot
  }

  const verGanancia = vende

  const resumenDe = (cot: CotizacionDemo) => {
    const r = calcularCotizacion(
      cot.lineas,
      cot.cargos,
      cot.descuento,
      cot.modalidad,
      config
    )
    if (cot.congelado) {
      Object.assign(r, cot.congelado)
      r.saldo = r.total - r.anticipo
    }
    return r
  }

  const detalle = (cot: CotizacionDemo): CotizacionDetalle => {
    const resumen = resumenDe(cot)
    const ocultar = !verGanancia
    return {
      id: cot.id,
      codigo: cot.codigo,
      version: cot.version,
      estado: cot.estado,
      cliente: d.clientes.find((x) => x.id === cot.clienteId) ?? null,
      comercial: {
        id: cot.comercialId,
        nombre: nombres.get(cot.comercialId) ?? '—',
      },
      total: resumen.total,
      ganancia: ocultar ? 0 : resumen.ganancia,
      creadaEn: cot.creadaEn,
      enviadaEn: cot.enviadaEn,
      venceEn: cot.venceEn,
      modalidad: cot.modalidad,
      lineas: ocultar
        ? cot.lineas.map((l) => ({ ...l, precioFabrica: 0 }))
        : cot.lineas,
      cargos: cot.cargos,
      notas: cot.notas,
      motivoRechazo: cot.motivoRechazo,
      imagenes: cot.imagenes,
      resumen: ocultar ? { ...resumen, ganancia: 0 } : resumen,
      reemplazadaPor:
        d.cotizaciones.find((x) => x.reemplazaId === cot.id)?.id ?? null,
      pedido: pedidoDe(cot.id),
    }
  }

  /** Valida contra el catálogo de hoy y arma las líneas. */
  const armar = (e: CotizacionEntrada) => {
    const mapa = new Map(taller.productos.map((p) => [p.id, p]))
    const v = validarPreciosCotizacion(
      e.lineas,
      mapa,
      e.descuento,
      config.tope_comercial
    )
    if (!v.ok) return fallo(400, v.mensaje, v.campo)
    return e.lineas.map((l): LineaCotizacion => {
      const p = mapa.get(l.productoId)!
      return {
        productoId: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        imagen: portadaDe(taller, p.id),
        cantidad: l.cantidad,
        precioFabrica: p.precioFabrica,
        precioVenta: l.precioVenta,
        personalizado: p.tipo === 'personalizado',
        diasFabricacion: p.diasFabricacion,
        desdeStock: p.stock >= l.cantidad,
      }
    })
  }

  const leer = () => {
    const e = leerEntradaCotizacion(c)
    if (!e.ok) return fallo(400, e.mensaje, e.campo)
    return e.datos
  }

  if (ruta === '/cotizaciones' && metodo === 'GET') {
    const soloMias = !esAdmin && !u.roles.includes('fabricacion')
    const lista: CotizacionResumen[] = d.cotizaciones
      .filter((x) => !soloMias || x.comercialId === u.id)
      .sort((a, b) => b.actualizadaEn.localeCompare(a.actualizadaEn))
      .map((x) => {
        const det = detalle(x)
        return {
          id: x.id,
          codigo: x.codigo,
          version: x.version,
          estado: x.estado,
          cliente: det.cliente
            ? { id: det.cliente.id, nombre: det.cliente.nombre }
            : null,
          comercial: det.comercial,
          total: det.total,
          ganancia: det.ganancia,
          lineas: x.lineas.length,
          creadaEn: x.creadaEn,
          enviadaEn: x.enviadaEn,
          venceEn: x.venceEn,
        }
      })
    return { cotizaciones: lista }
  }

  if (ruta === '/cotizaciones' && metodo === 'POST') {
    soloVende()
    const e = leer()
    const lineas = armar(e)
    const anio = new Date().getFullYear()
    const numero =
      Math.max(
        0,
        ...d.cotizaciones.filter((x) => x.anio === anio).map((x) => x.numero)
      ) + 1
    const cot: CotizacionDemo = {
      id: sig(d.cotizaciones),
      anio,
      numero,
      version: 1,
      codigo: codigoCotizacion(anio, numero, 1),
      estado: 'borrador',
      clienteId: e.clienteId,
      comercialId: u.id,
      modalidad: e.modalidad,
      descuento: e.descuento,
      notas: e.notas,
      lineas,
      cargos: e.cargos,
      imagenes: [],
      congelado: null,
      motivoRechazo: '',
      reemplazaId: null,
      creadaEn: ahora(),
      actualizadaEn: ahora(),
      enviadaEn: null,
      venceEn: null,
    }
    d.cotizaciones.push(cot)
    return { cotizacion: detalle(cot) }
  }

  let r = ruta.match(/^\/cotizaciones\/(\d+)$/)
  if (r && metodo === 'GET') return { cotizacion: detalle(cargar(r[1], false)) }
  if (r && metodo === 'PATCH') {
    const cot = cargar(r[1], true)
    if (cot.estado !== 'borrador') fallo(400, SOLO_BORRADOR)
    const e = leer()
    Object.assign(cot, {
      lineas: armar(e),
      clienteId: e.clienteId,
      modalidad: e.modalidad,
      descuento: e.descuento,
      notas: e.notas,
      cargos: e.cargos,
      actualizadaEn: ahora(),
    })
    return { cotizacion: detalle(cot) }
  }
  if (r && metodo === 'DELETE') {
    const cot = cargar(r[1], true)
    if (cot.estado !== 'borrador') {
      fallo(400, 'Solo se pueden borrar cotizaciones que no se han enviado.')
    }
    const anterior = d.cotizaciones.find((x) => x.id === cot.reemplazaId)
    if (anterior?.estado === 'reemplazada') anterior.estado = 'enviada'
    d.cotizaciones = d.cotizaciones.filter((x) => x.id !== cot.id)
    return { ok: true }
  }

  r = ruta.match(/^\/cotizaciones\/(\d+)\/enviar$/)
  if (r && metodo === 'POST') {
    const cot = cargar(r[1], true)
    if (cot.estado !== 'borrador')
      fallo(400, 'Esta cotización ya estaba marcada como enviada.')
    const listo = validarParaEnviar(cot)
    if (!listo.ok) fallo(400, listo.mensaje, listo.campo)
    cot.lineas = armar({
      clienteId: cot.clienteId,
      modalidad: cot.modalidad,
      lineas: cot.lineas,
      cargos: cot.cargos,
      descuento: cot.descuento,
      notas: cot.notas,
    })
    const res = calcularCotizacion(
      cot.lineas,
      cot.cargos,
      cot.descuento,
      cot.modalidad,
      config
    )
    cot.congelado = {
      anticipoPct: res.anticipoPct,
      anticipo: res.anticipo,
      diasFabricacion: res.diasFabricacion,
      diasEnvio: res.diasEnvio,
    }
    cot.estado = 'enviada'
    cot.enviadaEn = ahora()
    cot.venceEn = new Date(
      Date.now() + config.vigencia_cotizacion_dias * 86_400_000
    ).toISOString()
    cot.actualizadaEn = ahora()
    return { cotizacion: detalle(cot) }
  }

  r = ruta.match(/^\/cotizaciones\/(\d+)\/(aprobar|rechazar)$/)
  if (r && metodo === 'POST') {
    const cot = cargar(r[1], true)
    const estado = r[2] === 'aprobar' ? 'aprobada' : 'rechazada'
    if (cot.estado === 'vencida' && estado === 'aprobada') {
      fallo(
        400,
        'Esta cotización ya venció. Usa “Hacer cambios” para crear una versión nueva con precios de hoy.'
      )
    }
    if (
      cot.estado !== 'enviada' &&
      !(cot.estado === 'vencida' && estado === 'rechazada')
    ) {
      fallo(400, 'Solo se puede responder una cotización enviada.')
    }
    cot.estado = estado
    cot.motivoRechazo =
      estado === 'rechazada'
        ? String(c.motivo ?? '')
            .trim()
            .slice(0, 300)
        : ''
    cot.actualizadaEn = ahora()
    return { cotizacion: detalle(cot) }
  }

  r = ruta.match(/^\/cotizaciones\/(\d+)\/nueva-version$/)
  if (r && metodo === 'POST') {
    const ant = cargar(r[1], true)
    if (!['enviada', 'vencida', 'rechazada'].includes(ant.estado)) {
      fallo(
        400,
        ant.estado === 'borrador'
          ? 'Esta cotización todavía es un borrador: puedes cambiarla directamente.'
          : 'De esta cotización ya no se pueden hacer versiones nuevas.'
      )
    }
    const version =
      Math.max(
        ...d.cotizaciones
          .filter((x) => x.anio === ant.anio && x.numero === ant.numero)
          .map((x) => x.version)
      ) + 1
    const nueva: CotizacionDemo = {
      ...structuredClone(ant),
      id: sig(d.cotizaciones),
      version,
      codigo: codigoCotizacion(ant.anio, ant.numero, version),
      estado: 'borrador',
      congelado: null,
      motivoRechazo: '',
      reemplazaId: ant.id,
      creadaEn: ahora(),
      actualizadaEn: ahora(),
      enviadaEn: null,
      venceEn: null,
    }
    ant.estado = 'reemplazada'
    d.cotizaciones.push(nueva)
    return { cotizacion: detalle(nueva) }
  }

  r = ruta.match(/^\/cotizaciones\/(\d+)\/imagenes$/)
  if (r && metodo === 'POST') {
    const cot = cargar(r[1], true)
    if (cot.estado !== 'borrador') fallo(400, SOLO_BORRADOR)
    if (cot.imagenes.length >= 8)
      fallo(400, 'Puedes adjuntar hasta 8 imágenes.')
    cot.imagenes.push({
      id:
        Math.max(
          0,
          ...d.cotizaciones.flatMap((x) => x.imagenes.map((i) => i.id))
        ) + 1,
      url: String(c.url ?? ''),
      nombre: String(c.nombre ?? '').slice(0, 200),
    })
    return { cotizacion: detalle(cot) }
  }
  r = ruta.match(/^\/cotizaciones\/(\d+)\/imagenes\/(\d+)$/)
  if (r && metodo === 'DELETE') {
    const cot = cargar(r[1], true)
    if (cot.estado !== 'borrador') fallo(400, SOLO_BORRADOR)
    cot.imagenes = cot.imagenes.filter((i) => i.id !== Number(r![2]))
    return { cotizacion: detalle(cot) }
  }

  r = ruta.match(/^\/cotizaciones\/(\d+)\/solicitud$/)
  if (r && metodo === 'POST') {
    const cot = cargar(r[1], true)
    const nombre = String(c.nombre ?? '')
      .trim()
      .slice(0, 120)
    const descripcion = String(c.descripcion ?? '')
      .trim()
      .slice(0, 1000)
    if (nombre.length < 2) {
      fallo(
        400,
        'Escribe qué quiere el cliente. Ejemplo: Figura de su mascota.',
        'nombre'
      )
    }
    if (descripcion.length < 10) {
      fallo(
        400,
        'Cuéntale al taller más detalles: tamaño, colores, para cuándo…',
        'descripcion'
      )
    }
    const id = sig(taller.productos)
    const base = taller.productos[0]
    taller.productos.push({
      ...base,
      id,
      sku: skuDe(id),
      nombre,
      descripcion: `${descripcion}\n\nPedido por ${u.nombre} en ${cot.codigo}.`,
      categoria: '',
      tipo: 'personalizado',
      estado: 'solicitud',
      multicolor: false,
      impresoraId: null,
      bobinaId: null,
      gramos: 0,
      horas: 0,
      horasDiseno: 0,
      precioManual: null,
      notaAjuste: '',
      costo: 0,
      precioCalculado: 0,
      precioFabrica: 0,
      stock: 0,
      actualizadoEn: ahora(),
    })
    return { productoId: id, sku: skuDe(id) }
  }

  return undefined
}
