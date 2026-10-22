/**
 * Entregas, domicilios y cobros: tipos, nombres en español y reglas que usan
 * el servidor, la pantalla y la versión de prueba.
 */
import { type Cargo, type Modalidad } from './cotizacion.js'
import { METODOS_PAGO, type MetodoPago } from './pedidos.js'

// ---------- Estados de la entrega ----------

export const ESTADOS_ENTREGA = ['por_programar', 'programada', 'en_camino', 'entregada'] as const
export type EstadoEntrega = (typeof ESTADOS_ENTREGA)[number]

/** El nombre depende de cómo se entrega. */
export function nombreEstadoEntrega(estado: EstadoEntrega, modalidad: Modalidad) {
  if (estado === 'por_programar') return 'Por programar'
  if (estado === 'programada') return modalidad === 'recoge' ? 'Lista para recoger' : 'Programada'
  if (estado === 'en_camino') return modalidad === 'nacional' ? 'Despachada' : 'En ruta'
  return 'Entregada'
}

export const FRANJAS = ['Mañana (8 a 12)', 'Tarde (12 a 5)', 'Noche (5 a 8)'] as const

export const TRANSPORTADORAS = [
  'Servientrega',
  'Interrapidísimo',
  'Coordinadora',
  'Envía',
  'TCC',
  'Deprisa',
]

export type QuienLleva = 'mensajero' | 'tercero'

export type Entrega = {
  id: number
  pedidoId: number
  modalidad: Modalidad
  estado: EstadoEntrega
  fechaProgramada: string | null
  franja: string
  direccion: string
  ciudad: string
  recibe: string
  telefono: string
  quienLleva: QuienLleva | null
  mensajero: { id: number; nombre: string } | null
  servicioTercero: string
  transportadora: string
  guia: string
  /** Lo que se le cobró al cliente por el envío (cargos de la cotización). */
  costoCobrado: number
  /** Lo que de verdad costó el envío. */
  costoReal: number | null
  contraentrega: boolean
  montoContraentrega: number
  evidenciaUrl: string | null
  novedad: string
  recibidoPor: string
  entregadaEn: string | null
  notas: string
}

/** Para la lista de Entregas y la vista del mensajero. */
export type EntregaLista = Entrega & {
  pedido: {
    id: number
    codigo: string
    cliente: string
    whatsapp: string
    /** Todo el pedido está impreso y empacado. */
    listo: boolean
    saldo: number
    cancelado: boolean
  }
}

// ---------- Estado de pago ----------

export type EstadoPago = 'sin_pagos' | 'con_anticipo' | 'con_abono' | 'pagado' | 'por_devolver'

export const ESTADOS_PAGO_INFO: Record<EstadoPago, string> = {
  sin_pagos: 'Sin pagos',
  con_anticipo: 'Con anticipo',
  con_abono: 'Con abono',
  pagado: 'Pagado',
  por_devolver: 'Por devolver',
}

export function estadoPago(p: {
  total: number
  pagado: number
  anticipo: number
  requiereAnticipo: boolean
  cancelado: boolean
}): EstadoPago {
  if (p.cancelado) return p.pagado > 0 ? 'por_devolver' : 'sin_pagos'
  if (p.pagado <= 0) return 'sin_pagos'
  if (p.pagado >= p.total) return 'pagado'
  if (p.requiereAnticipo && p.pagado >= p.anticipo) return 'con_anticipo'
  return 'con_abono'
}

/** Cuánto se le cobró al cliente por el envío (cargos tipo Envío o Domicilio). */
export function costoEnvioCobrado(cargos: Cargo[]) {
  return cargos
    .filter((c) => /env[ií]o|domicilio|transporte|flete/i.test(c.concepto))
    .reduce((s, c) => s + c.valor, 0)
}

// ---------- Validaciones ----------

type Malo = { ok: false; mensaje: string; campo?: string }
const malo = (mensaje: string, campo?: string): Malo => ({ ok: false, mensaje, campo })
const fmt = (n: number) => `$\u00a0${n.toLocaleString('es-CO')}`
const txt = (v: unknown, max: number) =>
  String(v ?? '')
    .trim()
    .slice(0, max)
const entero = (v: unknown) => (v === '' || v == null ? null : Math.round(Number(v)))

export type ProgramacionEntrada = {
  fechaProgramada: string
  franja: string
  direccion: string
  ciudad: string
  recibe: string
  telefono: string
  quienLleva: QuienLleva | null
  mensajeroId: number | null
  servicioTercero: string
  transportadora: string
  guia: string
  costoReal: number | null
  contraentrega: boolean
  montoContraentrega: number
  notas: string
}

/** Valida los datos para programar (o reprogramar) una entrega. */
export function validarProgramacion(
  c: Record<string, unknown>,
  modalidad: Modalidad,
  saldo: number,
  mensajeros: number[]
): { ok: true; datos: ProgramacionEntrada } | Malo {
  const fecha = new Date(String(c.fechaProgramada ?? ''))
  if (!c.fechaProgramada || Number.isNaN(fecha.getTime())) {
    return malo(
      modalidad === 'nacional'
        ? '¿Qué día se despacha? Elige la fecha.'
        : modalidad === 'recoge'
          ? '¿Qué día viene a recoger? Elige la fecha.'
          : '¿Qué día se entrega? Elige la fecha.',
      'fechaProgramada'
    )
  }
  const hace2Dias = Date.now() - 2 * 86_400_000
  if (fecha.getTime() < hace2Dias) {
    return malo('La fecha ya pasó. Elige hoy o un día que venga.', 'fechaProgramada')
  }
  const direccion = txt(c.direccion, 200)
  const ciudad = txt(c.ciudad, 60)
  const recibe = txt(c.recibe, 80)
  const telefono = txt(c.telefono, 30)
  if (telefono && !/^[+\d\s()-]{7,30}$/.test(telefono)) {
    return malo('El teléfono solo lleva números. Ejemplo: 300 123 4567', 'telefono')
  }
  let quienLleva: QuienLleva | null = null
  let mensajeroId: number | null = null
  let servicioTercero = ''
  let transportadora = ''
  if (modalidad === 'local') {
    if (!direccion) return malo('Escribe la dirección de entrega.', 'direccion')
    if (!telefono) return malo('Escribe un teléfono de quien recibe.', 'telefono')
    quienLleva = c.quienLleva === 'tercero' ? 'tercero' : c.quienLleva === 'mensajero' ? 'mensajero' : null
    if (!quienLleva) return malo('Elige quién lo lleva: nuestro mensajero o un servicio.', 'quienLleva')
    if (quienLleva === 'mensajero') {
      mensajeroId = Number(c.mensajeroId) || null
      if (!mensajeroId || !mensajeros.includes(mensajeroId)) {
        return malo('Elige qué mensajero lo lleva.', 'mensajeroId')
      }
    } else {
      servicioTercero = txt(c.servicioTercero, 60)
      if (!servicioTercero) {
        return malo('Escribe qué servicio lo lleva. Ejemplo: Picap, Rappi, un taxi…', 'servicioTercero')
      }
    }
  }
  if (modalidad === 'nacional') {
    if (!direccion || !ciudad) {
      return malo('Escribe la dirección y la ciudad de destino.', !direccion ? 'direccion' : 'ciudad')
    }
    transportadora = txt(c.transportadora, 60)
    if (!transportadora) return malo('Elige la transportadora.', 'transportadora')
  }
  if (modalidad === 'recoge' && !recibe) {
    return malo('Escribe quién viene a recoger.', 'recibe')
  }
  const costoReal = entero(c.costoReal)
  if (costoReal !== null && (!Number.isFinite(costoReal) || costoReal < 0 || costoReal > 5_000_000)) {
    return malo('Escribe cuánto cuesta de verdad el envío (o déjalo vacío).', 'costoReal')
  }
  const contraentrega = c.contraentrega === true
  let montoContraentrega = 0
  if (contraentrega) {
    montoContraentrega = entero(c.montoContraentrega) ?? saldo
    if (saldo <= 0) return malo('Este pedido ya está pagado: no hay nada que cobrar al entregar.', 'contraentrega')
    if (!Number.isFinite(montoContraentrega) || montoContraentrega <= 0) {
      return malo('Escribe cuánto se cobra al entregar.', 'montoContraentrega')
    }
    if (montoContraentrega > saldo) {
      return malo(`Es más de lo que falta por pagar (${fmt(saldo)}).`, 'montoContraentrega')
    }
  }
  return {
    ok: true,
    datos: {
      fechaProgramada: fecha.toISOString(),
      franja: txt(c.franja, 40),
      direccion,
      ciudad,
      recibe,
      telefono,
      quienLleva,
      mensajeroId,
      servicioTercero,
      transportadora,
      guia: txt(c.guia, 60),
      costoReal,
      contraentrega,
      montoContraentrega,
      notas: txt(c.notas, 300),
    },
  }
}

/** Regla: no sale un pedido con saldo, salvo que se cobre al entregar. */
export function puedeSalir(e: {
  listo: boolean
  saldo: number
  contraentrega: boolean
  montoContraentrega: number
}): { ok: true } | Malo {
  if (!e.listo) return malo('El pedido todavía no está listo en el taller.')
  if (e.saldo > 0 && !(e.contraentrega && e.montoContraentrega >= e.saldo)) {
    return malo(
      `Falta cobrar ${fmt(e.saldo)}. Regístralo en el pedido, o marca la entrega “contra entrega” para cobrarlo al entregar.`
    )
  }
  return { ok: true }
}

export type EntregadaEntrada = {
  recibidoPor: string
  montoCobrado: number
  metodo: MetodoPago | null
  evidenciaUrl: string | null
}

/** Datos al marcar una entrega como entregada. */
export function validarEntregada(
  c: Record<string, unknown>,
  e: { contraentrega: boolean; montoContraentrega: number },
  saldo: number
): { ok: true; datos: EntregadaEntrada } | Malo {
  const recibidoPor = txt(c.recibidoPor, 80)
  if (recibidoPor.length < 2) return malo('Escribe quién recibió.', 'recibidoPor')
  let montoCobrado = 0
  let metodo: MetodoPago | null = null
  if (e.contraentrega && saldo > 0) {
    montoCobrado = entero(c.montoCobrado) ?? e.montoContraentrega
    if (!Number.isFinite(montoCobrado) || montoCobrado < 0) {
      return malo('Escribe cuánto te pagó el cliente.', 'montoCobrado')
    }
    if (montoCobrado > saldo) return malo(`Es más de lo que debía (${fmt(saldo)}).`, 'montoCobrado')
    if (montoCobrado < saldo) {
      return malo(
        `El cliente debe ${fmt(saldo)}. Si no pagó completo, usa “Hubo una novedad” y cuéntalo.`,
        'montoCobrado'
      )
    }
    metodo = String(c.metodo ?? '') as MetodoPago
    if (!(METODOS_PAGO as readonly string[]).includes(metodo)) {
      return malo('Elige cómo te pagó: efectivo, Nequi…', 'metodo')
    }
  }
  const url = String(c.evidenciaUrl ?? '').trim()
  return { ok: true, datos: { recibidoPor, montoCobrado, metodo, evidenciaUrl: url || null } }
}

export function validarNovedad(c: Record<string, unknown>): { ok: true; motivo: string } | Malo {
  const motivo = txt(c.motivo, 300)
  if (motivo.length < 3) {
    return malo('Cuenta qué pasó. Ejemplo: no había nadie en la casa.', 'motivo')
  }
  return { ok: true, motivo }
}

export type ReembolsoEntrada = { monto: number; metodo: MetodoPago; motivo: string }

/** Devolver plata al cliente: solo el Admin, hasta lo que pagó. */
export function validarReembolso(
  c: Record<string, unknown>,
  pagado: number
): { ok: true; datos: ReembolsoEntrada } | Malo {
  const monto = Math.round(Number(c.monto))
  if (!Number.isFinite(monto) || monto <= 0) return malo('Escribe cuánto se le devuelve.', 'monto')
  if (monto > pagado) return malo(`El cliente solo ha pagado ${fmt(pagado)}.`, 'monto')
  const metodo = String(c.metodo ?? '') as MetodoPago
  if (!(METODOS_PAGO as readonly string[]).includes(metodo)) {
    return malo('Elige cómo se le devuelve.', 'metodo')
  }
  const motivo = txt(c.motivo, 300)
  if (motivo.length < 3) return malo('Escribe por qué se le devuelve.', 'motivo')
  return { ok: true, datos: { monto, metodo, motivo } }
}

// ---------- Cobros ----------

export type PedidoPorCobrar = {
  id: number
  codigo: string
  estado: string
  cliente: { nombre: string; whatsapp: string }
  comercial: string
  total: number
  pagado: number
  saldo: number
  anticipoPendiente: number
  estadoPago: EstadoPago
  /** Se cobra al entregar. */
  contraentrega: boolean
  fechaCompromiso: string | null
}

export type PagoReciente = {
  id: number
  tipo: string
  metodo: string
  monto: number
  referencia: string
  nota: string
  comprobanteUrl: string | null
  usuario: string
  creadoEn: string
  pedido: { id: number; codigo: string; cliente: string }
}

export type ResumenCobros = {
  porCobrar: PedidoPorCobrar[]
  porDevolver: PedidoPorCobrar[]
  pagos: PagoReciente[]
  totales: { hoy: number; mes: number; porCobrar: number }
}
