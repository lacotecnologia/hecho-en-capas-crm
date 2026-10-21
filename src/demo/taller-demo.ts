/**
 * Taller en la versión de prueba: imita /api/taller/* en el navegador,
 * con las mismas validaciones y el mismo cálculo de costos del servidor.
 */
import { type ValoresConfig } from '@shared/configuracion'
import { calcularCosto } from '@shared/costos'
import { type Rol } from '@shared/roles'
import {
  type ArchivoProducto,
  type Bobina,
  type Impresora,
  type ProductoCosto,
  type ProductoDetalle,
  type ProductoEntrada,
  type ProductoResumen,
  skuDe,
  validarBobina,
  validarImpresora,
  validarPrecio,
  validarProducto,
} from '@shared/taller'
import { ApiError } from '@/lib/api'

export type ProductoDemo = Omit<ProductoResumen, 'portada' | 'sku'> &
  ProductoCosto & { sku: string }
export type ArchivoDemo = ArchivoProducto & { productoId: number }

export type TallerDemo = {
  impresoras: Impresora[]
  bobinas: Bobina[]
  productos: ProductoDemo[]
  archivos: ArchivoDemo[]
}

const ahora = () => new Date().toISOString()

export function tallerInicial(config: ValoresConfig): TallerDemo {
  const impresoras: Impresora[] = [
    {
      id: 1,
      nombre: 'Bambu Lab A1',
      modelo: 'A1 con AMS lite',
      multicolor: true,
      potenciaW: 95,
      precioCompra: 3_200_000,
      vidaUtilH: 5000,
      activa: true,
    },
    {
      id: 2,
      nombre: 'Anycubic Kobra 2 Neo',
      modelo: 'Kobra 2 Neo',
      multicolor: false,
      potenciaW: null,
      precioCompra: 800_000,
      vidaUtilH: 5000,
      activa: true,
    },
  ]
  const bobinas: Bobina[] = [
    {
      id: 1,
      material: 'PLA',
      color: 'Verde',
      colorHex: '#007a52',
      marca: 'Bambu Lab',
      serial: 'EJEMPLO-01',
      precioRollo: 75_000,
      pesoG: 1000,
      activa: true,
    },
    {
      id: 2,
      material: 'PLA',
      color: 'Amarillo',
      colorHex: '#f9ae12',
      marca: 'Bambu Lab',
      serial: 'EJEMPLO-02',
      precioRollo: 75_000,
      pesoG: 1000,
      activa: true,
    },
    {
      id: 3,
      material: 'PLA Matte',
      color: 'Negro',
      colorHex: '#1c1917',
      marca: 'Fill3D',
      serial: 'EJEMPLO-03',
      precioRollo: 74_900,
      pesoG: 1000,
      activa: true,
    },
  ]
  const t: TallerDemo = { impresoras, bobinas, productos: [], archivos: [] }
  const base = {
    descripcion: '',
    categoria: '',
    tipo: 'catalogo' as const,
    multicolor: false,
    diasFabricacion: 2,
    impresoraId: 1,
    bobinaId: 1,
    gramos: 0,
    horas: 0,
    unidadesPorCama: 1,
    minPreparacion: 5,
    minPostproceso: 5,
    horasDiseno: 0,
    unidadesLote: 1,
    empaque: 300,
    margenPct: 50,
    precioManual: null,
    notaAjuste: '',
  }
  const ejemplos: (Partial<ProductoEntrada> & {
    nombre: string
    estado: ProductoEntrada['estado']
    stock: number
  })[] = [
    {
      nombre: 'Llavero con logo en 3 colores',
      descripcion:
        'Llavero de 5 cm con relieve y borde, en los colores de la marca del cliente.',
      categoria: 'Llaveros',
      multicolor: true,
      gramos: 8,
      horas: 0.5,
      unidadesPorCama: 12,
      minPreparacion: 2,
      minPostproceso: 3,
      diasFabricacion: 3,
      estado: 'activo',
      stock: 12,
    },
    {
      nombre: 'Tarjeta de presentación en 3D',
      descripcion: 'Tarjeta de 80 × 50 mm con el logo en relieve, 3 colores.',
      categoria: 'Regalos corporativos',
      multicolor: true,
      bobinaId: 2,
      gramos: 11,
      horas: 0.75,
      unidadesPorCama: 6,
      minPreparacion: 2,
      minPostproceso: 2,
      diasFabricacion: 3,
      estado: 'activo',
      stock: 30,
    },
    {
      nombre: 'Soporte para celular',
      descripcion: 'Soporte de escritorio, ángulo de 60°.',
      categoria: 'Soportes',
      impresoraId: 2,
      bobinaId: 3,
      gramos: 42,
      horas: 2.5,
      minPreparacion: 3,
      minPostproceso: 5,
      estado: 'costeo',
      stock: 0,
    },
    {
      nombre: 'Sello personalizado para carnicería',
      descripcion:
        'Sello con mango intercambiable y el texto que pida el cliente.',
      categoria: 'Sellos',
      tipo: 'personalizado',
      bobinaId: 3,
      horasDiseno: 1.5,
      estado: 'diseno',
      stock: 0,
    },
  ]
  for (const ej of ejemplos) {
    const { stock, ...resto } = ej
    const entrada = { ...base, ...resto } as ProductoEntrada
    const calc = calcularDemo(t, config, entrada)
    const id = t.productos.length + 1
    t.productos.push({
      ...entrada,
      id,
      sku: skuDe(id),
      stock,
      costo: calc.costo,
      precioCalculado: calc.precioCalculado,
      precioFabrica: entrada.estado === 'activo' ? calc.precioCalculado : 0,
      actualizadoEn: ahora(),
    })
  }
  t.archivos.push({
    id: 1,
    productoId: 2,
    tipo: 'imagen',
    nombre: 'tarjeta.png',
    esPortada: true,
    url: `${import.meta.env.BASE_URL}images/logo-hecho-en-capas.png`,
    tamanoBytes: 190_000,
  })
  return t
}

function calcularDemo(
  t: TallerDemo,
  config: ValoresConfig,
  e: ProductoEntrada
) {
  const imp = t.impresoras.find((i) => i.id === e.impresoraId)
  const bob = t.bobinas.find((b) => b.id === e.bobinaId)
  return calcularCosto({
    gramos: e.gramos,
    precioRollo: bob?.precioRollo ?? 0,
    pesoRolloG: bob?.pesoG ?? 0,
    horas: e.horas,
    potenciaW: imp ? imp.potenciaW : 0,
    precioImpresora: imp?.precioCompra ?? 0,
    vidaUtilH: imp?.vidaUtilH ?? 0,
    minPreparacion: e.minPreparacion,
    minPostproceso: e.minPostproceso,
    horasDiseno: e.horasDiseno,
    unidadesLote: e.unidadesLote,
    empaque: e.empaque,
    margenPct: e.margenPct,
    tarifaKwh: config.tarifa_kwh,
    tarifaHora: config.tarifa_hora_mano_obra,
    tarifaDiseno: config.tarifa_hora_diseno,
    fallaPct: config.porcentaje_falla,
  })
}

const fallo = (status: number, mensaje: string, campo?: string): never => {
  throw new ApiError(status, mensaje, campo)
}
const SIN_PERMISO =
  'No tienes permiso para hacer esto. Pídeselo al administrador.'
const NO_EXISTE = 'No encontramos ese producto. Puede que lo hayan borrado.'

function resumen(t: TallerDemo, p: ProductoDemo): ProductoResumen {
  const fotos = t.archivos
    .filter((a) => a.productoId === p.id && a.tipo === 'imagen')
    .sort((a, b) => Number(b.esPortada) - Number(a.esPortada))
  return {
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    tipo: p.tipo,
    estado: p.estado,
    multicolor: p.multicolor,
    precioFabrica: p.precioFabrica,
    diasFabricacion: p.diasFabricacion,
    stock: p.stock,
    portada: fotos[0]?.url ?? null,
    actualizadoEn: p.actualizadoEn,
  }
}

function detalle(
  t: TallerDemo,
  p: ProductoDemo,
  verCostos: boolean
): ProductoDetalle {
  const archivos = t.archivos
    .filter((a) => a.productoId === p.id)
    .sort((a, b) => Number(b.esPortada) - Number(a.esPortada) || a.id - b.id)
    .map(({ productoId: _p, ...a }) => a)
  const d: ProductoDetalle = { ...resumen(t, p), archivos }
  if (verCostos) {
    d.costos = {
      impresoraId: p.impresoraId,
      bobinaId: p.bobinaId,
      gramos: p.gramos,
      horas: p.horas,
      unidadesPorCama: p.unidadesPorCama,
      minPreparacion: p.minPreparacion,
      minPostproceso: p.minPostproceso,
      horasDiseno: p.horasDiseno,
      unidadesLote: p.unidadesLote,
      empaque: p.empaque,
      margenPct: p.margenPct,
      costo: p.costo,
      precioCalculado: p.precioCalculado,
      precioManual: p.precioManual,
      notaAjuste: p.notaAjuste,
    }
  }
  return d
}

/** Devuelve la respuesta, o `undefined` si la ruta no es del Taller. */
export function atenderTaller(
  t: TallerDemo,
  config: ValoresConfig,
  roles: Rol[],
  ruta: string,
  metodo: string,
  c: Record<string, unknown>
): unknown {
  if (!ruta.startsWith('/taller/')) return undefined
  const esTaller = roles.includes('admin') || roles.includes('fabricacion')
  const veCatalogo = esTaller || roles.includes('comercial')
  const deTaller = () => esTaller || fallo(403, SIN_PERMISO)
  const sig = (lista: { id: number }[]) =>
    Math.max(0, ...lista.map((x) => x.id)) + 1
  const m = (re: RegExp) => ruta.match(re)

  // ----- Impresoras -----
  if (ruta === '/taller/impresoras' && metodo === 'GET') {
    deTaller()
    return { impresoras: t.impresoras }
  }
  if (ruta === '/taller/impresoras' && metodo === 'POST') {
    deTaller()
    const v = validarImpresora(c)
    if (!v.ok) return fallo(400, v.mensaje, v.campo)
    const nueva = { ...v.datos, id: sig(t.impresoras) }
    t.impresoras.push(nueva)
    return { impresora: nueva }
  }
  let r = m(/^\/taller\/impresoras\/(\d+)$/)
  if (r && metodo === 'PATCH') {
    deTaller()
    const v = validarImpresora(c)
    if (!v.ok) return fallo(400, v.mensaje, v.campo)
    const i = t.impresoras.findIndex((x) => x.id === Number(r![1]))
    if (i < 0) return fallo(404, 'No encontramos esa impresora.')
    t.impresoras[i] = { ...v.datos, id: t.impresoras[i].id }
    return { impresora: t.impresoras[i] }
  }

  // ----- Bobinas -----
  if (ruta === '/taller/bobinas' && metodo === 'GET') {
    deTaller()
    return { bobinas: t.bobinas }
  }
  if (ruta === '/taller/bobinas' && metodo === 'POST') {
    deTaller()
    const v = validarBobina(c)
    if (!v.ok) return fallo(400, v.mensaje, v.campo)
    const nueva = { ...v.datos, id: sig(t.bobinas) }
    t.bobinas.push(nueva)
    return { bobina: nueva }
  }
  r = m(/^\/taller\/bobinas\/(\d+)$/)
  if (r && metodo === 'PATCH') {
    deTaller()
    const v = validarBobina(c)
    if (!v.ok) return fallo(400, v.mensaje, v.campo)
    const i = t.bobinas.findIndex((x) => x.id === Number(r![1]))
    if (i < 0) return fallo(404, 'No encontramos esa bobina.')
    t.bobinas[i] = { ...v.datos, id: t.bobinas[i].id }
    return { bobina: t.bobinas[i] }
  }

  // ----- Productos -----
  const preparar = () => {
    const v = validarProducto(c, {
      margenes: [config.margen_fabrica_bajo, config.margen_fabrica_alto],
    })
    if (!v.ok) return fallo(400, v.mensaje, v.campo)
    const e = v.datos
    const calc = calcularDemo(t, config, e)
    const imp = t.impresoras.find((i) => i.id === e.impresoraId) ?? null
    const precio = validarPrecio(e, calc.precioCalculado, imp)
    if (!precio.ok) return fallo(400, precio.mensaje, precio.campo)
    const subido =
      e.precioManual !== null && e.precioManual > calc.precioCalculado
    return {
      ...e,
      precioManual: subido ? e.precioManual : null,
      notaAjuste: subido ? e.notaAjuste : '',
      costo: calc.costo,
      precioCalculado: calc.precioCalculado,
      precioFabrica: precio.datos,
      actualizadoEn: ahora(),
    }
  }
  const buscar = (id: unknown) =>
    t.productos.find((p) => p.id === Number(id)) ?? fallo(404, NO_EXISTE)

  if (ruta === '/taller/productos' && metodo === 'GET') {
    if (!veCatalogo) fallo(403, SIN_PERMISO)
    return {
      productos: [...t.productos]
        .sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn))
        .map((p) => resumen(t, p)),
    }
  }
  if (ruta === '/taller/productos' && metodo === 'POST') {
    deTaller()
    const datos = preparar()
    const id = sig(t.productos)
    const nuevo: ProductoDemo = { ...datos, id, sku: skuDe(id), stock: 0 }
    t.productos.push(nuevo)
    return { producto: detalle(t, nuevo, true) }
  }
  r = m(/^\/taller\/productos\/(\d+)$/)
  if (r && metodo === 'GET') {
    if (!veCatalogo) fallo(403, SIN_PERMISO)
    return { producto: detalle(t, buscar(r[1]), esTaller) }
  }
  if (r && metodo === 'PATCH') {
    deTaller()
    const p = buscar(r[1])
    Object.assign(p, preparar())
    return { producto: detalle(t, p, true) }
  }
  r = m(/^\/taller\/productos\/(\d+)\/stock$/)
  if (r && metodo === 'POST') {
    deTaller()
    const p = buscar(r[1])
    const cantidad = Number(c.cantidad)
    if (
      !Number.isInteger(cantidad) ||
      cantidad === 0 ||
      Math.abs(cantidad) > 10_000
    ) {
      fallo(400, 'Escribe cuántas unidades entran (ej. 10) o salen (ej. -2).')
    }
    if (p.stock + cantidad < 0) {
      fallo(
        400,
        `No puedes sacar ${Math.abs(cantidad)}: solo hay ${p.stock} en stock.`
      )
    }
    p.stock += cantidad
    p.actualizadoEn = ahora()
    return { stock: p.stock }
  }
  r = m(/^\/taller\/productos\/(\d+)\/archivos$/)
  if (r && metodo === 'POST') {
    deTaller()
    const p = buscar(r[1])
    const tipo = String(c.tipo) as ArchivoProducto['tipo']
    const esPortada =
      tipo === 'imagen' &&
      !t.archivos.some((a) => a.productoId === p.id && a.tipo === 'imagen')
    t.archivos.push({
      id: sig(t.archivos),
      productoId: p.id,
      tipo,
      nombre: String(c.nombre ?? 'archivo'),
      url: String(c.url ?? ''),
      tamanoBytes: Number(c.tamanoBytes) || 0,
      esPortada,
    })
    p.actualizadoEn = ahora()
    return { producto: detalle(t, p, true) }
  }
  r = m(/^\/taller\/productos\/(\d+)\/archivos\/(\d+)\/portada$/)
  if (r && metodo === 'PATCH') {
    deTaller()
    const p = buscar(r[1])
    for (const a of t.archivos) {
      if (a.productoId === p.id) a.esPortada = a.id === Number(r[2])
    }
    return { producto: detalle(t, p, true) }
  }
  r = m(/^\/taller\/productos\/(\d+)\/archivos\/(\d+)$/)
  if (r && metodo === 'DELETE') {
    deTaller()
    const p = buscar(r[1])
    const i = t.archivos.findIndex(
      (a) => a.id === Number(r![2]) && a.productoId === p.id
    )
    if (i < 0) fallo(404, 'Ese archivo ya no existe.')
    const [borrado] = t.archivos.splice(i, 1)
    if (borrado.esPortada) {
      const otra = t.archivos.find(
        (a) => a.productoId === p.id && a.tipo === 'imagen'
      )
      if (otra) otra.esPortada = true
    }
    return { producto: detalle(t, p, true) }
  }
  return undefined
}
