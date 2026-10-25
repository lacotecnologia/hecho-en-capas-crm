import { and, asc, desc, eq, inArray, isNotNull, isNull, sql, max } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import { type Modalidad, codigoCotizacion } from '../../shared/cotizacion.js'
import {
  firmarSesionCliente,
  leerSesionCliente,
  verificarCredencialGoogle,
} from '../auth.js'
import { anioBogota, armar, columnasResumen, guardarHijos } from '../cotizaciones-logica.js'
import { getDb } from '../db/index.js'
import {
  clientes,
  cotizacionLineas,
  cotizaciones,
  pedidos,
  productoArchivos,
  productos,
  usuarios,
} from '../db/schema.js'
import { coloresDe } from '../stock.js'
import { leerConfiguracion, leerTextos } from './configuracion.js'

/**
 * API pública de la tienda en línea (sitio aparte, en otro subdominio).
 *  - Productos: sin sesión.
 *  - Clientes: entran con Google y reciben un token propio (no sirve para el CRM).
 *  - Un pedido de la tienda nace como cotización "enviada" que el equipo confirma.
 */
export const rutasTienda = new Hono()

// Solo los sitios de la tienda autorizados pueden llamar esta API desde un navegador.
const origenesPermitidos = () =>
  (process.env.TIENDA_ORIGENES ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)

rutasTienda.use(
  '*',
  cors({
    origin: (origen) => (origenesPermitidos().includes(origen) ? origen : null),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    maxAge: 600,
  })
)

// Freno sencillo contra abusos (por instancia del servidor).
const intentos = new Map<string, { n: number; desde: number }>()
function demasiados(clave: string, maximo: number, ventanaMs = 60_000) {
  const ahora = Date.now()
  const r = intentos.get(clave)
  if (!r || ahora - r.desde > ventanaMs) {
    intentos.set(clave, { n: 1, desde: ahora })
    return false
  }
  r.n++
  return r.n > maximo
}
const ipDe = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
const MUCHAS = 'Demasiados intentos seguidos. Espera un minuto e intenta de nuevo.'

const textoLimpio = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)

const columnasPerfil = {
  id: clientes.id,
  nombre: clientes.nombre,
  email: clientes.email,
  whatsapp: clientes.whatsapp,
  ciudad: clientes.ciudad,
  direccion: clientes.direccion,
  borradoEn: clientes.borradoEn,
}
const perfil = (f: { nombre: string; email: string; whatsapp: string; ciudad: string; direccion: string }) => ({
  nombre: f.nombre,
  email: f.email,
  whatsapp: f.whatsapp,
  ciudad: f.ciudad,
  direccion: f.direccion,
})

/** Cliente de la sesión (token en el encabezado Authorization). */
async function clienteDeSesion(c: Context) {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '')
  const id = await leerSesionCliente(token)
  if (!id) return null
  const [f] = await getDb().select(columnasPerfil).from(clientes).where(eq(clientes.id, id)).limit(1)
  return f && !f.borradoEn ? f : null
}
const SESION_TERMINO = 'Tu sesión terminó. Entra de nuevo con Google.'

// ===================== Productos =====================

rutasTienda.get('/productos', async (c) => {
  const db = getDb()
  const filas = await db
    .select()
    .from(productos)
    .where(
      and(
        isNull(productos.borradoEn),
        eq(productos.estado, 'activo'),
        eq(productos.enTienda, true),
        isNotNull(productos.precioTienda),
        sql`${productos.precioTienda} >= ${productos.precioFabrica}`
      )
    )
    .orderBy(asc(productos.nombre))
  const ids = filas.map((p) => p.id)
  const fotos = ids.length
    ? await db
        .select({ productoId: productoArchivos.productoId, url: productoArchivos.url })
        .from(productoArchivos)
        .where(and(inArray(productoArchivos.productoId, ids), eq(productoArchivos.tipo, 'imagen')))
        .orderBy(desc(productoArchivos.esPortada), asc(productoArchivos.id))
    : []
  const fotosDe = new Map<number, string[]>()
  for (const f of fotos) fotosDe.set(f.productoId, [...(fotosDe.get(f.productoId) ?? []), f.url])
  const colores = await coloresDe(
    db,
    filas.filter((p) => p.escogeColor).map((p) => p.id)
  )
  const [config, textos] = await Promise.all([leerConfiguracion(), leerTextos()])
  c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  return c.json({
    negocio: { whatsapp: textos.negocio_whatsapp, ciudad: textos.negocio_ciudad },
    anticipoPct: config.anticipo_personalizados,
    productos: filas.map((p) => {
      const cs = (colores.get(p.id) ?? []).filter((x) => x.activa)
      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        categoria: p.categoria,
        personalizado: p.tipo === 'personalizado',
        precio: p.precioTienda!,
        dias: p.diasFabricacion,
        enStock: p.escogeColor ? cs.some((x) => x.stock > 0) : p.stock > 0,
        imagenes: fotosDe.get(p.id) ?? [],
        colores: p.escogeColor
          ? cs.map((x) => ({ bobinaId: x.bobinaId, nombre: x.color, hex: x.colorHex, enStock: x.stock > 0 }))
          : [],
      }
    }),
  })
})

// ===================== Cuenta (Google) =====================

rutasTienda.post('/entrar', async (c) => {
  if (demasiados(`entrar:${ipDe(c)}`, 20)) return c.json({ mensaje: MUCHAS }, 429)
  const cuerpo = await c.req.json().catch(() => ({}))
  const cuenta = await verificarCredencialGoogle(cuerpo.credencial)
  if (!cuenta) {
    return c.json(
      { mensaje: 'No pudimos confirmar tu cuenta de Google. Intenta de nuevo o escríbenos.' },
      401
    )
  }
  const db = getDb()
  // 1) ya entró antes con esta cuenta de Google
  let [cli] = await db.select(columnasPerfil).from(clientes).where(eq(clientes.googleSub, cuenta.sub)).limit(1)
  if (cli?.borradoEn) {
    return c.json({ mensaje: 'Tu cuenta no está disponible. Escríbenos y la revisamos.' }, 403)
  }
  // 2) ya existe como cliente del CRM con ese mismo correo: se enlaza
  if (!cli) {
    const [igual] = await db
      .select(columnasPerfil)
      .from(clientes)
      .where(
        and(
          isNull(clientes.borradoEn),
          isNull(clientes.googleSub),
          sql`lower(${clientes.email}) = ${cuenta.email}`
        )
      )
      .limit(1)
    if (igual) {
      await db
        .update(clientes)
        .set({ googleSub: cuenta.sub, aceptoDatosEn: cuerpo.aceptaDatos === true ? new Date() : undefined, actualizadoEn: new Date() })
        .where(eq(clientes.id, igual.id))
      cli = igual
    }
  }
  // 3) persona nueva: entra como prospecto (necesita aceptar el tratamiento de datos)
  if (!cli) {
    if (cuerpo.aceptaDatos !== true) {
      return c.json(
        {
          codigo: 'aceptar_datos',
          mensaje: 'Para crear tu cuenta necesitamos que aceptes el tratamiento de tus datos personales.',
        },
        409
      )
    }
    const [nuevo] = await db
      .insert(clientes)
      .values({
        nombre: cuenta.nombre,
        email: cuenta.email,
        etapa: 'prospecto',
        origen: 'tienda',
        googleSub: cuenta.sub,
        aceptoDatosEn: new Date(),
      })
      .returning(columnasPerfil)
    cli = nuevo
  }
  return c.json({ token: await firmarSesionCliente(cli.id), perfil: perfil(cli) })
})

rutasTienda.get('/yo', async (c) => {
  const cli = await clienteDeSesion(c)
  if (!cli) return c.json({ mensaje: SESION_TERMINO }, 401)
  return c.json({ perfil: perfil(cli) })
})

// ===================== Pedidos =====================

const MODALIDADES: Modalidad[] = ['recoge', 'local', 'nacional']

/** Quién recibe los pedidos de la tienda: quien tenga "Atiende la tienda"; si nadie, el primer administrador. */
async function comercialDeTienda() {
  const db = getDb()
  const [asignado] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.activo, true), eq(usuarios.atiendeTienda, true)))
    .orderBy(asc(usuarios.id))
    .limit(1)
  if (asignado) return asignado.id
  const [admin] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(eq(usuarios.activo, true), sql`'admin' = any(${usuarios.roles})`))
    .orderBy(asc(usuarios.id))
    .limit(1)
  return admin?.id ?? null
}

rutasTienda.post('/pedidos', async (c) => {
  const cli = await clienteDeSesion(c)
  if (!cli) return c.json({ mensaje: SESION_TERMINO }, 401)
  if (demasiados(`pedido:${cli.id}`, 6, 3_600_000)) {
    return c.json({ mensaje: 'Hiciste varios pedidos seguidos. Espera un rato o escríbenos por WhatsApp.' }, 429)
  }
  const e = await c.req.json().catch(() => ({}))
  const modalidad = e.modalidad as Modalidad
  if (!MODALIDADES.includes(modalidad)) {
    return c.json({ mensaje: 'Escoge cómo quieres recibir tu pedido.', campo: 'modalidad' }, 400)
  }
  const whatsapp = textoLimpio(e.whatsapp, 30)
  if (!/^[+\d\s()-]{7,30}$/.test(whatsapp)) {
    return c.json({ mensaje: 'Escribe tu celular solo con números. Ejemplo: 300 123 4567', campo: 'whatsapp' }, 400)
  }
  const ciudad = textoLimpio(e.ciudad, 60)
  if (ciudad.length < 2) return c.json({ mensaje: 'Escribe tu ciudad.', campo: 'ciudad' }, 400)
  const direccion = textoLimpio(e.direccion, 200)
  if (modalidad !== 'recoge' && direccion.length < 5) {
    return c.json({ mensaje: 'Escribe la dirección donde te lo llevamos.', campo: 'direccion' }, 400)
  }
  const notas = textoLimpio(e.notas, 600)

  if (!Array.isArray(e.lineas) || e.lineas.length === 0 || e.lineas.length > 30) {
    return c.json({ mensaje: 'Tu carrito está vacío.', campo: 'lineas' }, 400)
  }
  const lineas: { productoId: number; cantidad: number; precioVenta: number; bobinaId: number | null }[] = []
  for (const l of e.lineas) {
    const productoId = Number(l?.productoId)
    const cantidad = Number(l?.cantidad)
    const bobinaId = l?.bobinaId == null ? null : Number(l.bobinaId)
    if (!Number.isInteger(productoId) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 50) {
      return c.json({ mensaje: 'Revisa las cantidades de tu carrito (entre 1 y 50).', campo: 'lineas' }, 400)
    }
    if (bobinaId !== null && !Number.isInteger(bobinaId)) {
      return c.json({ mensaje: 'Revisa el color de tus productos.', campo: 'lineas' }, 400)
    }
    lineas.push({ productoId, cantidad, precioVenta: 0, bobinaId })
  }

  const r = await armar(
    { clienteId: cli.id, modalidad, lineas, cargos: [], descuento: 0, notas },
    { precioTienda: true }
  )
  if (!r.ok) return c.json({ mensaje: r.mensaje, campo: r.campo }, 400)
  if (r.lineas.some((l) => l.personalizado) && notas.length < 3) {
    return c.json(
      { mensaje: 'Cuéntanos en “Algo más” qué nombre, texto o logo quieres en tu producto.', campo: 'notas' },
      400
    )
  }
  const comercialId = await comercialDeTienda()
  if (!comercialId) {
    return c.json({ mensaje: 'Ahora mismo no podemos recibir pedidos. Escríbenos por WhatsApp.' }, 503)
  }

  const db = getDb()
  const anio = anioBogota()
  const ahora = new Date()
  const vence = new Date(ahora.getTime() + r.config.vigencia_cotizacion_dias * 86_400_000)
  const cot = await db.transaction(async (tx) => {
    await tx
      .update(clientes)
      .set({ whatsapp, ciudad, direccion: modalidad === 'recoge' ? cli.direccion : direccion, actualizadoEn: ahora })
      .where(eq(clientes.id, cli.id))
    await tx.execute(sql`select pg_advisory_xact_lock(${anio})`)
    const [fila] = await tx
      .select({ ultimo: max(cotizaciones.numero) })
      .from(cotizaciones)
      .where(eq(cotizaciones.anio, anio))
    const numero = (fila?.ultimo ?? 0) + 1
    const [nueva] = await tx
      .insert(cotizaciones)
      .values({
        anio,
        numero,
        version: 1,
        codigo: codigoCotizacion(anio, numero, 1),
        estado: 'enviada',
        origen: 'tienda',
        clienteId: cli.id,
        comercialId,
        modalidad,
        descuento: 0,
        notas,
        enviadaEn: ahora,
        venceEn: vence,
        ...columnasResumen(r),
      })
      .returning({ id: cotizaciones.id, codigo: cotizaciones.codigo })
    await guardarHijos(tx, nueva.id, r.lineas, [])
    return nueva
  })
  const textos = await leerTextos()
  return c.json(
    {
      pedido: {
        codigo: cot.codigo,
        total: r.resumen.total,
        anticipo: r.resumen.anticipo,
        anticipoPct: r.resumen.anticipoPct,
        diasFabricacion: r.resumen.diasFabricacion,
        diasEnvio: r.resumen.diasEnvio,
        venceEn: vence.toISOString(),
      },
      datosPago: textos.datos_pago,
      whatsapp: textos.negocio_whatsapp,
    },
    201
  )
})

rutasTienda.get('/pedidos', async (c) => {
  const cli = await clienteDeSesion(c)
  if (!cli) return c.json({ mensaje: SESION_TERMINO }, 401)
  const db = getDb()
  const cots = await db
    .select({
      id: cotizaciones.id,
      codigo: cotizaciones.codigo,
      estado: cotizaciones.estado,
      total: cotizaciones.total,
      anticipo: cotizaciones.anticipo,
      creadoEn: cotizaciones.creadoEn,
      pedidoEstado: pedidos.estado,
      seguimiento: pedidos.seguimiento,
    })
    .from(cotizaciones)
    .leftJoin(pedidos, eq(pedidos.cotizacionId, cotizaciones.id))
    .where(
      and(
        eq(cotizaciones.clienteId, cli.id),
        eq(cotizaciones.origen, 'tienda'),
        isNull(cotizaciones.borradoEn),
      )
    )
    .orderBy(desc(cotizaciones.creadoEn))
    .limit(20)
  const ids = cots.map((x) => x.id)
  const lineas = ids.length
    ? await db
        .select({
          cotizacionId: cotizacionLineas.cotizacionId,
          nombre: cotizacionLineas.nombre,
          cantidad: cotizacionLineas.cantidad,
          color: cotizacionLineas.color,
        })
        .from(cotizacionLineas)
        .where(inArray(cotizacionLineas.cotizacionId, ids))
        .orderBy(asc(cotizacionLineas.orden))
    : []
  return c.json({
    pedidos: cots.map((x) => ({
      codigo: x.codigo,
      estado: x.pedidoEstado ?? x.estado,
      esPedido: !!x.pedidoEstado,
      seguimiento: x.seguimiento,
      total: x.total,
      anticipo: x.anticipo,
      creadoEn: x.creadoEn,
      productos: lineas
        .filter((l) => l.cotizacionId === x.id)
        .map((l) => ({ nombre: l.nombre, cantidad: l.cantidad, color: l.color })),
    })),
  })
})
