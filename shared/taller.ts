/**
 * Reglas del Taller: impresoras, bobinas y productos.
 * Las validaciones viven aquí para que el servidor y la versión de prueba
 * respondan exactamente igual. Los mensajes se muestran tal cual al usuario.
 */

import { esPrecioRedondo, redondearPrecio } from './costos.js'

// ---------- Tipos que viajan entre servidor y pantalla ----------

export type Impresora = {
  id: number
  nombre: string
  modelo: string
  multicolor: boolean
  potenciaW: number | null
  precioCompra: number
  vidaUtilH: number
  activa: boolean
}

export type Bobina = {
  id: number
  material: string
  color: string
  colorHex: string
  marca: string
  serial: string
  precioRollo: number
  pesoG: number
  activa: boolean
}

export type TipoArchivo = 'imagen' | '3mf' | 'stl' | 'otro'

export type ArchivoProducto = {
  id: number
  tipo: TipoArchivo
  nombre: string
  url: string
  tamanoBytes: number
  esPortada: boolean
}

export const ESTADOS_PRODUCTO = [
  'solicitud',
  'diseno',
  'costeo',
  'activo',
  'inactivo',
] as const
export type EstadoProducto = (typeof ESTADOS_PRODUCTO)[number]

export const ESTADOS_INFO: Record<
  EstadoProducto,
  { nombre: string; explicacion: string }
> = {
  solicitud: {
    nombre: 'Solicitud',
    explicacion: 'Un cliente pidió algo personalizado; falta diseñarlo.',
  },
  diseno: {
    nombre: 'En diseño',
    explicacion: 'Se está modelando. Aún no tiene precio.',
  },
  costeo: {
    nombre: 'En costeo',
    explicacion: 'Ya está diseñado; falta laminarlo y poner los datos del costo.',
  },
  activo: {
    nombre: 'Listo para vender',
    explicacion: 'Tiene precio de fábrica. El comercial ya lo puede cotizar.',
  },
  inactivo: {
    nombre: 'Retirado',
    explicacion: 'Ya no se ofrece. No aparece al cotizar.',
  },
}

export type TipoProducto = 'catalogo' | 'personalizado'

/** Un color preaprobado de un producto: una bobina del taller y su stock. */
export type ColorProducto = {
  bobinaId: number
  /** Nombre del color, ej. "Azul". */
  color: string
  colorHex: string
  material: string
  /** Unidades ya impresas de este color. */
  stock: number
  /** La bobina sigue activa en el taller. */
  activa: boolean
}

/** "Azul (PLA Matte)" — el nombre que se muestra en listas. */
export function nombreColor(c: Pick<ColorProducto, 'color' | 'material'>) {
  return c.material ? `${c.color} (${c.material})` : c.color
}

/** Lo que ve cualquier persona del equipo (incluido el comercial). */
export type ProductoResumen = {
  id: number
  sku: string
  nombre: string
  descripcion: string
  categoria: string
  tipo: TipoProducto
  estado: EstadoProducto
  multicolor: boolean
  /** El comercial escoge el color entre `colores` al cotizar. */
  escogeColor: boolean
  /** Colores preaprobados (vacío si no escoge color). */
  colores: ColorProducto[]
  precioFabrica: number
  diasFabricacion: number
  /** Total de unidades impresas (suma de todos los colores). */
  stock: number
  portada: string | null
  actualizadoEn: string
}

/** Datos del costo: solo los ven Admin y Taller. */
export type ProductoCosto = {
  impresoraId: number | null
  bobinaId: number | null
  gramos: number
  horas: number
  unidadesPorCama: number
  minPreparacion: number
  minPostproceso: number
  horasDiseno: number
  unidadesLote: number
  empaque: number
  margenPct: number
  costo: number
  precioCalculado: number
  /** Precio subido a mano (null = se usa el calculado). */
  precioManual: number | null
  notaAjuste: string
}

export type ProductoDetalle = ProductoResumen & {
  archivos: ArchivoProducto[]
  /** Ausente para el comercial. */
  costos?: ProductoCosto
}

export const CATEGORIAS_SUGERIDAS = [
  'Llaveros',
  'Figuras',
  'Soportes',
  'Sellos',
  'Decoración',
  'Regalos corporativos',
  'Repuestos',
]

export const MATERIALES = ['PLA', 'PLA Matte', 'PLA Silk', 'PETG', 'TPU', 'ABS']

// ---------- Validaciones ----------

export type Resultado<T> =
  | { ok: true; datos: T }
  | { ok: false; mensaje: string; campo?: string }

const malo = (mensaje: string, campo?: string) =>
  ({ ok: false, mensaje, campo }) as const

const texto = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max)

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : NaN
}

function entero(
  v: unknown,
  { min, max, etiqueta, campo, opcional = false }: {
    min: number
    max: number
    etiqueta: string
    campo: string
    opcional?: boolean
  }
): Resultado<number | null> {
  const x = numero(v)
  if (x === null) {
    return opcional ? { ok: true, datos: null } : malo(`Escribe ${etiqueta}.`, campo)
  }
  if (Number.isNaN(x) || x < min || x > max) {
    return malo(
      `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} debe ser un número entre ${min.toLocaleString('es-CO')} y ${max.toLocaleString('es-CO')}.`,
      campo
    )
  }
  return { ok: true, datos: Math.round(x) }
}

function decimal(
  v: unknown,
  { min, max, etiqueta, campo }: { min: number; max: number; etiqueta: string; campo: string }
): Resultado<number> {
  const x = numero(v)
  if (x === null || Number.isNaN(x) || x < min || x > max) {
    return malo(
      `${etiqueta[0].toUpperCase()}${etiqueta.slice(1)} debe ser un número entre ${min} y ${max.toLocaleString('es-CO')}.`,
      campo
    )
  }
  return { ok: true, datos: Math.round(x * 100) / 100 }
}

export type ImpresoraEntrada = Omit<Impresora, 'id'>

export function validarImpresora(c: Record<string, unknown>): Resultado<ImpresoraEntrada> {
  const nombre = texto(c.nombre, 60)
  if (nombre.length < 2) return malo('Escribe un nombre para la impresora.', 'nombre')
  const potencia = entero(c.potenciaW, {
    min: 1,
    max: 3000,
    etiqueta: 'el consumo en vatios',
    campo: 'potenciaW',
    opcional: true,
  })
  if (!potencia.ok) return potencia
  const precio = entero(c.precioCompra, {
    min: 0,
    max: 100_000_000,
    etiqueta: 'el precio de compra',
    campo: 'precioCompra',
  })
  if (!precio.ok) return precio
  const vida = entero(c.vidaUtilH, {
    min: 100,
    max: 100_000,
    etiqueta: 'las horas de vida útil',
    campo: 'vidaUtilH',
  })
  if (!vida.ok) return vida
  return {
    ok: true,
    datos: {
      nombre,
      modelo: texto(c.modelo, 60),
      multicolor: Boolean(c.multicolor),
      potenciaW: potencia.datos,
      precioCompra: precio.datos!,
      vidaUtilH: vida.datos!,
      activa: c.activa === undefined ? true : Boolean(c.activa),
    },
  }
}

export type BobinaEntrada = Omit<Bobina, 'id'>

export function validarBobina(c: Record<string, unknown>): Resultado<BobinaEntrada> {
  const material = texto(c.material, 30)
  if (!material) return malo('Elige el material.', 'material')
  const color = texto(c.color, 40)
  if (!color) return malo('Escribe el color. Ejemplo: Rojo, Negro mate.', 'color')
  const colorHex = texto(c.colorHex, 7) || '#999999'
  if (!/^#[0-9a-fA-F]{6}$/.test(colorHex)) {
    return malo('El color de muestra no es válido.', 'colorHex')
  }
  const precio = entero(c.precioRollo, {
    min: 1000,
    max: 2_000_000,
    etiqueta: 'el precio del rollo',
    campo: 'precioRollo',
  })
  if (!precio.ok) return precio
  const peso = entero(c.pesoG, {
    min: 100,
    max: 10_000,
    etiqueta: 'el peso del rollo en gramos',
    campo: 'pesoG',
  })
  if (!peso.ok) return peso
  return {
    ok: true,
    datos: {
      material,
      color,
      colorHex: colorHex.toLowerCase(),
      marca: texto(c.marca, 40),
      serial: texto(c.serial, 60),
      precioRollo: precio.datos!,
      pesoG: peso.datos!,
      activa: c.activa === undefined ? true : Boolean(c.activa),
    },
  }
}

export type ProductoEntrada = {
  nombre: string
  descripcion: string
  categoria: string
  tipo: TipoProducto
  estado: EstadoProducto
  multicolor: boolean
  escogeColor: boolean
  /** Bobinas preaprobadas (en orden). Vacío si no escoge color. */
  colores: number[]
  diasFabricacion: number
  impresoraId: number | null
  bobinaId: number | null
  gramos: number
  horas: number
  unidadesPorCama: number
  minPreparacion: number
  minPostproceso: number
  horasDiseno: number
  unidadesLote: number
  empaque: number
  margenPct: number
  precioManual: number | null
  notaAjuste: string
}

/**
 * Valida la ficha de un producto. Recibe los márgenes permitidos y el
 * precio calculado (lo calcula quien llama, con la configuración actual),
 * porque de eso dependen las reglas del precio.
 */
export function validarProducto(
  c: Record<string, unknown>,
  reglas: { margenes: number[] }
): Resultado<ProductoEntrada> {
  const nombre = texto(c.nombre, 120)
  if (nombre.length < 2) return malo('Escribe el nombre del producto.', 'nombre')
  const tipo = c.tipo === 'personalizado' ? 'personalizado' : 'catalogo'
  const estado = (ESTADOS_PRODUCTO as readonly string[]).includes(String(c.estado))
    ? (c.estado as EstadoProducto)
    : 'costeo'

  const chequeos = {
    diasFabricacion: entero(c.diasFabricacion, { min: 0, max: 90, etiqueta: 'los días de fabricación', campo: 'diasFabricacion' }),
    unidadesPorCama: entero(c.unidadesPorCama ?? 1, { min: 1, max: 500, etiqueta: 'las unidades por cama', campo: 'unidadesPorCama' }),
    minPreparacion: entero(c.minPreparacion ?? 0, { min: 0, max: 600, etiqueta: 'los minutos de preparación', campo: 'minPreparacion' }),
    minPostproceso: entero(c.minPostproceso ?? 0, { min: 0, max: 600, etiqueta: 'los minutos de acabado', campo: 'minPostproceso' }),
    unidadesLote: entero(c.unidadesLote ?? 1, { min: 1, max: 10_000, etiqueta: 'las unidades del lote', campo: 'unidadesLote' }),
    empaque: entero(c.empaque ?? 0, { min: 0, max: 1_000_000, etiqueta: 'el empaque', campo: 'empaque' }),
    precioManual: entero(c.precioManual, { min: 0, max: 100_000_000, etiqueta: 'el precio de fábrica', campo: 'precioManual', opcional: true }),
  }
  for (const r of Object.values(chequeos)) if (!r.ok) return r

  const gramos = decimal(c.gramos ?? 0, { min: 0, max: 20_000, etiqueta: 'los gramos', campo: 'gramos' })
  if (!gramos.ok) return gramos
  const horas = decimal(c.horas ?? 0, { min: 0, max: 500, etiqueta: 'las horas de impresión', campo: 'horas' })
  if (!horas.ok) return horas
  const horasDiseno = decimal(c.horasDiseno ?? 0, { min: 0, max: 500, etiqueta: 'las horas de diseño', campo: 'horasDiseno' })
  if (!horasDiseno.ok) return horasDiseno

  const margenPct = Number(c.margenPct)
  if (!reglas.margenes.includes(margenPct)) {
    return malo(
      `Elige uno de los márgenes de fábrica: ${reglas.margenes.join(' % o ')} %.`,
      'margenPct'
    )
  }

  const idOpcional = (v: unknown) => {
    const x = Number(v)
    return Number.isInteger(x) && x > 0 ? x : null
  }

  const v = (k: keyof typeof chequeos) => (chequeos[k] as { datos: number | null }).datos

  const escogeColor = Boolean(c.escogeColor)
  const colores = escogeColor
    ? [
        ...new Set(
          (Array.isArray(c.colores) ? c.colores : [])
            .map((x) => idOpcional(x))
            .filter((x): x is number => x !== null)
        ),
      ].slice(0, 30)
    : []
  if (escogeColor && colores.length < 2) {
    return malo(
      'Marca al menos 2 colores para que el comercial pueda escoger. Si se vende en un solo color, apaga "El cliente puede escoger el color".',
      'colores'
    )
  }

  return {
    ok: true,
    datos: {
      nombre,
      descripcion: texto(c.descripcion, 1000),
      categoria: texto(c.categoria, 40),
      tipo,
      estado,
      multicolor: Boolean(c.multicolor),
      escogeColor,
      colores,
      diasFabricacion: v('diasFabricacion')!,
      impresoraId: idOpcional(c.impresoraId),
      bobinaId: idOpcional(c.bobinaId),
      gramos: gramos.datos,
      horas: horas.datos,
      unidadesPorCama: v('unidadesPorCama')!,
      minPreparacion: v('minPreparacion')!,
      minPostproceso: v('minPostproceso')!,
      horasDiseno: horasDiseno.datos,
      unidadesLote: v('unidadesLote')!,
      empaque: v('empaque')!,
      margenPct,
      precioManual: v('precioManual'),
      notaAjuste: texto(c.notaAjuste, 300),
    },
  }
}

/**
 * Reglas del precio, después de calcular el costo con la configuración actual.
 * Devuelve el precio de fábrica final o el error en palabras sencillas.
 */
export function validarPrecio(
  entrada: Pick<
    ProductoEntrada,
    | 'estado'
    | 'precioManual'
    | 'notaAjuste'
    | 'multicolor'
    | 'impresoraId'
    | 'bobinaId'
    | 'gramos'
    | 'horas'
  >,
  precioCalculado: number,
  impresora: Pick<Impresora, 'multicolor' | 'nombre'> | null
): Resultado<number> {
  if (entrada.multicolor && impresora && !impresora.multicolor) {
    return malo(
      `La ${impresora.nombre} imprime un solo color. Para un producto de varios colores elige una impresora multicolor.`,
      'impresoraId'
    )
  }
  if (entrada.precioManual !== null) {
    if (!esPrecioRedondo(entrada.precioManual)) {
      return malo(
        `El precio debe ser redondo a mil. Usa ${redondearPrecio(entrada.precioManual).toLocaleString('es-CO')}.`,
        'precioManual'
      )
    }
    if (entrada.precioManual < precioCalculado) {
      return malo(
        `El precio a mano solo puede subir el calculado, no bajarlo. El mínimo es ${precioCalculado.toLocaleString('es-CO')}.`,
        'precioManual'
      )
    }
    if (entrada.precioManual > precioCalculado && entrada.notaAjuste.length < 3) {
      return malo('Escribe por qué subes el precio (queda guardado).', 'notaAjuste')
    }
  }
  const final = entrada.precioManual ?? precioCalculado
  if (entrada.estado === 'activo') {
    const faltan = [
      !entrada.impresoraId && 'la impresora',
      !entrada.bobinaId && 'la bobina',
      !(entrada.gramos > 0) && 'los gramos',
      !(entrada.horas > 0) && 'las horas',
    ].filter(Boolean)
    if (faltan.length > 0 || final <= 0) {
      return malo(
        `Para dejarlo "Listo para vender" falta: ${faltan.join(', ') || 'el precio'}.`,
        'estado'
      )
    }
  }
  return { ok: true, datos: final }
}

export function skuDe(id: number) {
  return `HC-${String(id).padStart(4, '0')}`
}

/**
 * Qué pasa con los colores al guardar la ficha. Reglas:
 * - No se puede quitar un color que todavía tiene unidades en stock.
 * - Al prender los colores, lo que ya había en stock queda en el color de la
 *   bobina de referencia (o en el primero) y luego se reparte con "Ajustar stock".
 * - Al apagarlos, el stock total se conserva sin color.
 */
export function planColores(
  antes: {
    escogeColor: boolean
    colores: Pick<ColorProducto, 'bobinaId' | 'color' | 'material' | 'stock'>[]
    stock: number
  },
  ahora: { escogeColor: boolean; colores: number[]; bobinaId: number | null }
): Resultado<{ quitar: number[]; agregar: number[]; stockA: number | null }> {
  const previos = antes.escogeColor ? antes.colores : []
  if (!ahora.escogeColor) {
    return { ok: true, datos: { quitar: previos.map((c) => c.bobinaId), agregar: [], stockA: null } }
  }
  const quitar = previos.filter((c) => !ahora.colores.includes(c.bobinaId))
  const conStock = quitar.find((c) => c.stock > 0)
  if (conStock) {
    return malo(
      `El color ${nombreColor(conStock)} tiene ${conStock.stock} en stock. Sácalos con "Ajustar stock" antes de quitar ese color.`,
      'colores'
    )
  }
  const agregar = ahora.colores.filter((id) => !previos.some((c) => c.bobinaId === id))
  const stockA =
    !antes.escogeColor && antes.stock > 0
      ? ahora.bobinaId && ahora.colores.includes(ahora.bobinaId)
        ? ahora.bobinaId
        : ahora.colores[0]
      : null
  return { ok: true, datos: { quitar: quitar.map((c) => c.bobinaId), agregar, stockA } }
}

/** Revisa un ajuste de stock (entra o sale) del producto y, si aplica, del color. */
export function validarAjusteStock(
  producto: { escogeColor: boolean; stock: number; colores: Pick<ColorProducto, 'bobinaId' | 'color' | 'material' | 'stock'>[] },
  cuerpo: Record<string, unknown>
): Resultado<{ cantidad: number; nota: string; bobinaId: number | null }> {
  const cantidad = Number(cuerpo.cantidad)
  const nota = String(cuerpo.nota ?? '').trim().slice(0, 200)
  if (!Number.isInteger(cantidad) || cantidad === 0 || Math.abs(cantidad) > 10_000) {
    return malo('Escribe cuántas unidades entran (ej. 10) o salen (ej. -2).', 'cantidad')
  }
  if (!producto.escogeColor) {
    if (producto.stock + cantidad < 0) {
      return malo(`No puedes sacar ${Math.abs(cantidad)}: solo hay ${producto.stock} en stock.`, 'cantidad')
    }
    return { ok: true, datos: { cantidad, nota, bobinaId: null } }
  }
  const color = producto.colores.find((c) => c.bobinaId === Number(cuerpo.bobinaId))
  if (!color) return malo('Escoge de qué color son las unidades.', 'bobinaId')
  if (color.stock + cantidad < 0) {
    return malo(
      `No puedes sacar ${Math.abs(cantidad)} de ${nombreColor(color)}: solo hay ${color.stock}.`,
      'cantidad'
    )
  }
  return { ok: true, datos: { cantidad, nota, bobinaId: color.bobinaId } }
}
