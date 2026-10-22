import { and, arrayContains, asc, eq, inArray, sql } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import {
  type EntregaLista,
  puedeSalir,
  validarEntregada,
  validarNovedad,
  validarProgramacion,
} from '../../shared/entregas.js'
import { type EstadoPedido, tipoDePago } from '../../shared/pedidos.js'
import { getDb } from '../db/index.js'
import { clientes, entregas, pagos, pedidos, usuarios } from '../db/schema.js'
import {
  anotar,
  crearEntrega,
  entregaPublica,
  recalcularPedido,
  totalPagado,
  type Tx,
} from '../pedidos-logica.js'
import { conSesion, soloRoles, type UsuarioSesion, type Variables } from '../sesion.js'
import { permisoDeSubida, SOLO_IMAGENES, urlDeBlobValida } from '../subidas.js'

export const rutasEntregas = new Hono<{ Variables: Variables }>()

rutasEntregas.use('*', conSesion)

const ve = soloRoles('admin', 'comercial', 'entregas')
const vende = soloRoles('admin', 'comercial')

const LISTOS: EstadoPedido[] = ['listo', 'en_entrega', 'entregado', 'cerrado']
const NO_EXISTE = 'No encontramos esa entrega.'

const tiene = (u: UsuarioSesion, ...r: UsuarioSesion['roles']) => u.roles.some((x) => r.includes(x))

const fechaCorta = (d: Date) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)

/** Admin y entregas ven todas; el comercial, las de sus pedidos. */
function puedeVer(u: UsuarioSesion, p: { comercialId: number }) {
  return tiene(u, 'admin', 'entregas') || p.comercialId === u.id
}
function puedeProgramar(u: UsuarioSesion, p: { comercialId: number }) {
  return tiene(u, 'admin') || (u.roles.includes('comercial') && p.comercialId === u.id)
}

rutasEntregas.get('/', ve, async (c) => {
  const u = c.get('usuario')
  const db = getDb()
  // Los pedidos listos que aún no tienen su entrega (los de antes de esta fase)
  const sinEntrega = await db
    .select({ id: pedidos.id })
    .from(pedidos)
    .where(
      and(
        inArray(pedidos.estado, LISTOS),
        sql`not exists (select 1 from entregas e where e.pedido_id = ${pedidos.id})`
      )
    )
  if (sinEntrega.length) {
    await db.transaction(async (tx) => {
      for (const p of sinEntrega) await crearEntrega(tx, p.id)
    })
  }
  const hace30 = new Date(Date.now() - 30 * 86_400_000)
  const filas = await db
    .select({
      e: entregas,
      mensajero: usuarios.nombre,
      p: pedidos,
      cliente: clientes.nombre,
      whatsapp: clientes.whatsapp,
      pagado: sql<number>`(select coalesce(sum(monto), 0)::int from pagos where pagos.pedido_id = ${pedidos.id})`,
    })
    .from(entregas)
    .innerJoin(pedidos, eq(pedidos.id, entregas.pedidoId))
    .innerJoin(clientes, eq(clientes.id, pedidos.clienteId))
    .leftJoin(usuarios, eq(usuarios.id, entregas.mensajeroId))
    .where(
      and(
        inArray(pedidos.estado, LISTOS),
        sql`(${entregas.estado} <> 'entregada' or ${entregas.entregadaEn} >= ${hace30})`
      )
    )
    .orderBy(sql`${entregas.fechaProgramada} asc nulls first`, asc(entregas.id))
  const lista: EntregaLista[] = filas
    .filter(({ p }) => puedeVer(u, p))
    .map(({ e, mensajero, p, cliente, whatsapp, pagado }) => ({
      ...entregaPublica(e, mensajero),
      pedido: {
        id: p.id,
        codigo: p.codigo,
        cliente,
        whatsapp,
        listo: LISTOS.includes(p.estado as EstadoPedido),
        saldo: p.total - pagado,
        cancelado: p.estado === 'cancelado',
      },
    }))
  return c.json({ entregas: lista })
})

/** Personas con rol de Entregas, para elegir el mensajero. */
rutasEntregas.get('/mensajeros', vende, async (c) => {
  const lista = await getDb()
    .select({ id: usuarios.id, nombre: usuarios.nombre })
    .from(usuarios)
    .where(and(arrayContains(usuarios.roles, ['entregas']), eq(usuarios.activo, true)))
    .orderBy(asc(usuarios.nombre))
  return c.json({ mensajeros: lista })
})

type Fila = { e: typeof entregas.$inferSelect; p: typeof pedidos.$inferSelect }

/** Carga la entrega con su pedido, con bloqueo, y aplica el cambio. */
async function cambiar(
  c: Context<{ Variables: Variables }>,
  permiso: (u: UsuarioSesion, f: Fila) => string | null,
  hacer: (tx: Tx, f: Fila, cuerpo: Record<string, unknown>, u: UsuarioSesion) => Promise<string | null>
) {
  const u = c.get('usuario')
  const id = Number(c.req.param('id')) || 0
  const cuerpo = await c.req.json().catch(() => ({}))
  const db = getDb()
  const r = await db.transaction(async (tx) => {
    const [f] = await tx
      .select({ e: entregas, p: pedidos })
      .from(entregas)
      .innerJoin(pedidos, eq(pedidos.id, entregas.pedidoId))
      .where(eq(entregas.id, id))
      .for('update')
    if (!f || !puedeVer(u, f.p)) return { error: NO_EXISTE, status: 404 as const }
    const no = permiso(u, f)
    if (no) return { error: no, status: 403 as const }
    if (f.p.estado === 'cancelado') {
      return { error: 'El pedido se canceló: ya no se entrega.', status: 400 as const }
    }
    const error = await hacer(tx, f, cuerpo, u)
    if (error) {
      const [mensaje, campo] = error.split('|')
      return { error: mensaje, campo, status: 400 as const }
    }
    await recalcularPedido(tx, f.p.id, u.id)
    return { ok: true as const }
  })
  if ('error' in r) {
    return c.json({ mensaje: r.error, campo: 'campo' in r ? r.campo : undefined }, r.status)
  }
  const [f] = await db
    .select({ e: entregas, mensajero: usuarios.nombre })
    .from(entregas)
    .leftJoin(usuarios, eq(usuarios.id, entregas.mensajeroId))
    .where(eq(entregas.id, id))
  return c.json({ entrega: entregaPublica(f.e, f.mensajero) })
}

const soloQuienVende = (u: UsuarioSesion, f: Fila) =>
  puedeProgramar(u, f.p) ? null : 'Solo el comercial del pedido o el administrador programan la entrega.'
const cualquieraDeEntrega = () => null

/** Programar (o reprogramar) la entrega. */
rutasEntregas.post('/:id/programar', vende, (c) =>
  cambiar(c, soloQuienVende, async (tx, { e, p }, cuerpo, u) => {
    if (!['listo', 'en_entrega'].includes(p.estado)) {
      return 'La entrega se programa cuando el pedido esté listo en el taller.'
    }
    if (!['por_programar', 'programada'].includes(e.estado)) {
      return e.estado === 'entregada'
        ? 'Esta entrega ya se hizo.'
        : 'Ya salió: si hubo un problema, usa “Hubo una novedad”.'
    }
    const mensajeros = await tx
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(and(arrayContains(usuarios.roles, ['entregas']), eq(usuarios.activo, true)))
    const saldo = p.total - (await totalPagado(tx, p.id))
    const v = validarProgramacion(cuerpo, e.modalidad as never, saldo, mensajeros.map((m) => m.id))
    if (!v.ok) return `${v.mensaje}|${v.campo ?? ''}`
    const d = v.datos
    await tx
      .update(entregas)
      .set({
        estado: 'programada',
        fechaProgramada: new Date(d.fechaProgramada),
        franja: d.franja,
        direccion: d.direccion,
        ciudad: d.ciudad,
        recibe: d.recibe,
        telefono: d.telefono,
        quienLleva: d.quienLleva,
        mensajeroId: d.mensajeroId,
        servicioTercero: d.servicioTercero,
        transportadora: d.transportadora,
        guia: d.guia,
        costoReal: d.costoReal,
        contraentrega: d.contraentrega,
        montoContraentrega: d.montoContraentrega,
        notas: d.notas,
        novedad: '',
        actualizadoEn: new Date(),
      })
      .where(eq(entregas.id, e.id))
    const cuando = `${fechaCorta(new Date(d.fechaProgramada))}${d.franja ? ` (${d.franja.toLowerCase()})` : ''}`
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota:
        e.modalidad === 'recoge'
          ? `Listo para recoger el ${cuando}.`
          : e.modalidad === 'nacional'
            ? `Se despacha por ${d.transportadora} el ${cuando}.`
            : `Entrega programada para el ${cuando}.`,
      visibleCliente: true,
      usuarioId: u.id,
    })
    return null
  })
)

/** El mensajero sale / se despacha por transportadora. */
rutasEntregas.post('/:id/salir', ve, (c) =>
  cambiar(c, cualquieraDeEntrega, async (tx, { e, p }, cuerpo, u) => {
    if (e.modalidad === 'recoge') return 'En “recoge en el taller” no hay salida: marca directamente que la recogió.'
    if (e.estado !== 'programada') {
      return e.estado === 'por_programar' ? 'Primero programa la entrega.' : 'Esta entrega ya salió.'
    }
    const saldo = p.total - (await totalPagado(tx, p.id))
    const v = puedeSalir({ listo: true, saldo, contraentrega: e.contraentrega, montoContraentrega: e.montoContraentrega })
    if (!v.ok) return v.mensaje
    const guia = String(cuerpo.guia ?? e.guia).trim().slice(0, 60)
    if (e.modalidad === 'nacional' && !guia) return 'Escribe el número de guía de la transportadora.|guia'
    const costo = cuerpo.costoReal === '' || cuerpo.costoReal == null ? e.costoReal : Math.round(Number(cuerpo.costoReal))
    if (costo !== null && (!Number.isFinite(costo) || costo < 0)) return 'Escribe cuánto costó el envío.|costoReal'
    await tx
      .update(entregas)
      .set({ estado: 'en_camino', guia, costoReal: costo, salioEn: new Date(), actualizadoEn: new Date() })
      .where(eq(entregas.id, e.id))
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota:
        e.modalidad === 'nacional'
          ? `Despachado por ${e.transportadora}. Guía ${guia}.`
          : 'Salió a entregar.',
      visibleCliente: true,
      usuarioId: u.id,
    })
    return null
  })
)

/** Se entregó: quién recibió, foto y, si es contra entrega, el pago. */
rutasEntregas.post('/:id/entregada', ve, (c) =>
  cambiar(c, cualquieraDeEntrega, async (tx, { e, p }, cuerpo, u) => {
    if (!['programada', 'en_camino'].includes(e.estado)) {
      return e.estado === 'entregada' ? 'Esta entrega ya estaba marcada.' : 'Primero programa la entrega.'
    }
    const pagadoAntes = await totalPagado(tx, p.id)
    const saldo = p.total - pagadoAntes
    const s = puedeSalir({ listo: true, saldo, contraentrega: e.contraentrega, montoContraentrega: e.montoContraentrega })
    if (!s.ok) return s.mensaje
    const v = validarEntregada(cuerpo, e, saldo)
    if (!v.ok) return `${v.mensaje}|${v.campo ?? ''}`
    if (v.datos.evidenciaUrl && !urlDeBlobValida(v.datos.evidenciaUrl)) {
      return 'La foto no se subió bien. Intenta de nuevo.|evidenciaUrl'
    }
    if (v.datos.montoCobrado > 0 && v.datos.metodo) {
      await tx.insert(pagos).values({
        pedidoId: p.id,
        tipo: tipoDePago({ ...p, pagadoAntes, monto: v.datos.montoCobrado }),
        metodo: v.datos.metodo,
        monto: v.datos.montoCobrado,
        referencia: 'Cobrado al entregar',
        usuarioId: u.id,
      })
      await anotar(tx, {
        entidad: 'pedido',
        entidadId: p.id,
        nota: `Pago registrado al entregar: $ ${v.datos.montoCobrado.toLocaleString('es-CO')}`,
        usuarioId: u.id,
      })
    }
    await tx
      .update(entregas)
      .set({
        estado: 'entregada',
        recibidoPor: v.datos.recibidoPor,
        evidenciaUrl: v.datos.evidenciaUrl,
        entregadaEn: new Date(),
        novedad: '',
        actualizadoEn: new Date(),
      })
      .where(eq(entregas.id, e.id))
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota: `Entregado. Recibió: ${v.datos.recibidoPor}.`,
      visibleCliente: true,
      usuarioId: u.id,
    })
    return null
  })
)

/** No se pudo entregar: vuelve a quedar programada para otro intento. */
rutasEntregas.post('/:id/novedad', ve, (c) =>
  cambiar(c, cualquieraDeEntrega, async (tx, { e, p }, cuerpo, u) => {
    if (!['programada', 'en_camino'].includes(e.estado)) return 'Esta entrega no está en curso.'
    const v = validarNovedad(cuerpo)
    if (!v.ok) return `${v.mensaje}|${v.campo ?? ''}`
    await tx
      .update(entregas)
      .set({ estado: 'programada', novedad: v.motivo, actualizadoEn: new Date() })
      .where(eq(entregas.id, e.id))
    await anotar(tx, {
      entidad: 'pedido',
      entidadId: p.id,
      nota: `Novedad en la entrega: ${v.motivo}. Hay que volver a programarla.`,
      visibleCliente: true,
      usuarioId: u.id,
    })
    return null
  })
)

rutasEntregas.post('/subida', ve, (c) => permisoDeSubida(c, SOLO_IMAGENES))
