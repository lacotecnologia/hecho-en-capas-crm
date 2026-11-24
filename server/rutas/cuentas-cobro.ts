import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { getCookie } from 'hono/cookie'
import {
  CLAVE_CUENTA_COBRO,
  codigoCuenta,
  conceptoSugerido,
  type CuentaCobro,
  type CuentaPublica,
  type CuentaResumen,
  type CuentasDelPedido,
  type DatosCobrador,
  enLetras,
  estadoEnvio,
  type EstadoCuenta,
  faltaEnCobrador,
  type ItemCuenta,
  leerDatosCobrador,
  validarDatosCobrador,
  validarMotivoAnulacion,
  validarNuevaCuenta,
} from '../../shared/cuenta-cobro.js'
import { COOKIE_SESION, leerSesion } from '../auth.js'
import { getDb } from '../db/index.js'
import {
  clientes,
  configuracion,
  cuentasCobro,
  pedidoCargos,
  pedidoLineas,
  pedidos,
} from '../db/schema.js'
import { anotar, totalPagado } from '../pedidos-logica.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'

/** Solo el administrador hace y ve cuentas de cobro. */
export const rutasCuentasCobro = new Hono<{ Variables: Variables }>()
rutasCuentasCobro.use('*', conSesion, soloRoles('admin'))

/** Enlace que abre el cliente: no pide sesión. */
export const rutasCuentaPublica = new Hono()

const NO_EXISTE = 'No encontramos esa cuenta de cobro.'

type Fila = typeof cuentasCobro.$inferSelect

const iso = (d: Date | null) => d?.toISOString() ?? null

/** Fecha de hoy en Colombia, AAAA-MM-DD. */
const hoyBogota = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

/** Clave difícil de adivinar para el enlace del cliente. */
function nuevoToken() {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

async function leerCobrador(): Promise<DatosCobrador> {
  const [fila] = await getDb()
    .select({ valor: configuracion.valor })
    .from(configuracion)
    .where(eq(configuracion.clave, CLAVE_CUENTA_COBRO))
  return leerDatosCobrador(fila?.valor)
}

/** Une la foto guardada con su estado actual (anulada, enviada...). */
function aCuenta(f: Fila): CuentaCobro {
  const d = f.datos as CuentaCobro
  return {
    ...d,
    id: f.id,
    estado: f.estado as EstadoCuenta,
    motivoAnulacion: f.motivoAnulacion,
    anuladaEn: iso(f.anuladaEn),
    token: f.token,
    enviadaEn: iso(f.enviadaEn),
    recibidaEn: iso(f.recibidaEn),
    aceptadaEn: iso(f.aceptadaEn),
  }
}

function aResumen(f: Fila, pedidoCodigo: string): CuentaResumen {
  const fechas = {
    enviadaEn: iso(f.enviadaEn),
    recibidaEn: iso(f.recibidaEn),
    aceptadaEn: iso(f.aceptadaEn),
  }
  return {
    id: f.id,
    codigo: f.codigo,
    fecha: f.fecha,
    estado: f.estado as EstadoCuenta,
    total: f.total,
    pagador: f.pagador,
    pedido: { id: f.pedidoId, codigo: pedidoCodigo },
    envio: estadoEnvio(fechas),
    envioEn: fechas.aceptadaEn ?? fechas.recibidaEn ?? fechas.enviadaEn,
  }
}

// ===================== Datos de quien cobra =====================

rutasCuentasCobro.get('/datos', async (c) => {
  const datos = await leerCobrador()
  return c.json({ datos, falta: faltaEnCobrador(datos) })
})

rutasCuentasCobro.put('/datos', async (c) => {
  const v = validarDatosCobrador(await c.req.json().catch(() => ({})))
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const fila = {
    clave: CLAVE_CUENTA_COBRO,
    valor: v.datos,
    actualizadoEn: new Date(),
    actualizadoPor: c.get('usuario').id,
  }
  await getDb()
    .insert(configuracion)
    .values(fila)
    .onConflictDoUpdate({
      target: configuracion.clave,
      set: { valor: fila.valor, actualizadoEn: fila.actualizadoEn, actualizadoPor: fila.actualizadoPor },
    })
  return c.json({ datos: v.datos, falta: faltaEnCobrador(v.datos) })
})

// ===================== Lista =====================

rutasCuentasCobro.get('/', async (c) => {
  const filas = await getDb()
    .select({ f: cuentasCobro, pedido: pedidos.codigo })
    .from(cuentasCobro)
    .innerJoin(pedidos, eq(pedidos.id, cuentasCobro.pedidoId))
    .orderBy(desc(cuentasCobro.numero))
    .limit(500)
  return c.json({ cuentas: filas.map((x) => aResumen(x.f, x.pedido)) })
})

// ===================== Del pedido =====================

async function cargarPedido(id: number) {
  const [p] = await getDb()
    .select()
    .from(pedidos)
    .where(and(eq(pedidos.id, id), isNull(pedidos.borradoEn)))
  return p ?? null
}

async function delPedido(pedidoId: number): Promise<CuentasDelPedido | null> {
  const db = getDb()
  const p = await cargarPedido(pedidoId)
  if (!p) return null
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, p.clienteId))
  const filas = await db
    .select()
    .from(cuentasCobro)
    .where(eq(cuentasCobro.pedidoId, pedidoId))
    .orderBy(desc(cuentasCobro.numero))
  const vigente = filas.find((f) => f.estado === 'vigente')
  const falta = faltaEnCobrador(await leerCobrador())
  let bloqueo: string | null = null
  if (p.estado === 'cancelado') bloqueo = 'El pedido está cancelado: no se le hace cuenta de cobro.'
  else if (p.total <= 0) bloqueo = 'El pedido no tiene valor para cobrar.'
  else if (falta.length)
    bloqueo = `Antes, llena tus datos en Configuración → Cuenta de cobro. Falta ${falta.join(', ')}.`

  // Documento del cliente: si parece NIT (9 dígitos y DV) se sugiere NIT
  const doc = cliente?.documento ?? ''
  const pareceNit = /^\d{3}\.?\d{3}\.?\d{3}-?\d?$/.test(doc.trim()) && doc.replace(/\D/g, '').length >= 9
  return {
    vigente: vigente ? aCuenta(vigente) : null,
    anuladas: filas.filter((f) => f.estado === 'anulada').map((f) => aResumen(f, p.codigo)),
    bloqueo,
    sugerencia: {
      pagador: {
        nombre: cliente?.nombre ?? '',
        tipoDocumento: !doc || pareceNit ? 'NIT' : 'CC',
        documento: doc,
        direccion: cliente?.direccion ?? '',
        ciudad: cliente?.ciudad ?? '',
      },
      concepto: conceptoSugerido(p.codigo),
      total: p.total,
    },
  }
}

rutasCuentasCobro.get('/pedido/:pedidoId', async (c) => {
  const r = await delPedido(Number(c.req.param('pedidoId')) || 0)
  if (!r) return c.json({ mensaje: 'No encontramos ese pedido.' }, 404)
  return c.json(r)
})

// ===================== Hacer una =====================

rutasCuentasCobro.post('/', async (c) => {
  const yo = c.get('usuario')
  const cuerpo = await c.req.json().catch(() => ({}))
  const pedidoId = Number(cuerpo.pedidoId) || 0
  const v = validarNuevaCuenta(cuerpo)
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const { pagador, concepto } = v.datos

  const previo = await delPedido(pedidoId)
  if (!previo) return c.json({ mensaje: 'No encontramos ese pedido.' }, 404)
  if (previo.bloqueo) return c.json({ mensaje: previo.bloqueo }, 409)
  if (previo.vigente) {
    return c.json(
      {
        mensaje: `Este pedido ya tiene la cuenta de cobro ${previo.vigente.codigo}. Si algo quedó mal, anúlala y haz otra.`,
      },
      409
    )
  }

  const cobrador = await leerCobrador()
  const db = getDb()
  const r = await db.transaction(async (tx) => {
    // Un número a la vez: el consecutivo nunca se repite ni salta
    await tx.execute(sql`select pg_advisory_xact_lock(7311)`)
    const [p] = await tx.select().from(pedidos).where(eq(pedidos.id, pedidoId))
    const [cliente] = await tx.select().from(clientes).where(eq(clientes.id, p.clienteId))
    const [ultimo] = await tx
      .select({ n: sql<number>`coalesce(max(${cuentasCobro.numero}), 0)::int` })
      .from(cuentasCobro)
    const numero = (ultimo?.n ?? 0) + 1
    const codigo = codigoCuenta(numero)
    const lineas = await tx
      .select()
      .from(pedidoLineas)
      .where(eq(pedidoLineas.pedidoId, p.id))
      .orderBy(asc(pedidoLineas.orden))
    const items: ItemCuenta[] = lineas.map((l) => ({
      descripcion: [
        l.nombre,
        l.color ? `color ${l.color}` : '',
        l.textos.length ? `nombres: ${l.textos.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      cantidad: l.cantidad,
      valorUnitario: l.precioVenta,
      total: l.precioVenta * l.cantidad,
    }))
    const cargos = await tx
      .select({ concepto: pedidoCargos.concepto, valor: pedidoCargos.valor })
      .from(pedidoCargos)
      .where(eq(pedidoCargos.pedidoId, p.id))
      .orderBy(asc(pedidoCargos.id))
    const abonado = Math.max(0, await totalPagado(tx, p.id))
    const ahora = new Date()
    const datos: Omit<CuentaCobro, 'id' | 'token' | 'enviadaEn' | 'recibidaEn' | 'aceptadaEn'> = {
      codigo,
      numero,
      fecha: hoyBogota(),
      estado: 'vigente',
      motivoAnulacion: '',
      anuladaEn: null,
      pedido: { id: p.id, codigo: p.codigo },
      cobrador: {
        nombre: cobrador.nombre,
        tipoDocumento: cobrador.tipoDocumento,
        documento: cobrador.documento,
        direccion: cobrador.direccion,
        ciudad: cobrador.ciudad,
        telefono: cobrador.telefono,
        email: cobrador.email,
      },
      pagador,
      concepto,
      items,
      cargos,
      descuento: p.descuento,
      total: p.total,
      valorEnLetras: enLetras(p.total),
      abonado: Math.min(abonado, p.total),
      declaracion: cobrador.declaracion,
      datosPago: cobrador.datosPago,
      firma: cobrador.firma,
      creadoPor: yo.nombre,
      creadoEn: ahora.toISOString(),
    }
    const [fila] = await tx
      .insert(cuentasCobro)
      .values({
        numero,
        codigo,
        pedidoId: p.id,
        clienteId: p.clienteId,
        fecha: datos.fecha,
        total: p.total,
        pagador: pagador.nombre,
        datos,
        token: nuevoToken(),
        creadoPor: yo.id,
        creadoEn: ahora,
      })
      .returning()
    // Lo que faltaba en la ficha del cliente queda guardado para la próxima
    if (cliente) {
      const cambios: Partial<typeof clientes.$inferInsert> = {}
      if (!cliente.documento.trim()) cambios.documento = pagador.documento
      if (!cliente.direccion.trim() && pagador.direccion) cambios.direccion = pagador.direccion
      if (!cliente.ciudad.trim() && pagador.ciudad) cambios.ciudad = pagador.ciudad
      if (Object.keys(cambios).length) {
        await tx
          .update(clientes)
          .set({ ...cambios, actualizadoEn: ahora })
          .where(eq(clientes.id, cliente.id))
      }
    }
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota: `Cuenta de cobro ${codigo} hecha a nombre de ${pagador.nombre.replace(/\.+$/, '')}.`,
      usuarioId: yo.id,
    })
    return fila
  })
  return c.json({ cuenta: aCuenta(r) }, 201)
})

// ===================== Una =====================

async function cargarCuenta(id: number) {
  const [f] = await getDb().select().from(cuentasCobro).where(eq(cuentasCobro.id, id))
  return f ?? null
}

rutasCuentasCobro.get('/:id', async (c) => {
  const f = await cargarCuenta(Number(c.req.param('id')) || 0)
  if (!f) return c.json({ mensaje: NO_EXISTE }, 404)
  const [cliente] = await getDb()
    .select({ whatsapp: clientes.whatsapp })
    .from(clientes)
    .where(eq(clientes.id, f.clienteId))
  return c.json({ cuenta: aCuenta(f), whatsapp: cliente?.whatsapp ?? '' })
})

/** Se mandó por WhatsApp o se copió el enlace. */
rutasCuentasCobro.post('/:id/enviada', async (c) => {
  const f = await cargarCuenta(Number(c.req.param('id')) || 0)
  if (!f) return c.json({ mensaje: NO_EXISTE }, 404)
  if (f.estado === 'anulada') {
    return c.json({ mensaje: 'Esta cuenta de cobro está anulada: no se puede enviar.' }, 409)
  }
  const [fila] = await getDb()
    .update(cuentasCobro)
    .set({ enviadaEn: f.enviadaEn ?? new Date() })
    .where(eq(cuentasCobro.id, f.id))
    .returning()
  return c.json({ cuenta: aCuenta(fila) })
})

rutasCuentasCobro.post('/:id/anular', async (c) => {
  const yo = c.get('usuario')
  const f = await cargarCuenta(Number(c.req.param('id')) || 0)
  if (!f) return c.json({ mensaje: NO_EXISTE }, 404)
  if (f.estado === 'anulada') return c.json({ mensaje: 'Esta cuenta de cobro ya estaba anulada.' }, 409)
  const cuerpo = await c.req.json().catch(() => ({}))
  const v = validarMotivoAnulacion(cuerpo.motivo)
  if (!v.ok) return c.json({ mensaje: v.mensaje, campo: v.campo }, 400)
  const fila = await getDb().transaction(async (tx) => {
    const [x] = await tx
      .update(cuentasCobro)
      .set({ estado: 'anulada', motivoAnulacion: v.datos, anuladaEn: new Date(), anuladaPor: yo.id })
      .where(eq(cuentasCobro.id, f.id))
      .returning()
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: f.pedidoId,
      nota: `Cuenta de cobro ${f.codigo} anulada: ${v.datos.replace(/\.+$/, '')}.`,
      usuarioId: yo.id,
    })
    return x
  })
  return c.json({ cuenta: aCuenta(fila) })
})

// ===================== Enlace del cliente (público) =====================

const TOKEN = /^[A-Za-z0-9_-]{12,40}$/

// Freno sencillo para que nadie pruebe enlaces al azar (por instancia del servidor)
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

const ENLACE_MALO =
  'Este enlace no es válido. Revisa que lo hayas copiado completo o pídele uno nuevo a Hecho en Capas.'

/** Si quien abre es alguien del equipo con sesión, no cuenta como "recibida". */
async function esDelEquipo(cookie: string | undefined) {
  return (await leerSesion(cookie)) !== null
}

async function porToken(token: string) {
  if (!TOKEN.test(token)) return null
  const [f] = await getDb().select().from(cuentasCobro).where(eq(cuentasCobro.token, token))
  return f ?? null
}

function aPublica(f: Fila): CuentaPublica {
  const { id: _id, token: _t, enviadaEn: _e, recibidaEn: _r, aceptadaEn: _a, creadoPor: _c, pedido, ...resto } =
    aCuenta(f)
  return { ...resto, pedido: { codigo: pedido.codigo } }
}

rutasCuentaPublica.get('/:token', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (demasiados(ip)) {
    return c.json({ mensaje: 'Demasiadas consultas seguidas. Espera un minuto e intenta de nuevo.' }, 429)
  }
  const f = await porToken(c.req.param('token'))
  if (!f) return c.json({ mensaje: ENLACE_MALO }, 404)
  if (f.estado === 'anulada') {
    return c.json({ anulada: true, codigo: f.codigo })
  }
  if (!f.recibidaEn && !(await esDelEquipo(getCookie(c, COOKIE_SESION)))) {
    const ahora = new Date()
    await getDb()
      .update(cuentasCobro)
      .set({ recibidaEn: ahora, enviadaEn: f.enviadaEn ?? ahora })
      .where(eq(cuentasCobro.id, f.id))
  }
  return c.json({ anulada: false, cuenta: aPublica(f) })
})

/** El cliente la descargó: queda aceptada. */
rutasCuentaPublica.post('/:token/descarga', async (c) => {
  const f = await porToken(c.req.param('token'))
  if (!f) return c.json({ mensaje: ENLACE_MALO }, 404)
  if (f.estado === 'anulada') {
    return c.json({ mensaje: 'Esta cuenta de cobro fue anulada; pídele la nueva a Hecho en Capas.' }, 409)
  }
  if (!f.aceptadaEn && !(await esDelEquipo(getCookie(c, COOKIE_SESION)))) {
    const ahora = new Date()
    await getDb()
      .update(cuentasCobro)
      .set({
        aceptadaEn: ahora,
        recibidaEn: f.recibidaEn ?? ahora,
        enviadaEn: f.enviadaEn ?? ahora,
      })
      .where(eq(cuentasCobro.id, f.id))
  }
  return c.json({ ok: true })
})
