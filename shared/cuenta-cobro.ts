/**
 * Cuentas de cobro: el documento que pide un cliente (normalmente una
 * empresa) cuando quien vende es una persona natural que no está obligada
 * a facturar. La usan pantalla y servidor.
 */

/** Clave en la tabla configuracion donde se guardan los datos de quien cobra. */
export const CLAVE_CUENTA_COBRO = 'cuenta_cobro'

export const TIPOS_DOCUMENTO = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  NIT: 'NIT',
  PP: 'Pasaporte',
} as const
export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO

export const DECLARACION_POR_DEFECTO =
  'Declaro bajo la gravedad de juramento que no soy responsable del impuesto sobre las ventas (IVA) y que no estoy obligado(a) a expedir factura de venta ni documento equivalente.'

/** Datos de la persona a cuyo nombre salen las cuentas de cobro (los llena el admin). */
export type DatosCobrador = {
  nombre: string
  tipoDocumento: TipoDocumento
  documento: string
  direccion: string
  ciudad: string
  telefono: string
  email: string
  /** Banco, Nequi... Sale al final del documento. */
  datosPago: string
  declaracion: string
  /** Imagen de la firma (PNG como data URL) o null. */
  firma: string | null
}

export function datosCobradorPorDefecto(): DatosCobrador {
  return {
    nombre: '',
    tipoDocumento: 'CC',
    documento: '',
    direccion: '',
    ciudad: 'Pereira, Risaralda',
    telefono: '',
    email: '',
    datosPago: '',
    declaracion: DECLARACION_POR_DEFECTO,
    firma: null,
  }
}

/** Lee lo guardado y completa lo que falte (sirve con datos viejos o vacíos). */
export function leerDatosCobrador(valor: unknown): DatosCobrador {
  const base = datosCobradorPorDefecto()
  if (!valor || typeof valor !== 'object') return base
  const v = valor as Record<string, unknown>
  const texto = (k: keyof DatosCobrador) =>
    typeof v[k] === 'string' ? (v[k] as string) : (base[k] as string)
  return {
    nombre: texto('nombre'),
    tipoDocumento:
      typeof v.tipoDocumento === 'string' && v.tipoDocumento in TIPOS_DOCUMENTO
        ? (v.tipoDocumento as TipoDocumento)
        : base.tipoDocumento,
    documento: texto('documento'),
    direccion: texto('direccion'),
    ciudad: texto('ciudad'),
    telefono: texto('telefono'),
    email: texto('email'),
    datosPago: texto('datosPago'),
    declaracion: texto('declaracion'),
    firma: typeof v.firma === 'string' && v.firma ? v.firma : null,
  }
}

/** Qué le falta a los datos de quien cobra para poder hacer cuentas de cobro. */
export function faltaEnCobrador(d: DatosCobrador): string[] {
  const falta: string[] = []
  if (!d.nombre.trim()) falta.push('el nombre')
  if (!d.documento.trim()) falta.push('el número de documento')
  if (!d.ciudad.trim()) falta.push('la ciudad')
  if (!d.declaracion.trim()) falta.push('la declaración')
  return falta
}

type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; mensaje: string; campo?: string }

const MAX_FIRMA = 400_000 // ~300 KB de imagen

/** Documento: solo números, puntos, guiones y espacios (ej. 900.123.456-7). */
const DOCUMENTO = /^[0-9][0-9.\- ]{3,19}$/

export function validarDatosCobrador(entrada: unknown): Resultado<DatosCobrador> {
  const d = leerDatosCobrador(entrada)
  const limpio: DatosCobrador = {
    ...d,
    nombre: d.nombre.trim(),
    documento: d.documento.trim(),
    direccion: d.direccion.trim(),
    ciudad: d.ciudad.trim(),
    telefono: d.telefono.trim(),
    email: d.email.trim(),
    datosPago: d.datosPago.trim(),
    declaracion: d.declaracion.trim(),
  }
  const largos: [keyof DatosCobrador, string, number][] = [
    ['nombre', 'El nombre', 100],
    ['direccion', 'La dirección', 120],
    ['ciudad', 'La ciudad', 60],
    ['telefono', 'El teléfono', 30],
    ['email', 'El correo', 80],
    ['datosPago', 'Los datos para pagar', 600],
    ['declaracion', 'La declaración', 1200],
  ]
  for (const [campo, nombre, max] of largos) {
    if ((limpio[campo] as string).length > max) {
      return { ok: false, campo, mensaje: `${nombre} es muy largo: máximo ${max} letras.` }
    }
  }
  if (limpio.documento && !DOCUMENTO.test(limpio.documento)) {
    return {
      ok: false,
      campo: 'documento',
      mensaje: 'El número de documento solo lleva números (puedes usar puntos y guion).',
    }
  }
  if (limpio.firma) {
    if (!limpio.firma.startsWith('data:image/png;base64,')) {
      return { ok: false, campo: 'firma', mensaje: 'La firma debe ser una imagen. Súbela de nuevo.' }
    }
    if (limpio.firma.length > MAX_FIRMA) {
      return {
        ok: false,
        campo: 'firma',
        mensaje: 'La imagen de la firma es muy pesada. Recórtala o tómale la foto más de cerca.',
      }
    }
  }
  return { ok: true, datos: limpio }
}

// ---------- Cuenta de cobro ----------

/** Quien paga (el cliente). */
export type Pagador = {
  nombre: string
  tipoDocumento: TipoDocumento
  documento: string
  direccion: string
  ciudad: string
}

export type ItemCuenta = {
  descripcion: string
  cantidad: number
  valorUnitario: number
  total: number
}

export type EstadoCuenta = 'vigente' | 'anulada'

/** Camino de la cuenta de cobro con el cliente. */
export type EstadoEnvio = 'por_enviar' | 'enviada' | 'recibida' | 'aceptada'

export const ESTADOS_ENVIO: Record<EstadoEnvio, { etiqueta: string; ayuda: string }> = {
  por_enviar: { etiqueta: 'Por enviar', ayuda: 'Todavía no se le ha mandado al cliente.' },
  enviada: { etiqueta: 'Enviada', ayuda: 'Se le mandó el enlace; aún no lo abre.' },
  recibida: { etiqueta: 'Recibida', ayuda: 'El cliente abrió el enlace.' },
  aceptada: { etiqueta: 'Aceptada', ayuda: 'El cliente la descargó.' },
}

export function estadoEnvio(c: {
  enviadaEn: string | null
  recibidaEn: string | null
  aceptadaEn: string | null
}): EstadoEnvio {
  if (c.aceptadaEn) return 'aceptada'
  if (c.recibidaEn) return 'recibida'
  if (c.enviadaEn) return 'enviada'
  return 'por_enviar'
}

/** Enlace (relativo) que se le manda al cliente. */
export const rutaPublicaCuenta = (token: string) => `/cuenta-de-cobro/${token}`

/** Mensaje de WhatsApp con el enlace. */
export function mensajeCuenta(c: { codigo: string; total: number; pagador: { nombre: string } }, enlace: string) {
  const total = `$ ${c.total.toLocaleString('es-CO')}`
  return [
    `Hola, ${c.pagador.nombre.replace(/\.+$/, '')}. Te enviamos la cuenta de cobro ${c.codigo} de Hecho en Capas por ${total}.`,
    `Puedes verla y descargarla aquí: ${enlace}`,
    'Gracias por tu compra.',
  ].join('\n\n')
}

export type CuentaCobro = {
  id: number
  codigo: string
  numero: number
  /** Fecha de expedición, AAAA-MM-DD (hora de Colombia). */
  fecha: string
  estado: EstadoCuenta
  motivoAnulacion: string
  anuladaEn: string | null
  pedido: { id: number; codigo: string }
  cobrador: Omit<DatosCobrador, 'datosPago' | 'declaracion' | 'firma'>
  pagador: Pagador
  concepto: string
  items: ItemCuenta[]
  cargos: { concepto: string; valor: number }[]
  descuento: number
  total: number
  valorEnLetras: string
  /** Lo que el cliente ya había pagado al hacerla. */
  abonado: number
  declaracion: string
  datosPago: string
  firma: string | null
  creadoPor: string
  creadoEn: string
  token: string
  enviadaEn: string | null
  recibidaEn: string | null
  aceptadaEn: string | null
}

/** Lo que ve el cliente en el enlace (sin datos internos). */
export type CuentaPublica = Omit<
  CuentaCobro,
  'creadoPor' | 'pedido' | 'token' | 'enviadaEn' | 'recibidaEn' | 'aceptadaEn' | 'id'
> & { pedido: { codigo: string } }

/** Fila de la lista de cuentas de cobro. */
export type CuentaResumen = {
  id: number
  codigo: string
  fecha: string
  estado: EstadoCuenta
  total: number
  pagador: string
  pedido: { id: number; codigo: string }
  envio: EstadoEnvio
  /** Último cambio con el cliente (enviada, recibida o aceptada). */
  envioEn: string | null
}

/** Lo que trae la tarjeta del pedido. */
export type CuentasDelPedido = {
  vigente: CuentaCobro | null
  anuladas: CuentaResumen[]
  /** Por qué no se puede hacer (pedido cancelado, sin datos de quien cobra...). */
  bloqueo: string | null
  /** Para llenar el formulario: datos del cliente y concepto sugerido. */
  sugerencia: { pagador: Pagador; concepto: string; total: number }
}

export const codigoCuenta = (numero: number) => `CC-${String(numero).padStart(4, '0')}`

export const conceptoSugerido = (codigoPedido: string) =>
  `Venta de piezas impresas en 3D según el pedido ${codigoPedido}.`

/** Valida lo que llena el admin al hacer la cuenta de cobro. */
export function validarNuevaCuenta(
  entrada: unknown
): Resultado<{ pagador: Pagador; concepto: string }> {
  const v = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>
  const p = (v.pagador && typeof v.pagador === 'object' ? v.pagador : {}) as Record<string, unknown>
  const t = (x: unknown) => (typeof x === 'string' ? x.trim() : '')
  const pagador: Pagador = {
    nombre: t(p.nombre),
    tipoDocumento:
      typeof p.tipoDocumento === 'string' && p.tipoDocumento in TIPOS_DOCUMENTO
        ? (p.tipoDocumento as TipoDocumento)
        : 'NIT',
    documento: t(p.documento),
    direccion: t(p.direccion),
    ciudad: t(p.ciudad),
  }
  const concepto = t(v.concepto)
  if (!pagador.nombre) {
    return { ok: false, campo: 'nombre', mensaje: 'Escribe a nombre de quién va (empresa o persona que paga).' }
  }
  if (pagador.nombre.length > 120) {
    return { ok: false, campo: 'nombre', mensaje: 'El nombre es muy largo: máximo 120 letras.' }
  }
  if (!pagador.documento) {
    return {
      ok: false,
      campo: 'documento',
      mensaje: 'Escribe el NIT o la cédula de quien paga. Pídeselo al cliente: sin eso la cuenta de cobro no le sirve.',
    }
  }
  if (!DOCUMENTO.test(pagador.documento)) {
    return {
      ok: false,
      campo: 'documento',
      mensaje: 'El NIT o la cédula solo lleva números (puedes usar puntos y guion, ej. 900.123.456-7).',
    }
  }
  if (pagador.direccion.length > 120 || pagador.ciudad.length > 60) {
    return { ok: false, campo: 'direccion', mensaje: 'La dirección o la ciudad es muy larga.' }
  }
  if (concepto.length < 5) {
    return { ok: false, campo: 'concepto', mensaje: 'Escribe el concepto: qué se está cobrando.' }
  }
  if (concepto.length > 400) {
    return { ok: false, campo: 'concepto', mensaje: 'El concepto es muy largo: máximo 400 letras.' }
  }
  return { ok: true, datos: { pagador, concepto } }
}

export function validarMotivoAnulacion(entrada: unknown): Resultado<string> {
  const motivo = typeof entrada === 'string' ? entrada.trim() : ''
  if (motivo.length < 5) {
    return { ok: false, campo: 'motivo', mensaje: 'Escribe por qué se anula (ej. "el NIT estaba mal").' }
  }
  if (motivo.length > 300) {
    return { ok: false, campo: 'motivo', mensaje: 'El motivo es muy largo: máximo 300 letras.' }
  }
  return { ok: true, datos: motivo }
}

// ---------- Valor en letras ----------

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
  'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
]
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos',
]

/** 0..999 en letras ("uno" al final; se apocopa afuera). */
function hasta999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const r = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (r) {
    if (r < 30) partes.push(UNIDADES[r])
    else {
      const d = Math.floor(r / 10)
      const u = r % 10
      partes.push(u ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d])
    }
  }
  return partes.join(' ')
}

/** "uno" → "un" y "veintiuno" → "veintiún" delante de un sustantivo (mil, millones, pesos). */
const apocopar = (s: string) => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')

/** 0..999.999 en letras, sin apocopar el final. */
function hasta999999(n: number): string {
  const miles = Math.floor(n / 1000)
  const resto = n % 1000
  const partes: string[] = []
  if (miles === 1) partes.push('mil')
  else if (miles > 1) partes.push(`${apocopar(hasta999(miles))} mil`)
  if (resto) partes.push(hasta999(resto))
  return partes.join(' ')
}

/**
 * Número entero en letras, como va en una cuenta de cobro:
 * 1.250.000 → "Un millón doscientos cincuenta mil pesos m/cte."
 */
export function enLetras(valor: number): string {
  const n = Math.round(Math.abs(valor))
  if (n === 0) return 'Cero pesos m/cte.'
  if (n === 1) return 'Un peso m/cte.'
  const millones = Math.floor(n / 1_000_000)
  const resto = n % 1_000_000
  const partes: string[] = []
  if (millones === 1) partes.push('un millón')
  else if (millones > 1) partes.push(`${apocopar(hasta999999(millones))} millones`)
  if (resto) partes.push(apocopar(hasta999999(resto)))
  // "un millón de pesos", pero "un millón cien mil pesos"
  const de = millones > 0 && resto === 0 ? ' de' : ''
  const texto = `${partes.join(' ')}${de} pesos m/cte.`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}
