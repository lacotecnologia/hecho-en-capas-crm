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
  type ColorProducto,
  type Impresora,
  nombreColor,
  planColores,
  type ProductoCosto,
  type ProductoDetalle,
  type ProductoEntrada,
  type ProductoResumen,
  skuDe,
  validarAjusteStock,
  validarBobina,
  validarImpresora,
  validarPrecio,
  validarProducto,
} from '@shared/taller'
import { ApiError } from '@/lib/api'

export type ProductoDemo = Omit<
  ProductoResumen,
  'portada' | 'sku' | 'colores' | 'precioTienda' | 'enTienda'
> &
  ProductoCosto & {
    sku: string
    precioTienda?: number | null
    enTienda?: boolean
    /** Colores preaprobados con su stock (solo si escogeColor). */
    coloresStock: { bobinaId: number; stock: number }[]
  }
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
    {
      id: 4,
      material: 'PLA',
      color: 'Azul',
      colorHex: '#1d4ed8',
      marca: 'Bambu Lab',
      serial: 'EJEMPLO-04',
      precioRollo: 75_000,
      pesoG: 1000,
      activa: true,
    },
    {
      id: 5,
      material: 'PLA',
      color: 'Rojo',
      colorHex: '#dc2626',
      marca: 'Bambu Lab',
      serial: 'EJEMPLO-05',
      precioRollo: 75_000,
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
    escogeColor: false,
    colores: [] as number[],
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
    coloresStock?: { bobinaId: number; stock: number }[]
  })[] = [
    {
      nombre: 'Llavero con logo',
      descripcion:
        'Llavero de 5 cm con el logo en relieve. El cliente escoge el color.',
      categoria: 'Llaveros',
      escogeColor: true,
      bobinaId: 4,
      coloresStock: [
        { bobinaId: 4, stock: 5 },
        { bobinaId: 3, stock: 4 },
        { bobinaId: 5, stock: 3 },
      ],
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
    const { stock, coloresStock = [], ...resto } = ej
    const { colores: _c, ...entrada } = { ...base, ...resto } as ProductoEntrada
    const calc = calcularDemo(t, config, entrada)
    const id = t.productos.length + 1
    t.productos.push({
      ...entrada,
      id,
      sku: skuDe(id),
      stock,
      coloresStock,
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
  e: Omit<ProductoEntrada, 'colores'>
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

/** Foto principal del producto (o null). */
export function portadaDe(t: TallerDemo, productoId: number) {
  const fotos = t.archivos
    .filter((a) => a.productoId === productoId && a.tipo === 'imagen')
    .sort((a, b) => Number(b.esPortada) - Number(a.esPortada))
  return fotos[0]?.url ?? null
}

/** Colores preaprobados con su nombre y muestra (como los devuelve el servidor). */
export function coloresDemo(t: TallerDemo, p: ProductoDemo): ColorProducto[] {
  if (!p.escogeColor) return []
  return p.coloresStock.flatMap((c) => {
    const b = t.bobinas.find((x) => x.id === c.bobinaId)
    return b
      ? [
          {
            bobinaId: b.id,
            color: b.color,
            colorHex: b.colorHex,
            material: b.material,
            stock: c.stock,
            activa: b.activa,
          },
        ]
      : []
  })
}

/** Stock disponible del producto (o del color, si tiene colores). */
export function stockDisponibleDemo(
  t: TallerDemo,
  productoId: number,
  bobinaId: number | null
) {
  const p = t.productos.find((x) => x.id === productoId)
  if (!p) return 0
  if (!p.escogeColor) return p.stock
  return p.coloresStock.find((c) => c.bobinaId === bobinaId)?.stock ?? 0
}

/** Igual que moverStock del servidor: total y color siempre cuadran. */
export function moverStockDemo(
  t: TallerDemo,
  productoId: number,
  bobinaId: number | null,
  cantidad: number
) {
  const p = t.productos.find((x) => x.id === productoId)
  if (!p) return
  if (p.escogeColor && bobinaId) {
    let c = p.coloresStock.find((x) => x.bobinaId === bobinaId)
    if (!c) {
      c = { bobinaId, stock: 0 }
      p.coloresStock.push(c)
    }
    if (c.stock + cantidad < 0) {
      const b = t.bobinas.find((x) => x.id === bobinaId)
      fallo(
        400,
        `No alcanza el stock de ${b ? nombreColor(b) : 'ese color'}: hay ${c.stock}.`
      )
    }
    c.stock += cantidad
  }
  p.stock += cantidad
  p.actualizadoEn = ahora()
}

function resumen(t: TallerDemo, p: ProductoDemo): ProductoResumen {
  return {
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    descripcion: p.descripcion,
    categoria: p.categoria,
    tipo: p.tipo,
    estado: p.estado,
    multicolor: p.multicolor,
    escogeColor: p.escogeColor,
    colores: coloresDemo(t, p),
    precioFabrica: p.precioFabrica,
    precioTienda: p.precioTienda ?? null,
    enTienda: p.enTienda ?? false,
    diasFabricacion: p.diasFabricacion,
    stock: p.stock,
    portada: portadaDe(t, p.id),
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
    const { colores, ...e } = v.datos
    if (colores.some((id) => !t.bobinas.some((b) => b.id === id))) {
      fallo(
        400,
        'Uno de los colores ya no existe. Vuelve a marcarlos.',
        'colores'
      )
    }
    const calc = calcularDemo(t, config, e)
    const imp = t.impresoras.find((i) => i.id === e.impresoraId) ?? null
    const precio = validarPrecio(e, calc.precioCalculado, imp)
    if (!precio.ok) return fallo(400, precio.mensaje, precio.campo)
    const subido =
      e.precioManual !== null && e.precioManual > calc.precioCalculado
    return {
      colores,
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
    const { colores, ...datos } = preparar()
    const id = sig(t.productos)
    const nuevo: ProductoDemo = {
      ...datos,
      id,
      sku: skuDe(id),
      stock: 0,
      coloresStock: datos.escogeColor
        ? colores.map((bobinaId) => ({ bobinaId, stock: 0 }))
        : [],
    }
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
    const { colores, ...datos } = preparar()
    const plan = planColores(
      {
        escogeColor: p.escogeColor,
        colores: coloresDemo(t, p),
        stock: p.stock,
      },
      { escogeColor: datos.escogeColor, colores, bobinaId: datos.bobinaId }
    )
    if (!plan.ok) return fallo(400, plan.mensaje, plan.campo)
    const previos = p.escogeColor ? p.coloresStock : []
    const coloresStock = datos.escogeColor
      ? colores.map((bobinaId) => ({
          bobinaId,
          stock:
            plan.datos.stockA === bobinaId
              ? p.stock
              : (previos.find((x) => x.bobinaId === bobinaId)?.stock ?? 0),
        }))
      : []
    Object.assign(p, datos, { coloresStock })
    return { producto: detalle(t, p, true) }
  }
  r = m(/^\/taller\/productos\/(\d+)\/tienda$/)
  if (r && metodo === 'PATCH') {
    if (!roles.includes('admin')) fallo(403, SIN_PERMISO)
    const p = buscar(r[1])
    const precio = c.precioTienda ? Number(c.precioTienda) : null
    if (precio !== null && precio < p.precioFabrica)
      return fallo(
        400,
        'El precio de la tienda no puede ser menor al precio de fábrica. Sube el valor.',
        'precioTienda'
      )
    if (c.enTienda === true && precio === null)
      return fallo(
        400,
        'Para mostrarlo en la tienda primero escribe su precio al público.',
        'precioTienda'
      )
    p.precioTienda = precio
    p.enTienda = c.enTienda === true
    return { producto: detalle(t, p, true) }
  }
  r = m(/^\/taller\/productos\/(\d+)\/stock$/)
  if (r && metodo === 'POST') {
    deTaller()
    const p = buscar(r[1])
    const v = validarAjusteStock(
      {
        escogeColor: p.escogeColor,
        stock: p.stock,
        colores: coloresDemo(t, p),
      },
      c
    )
    if (!v.ok) return fallo(400, v.mensaje, v.campo)
    moverStockDemo(t, p.id, v.datos.bobinaId, v.datos.cantidad)
    return { stock: p.stock, producto: detalle(t, p, true) }
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
