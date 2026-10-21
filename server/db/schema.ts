import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Personas que usan el sistema. Se ingresa con usuario + PIN.
 * Una persona puede tener varios roles (por ejemplo admin + fabricacion).
 */
export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  usuario: text('usuario').notNull().unique(),
  pinHash: text('pin_hash').notNull(),
  roles: text('roles').array().notNull().default([]),
  activo: boolean('activo').notNull().default(true),
  intentosFallidos: integer('intentos_fallidos').notNull().default(0),
  bloqueadoHasta: timestamp('bloqueado_hasta', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Valores del negocio que el Admin puede cambiar (tarifas, márgenes,
 * anticipo, vigencia...). Una fila por valor.
 */
export const configuracion = pgTable('configuracion', {
  clave: text('clave').primaryKey(),
  valor: jsonb('valor').notNull(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
  actualizadoPor: integer('actualizado_por').references(() => usuarios.id),
})

const creadoEn = () =>
  timestamp('creado_en', { withTimezone: true }).notNull().defaultNow()
const actualizadoEn = () =>
  timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow()

/** Impresoras del taller. El costo por hora sale de su precio y su consumo. */
export const impresoras = pgTable('impresoras', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  modelo: text('modelo').notNull().default(''),
  multicolor: boolean('multicolor').notNull().default(false),
  /** Vatios promedio imprimiendo; null = aún no medido. */
  potenciaW: integer('potencia_w'),
  precioCompra: integer('precio_compra').notNull(),
  vidaUtilH: integer('vida_util_h').notNull().default(5000),
  activa: boolean('activa').notNull().default(true),
  creadoEn: creadoEn(),
  actualizadoEn: actualizadoEn(),
})

/** Bobinas de filamento. Cada rollo con su serial, como en Bambu Studio. */
export const bobinas = pgTable('bobinas', {
  id: serial('id').primaryKey(),
  material: text('material').notNull(),
  color: text('color').notNull(),
  colorHex: text('color_hex').notNull().default('#999999'),
  marca: text('marca').notNull().default(''),
  serial: text('serial').notNull().default(''),
  precioRollo: integer('precio_rollo').notNull(),
  pesoG: integer('peso_g').notNull().default(1000),
  activa: boolean('activa').notNull().default(true),
  creadoEn: creadoEn(),
  actualizadoEn: actualizadoEn(),
})

/** Catálogo: lo que se fabrica y su precio de fábrica. */
export const productos = pgTable(
  'productos',
  {
    id: serial('id').primaryKey(),
    sku: text('sku').unique(),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion').notNull().default(''),
    categoria: text('categoria').notNull().default(''),
    /** catalogo | personalizado */
    tipo: text('tipo').notNull().default('catalogo'),
    /** solicitud | diseno | costeo | activo | inactivo */
    estado: text('estado').notNull().default('costeo'),
    multicolor: boolean('multicolor').notNull().default(false),
    diasFabricacion: integer('dias_fabricacion').notNull().default(2),
    impresoraId: integer('impresora_id').references(() => impresoras.id),
    bobinaId: integer('bobina_id').references(() => bobinas.id),
    gramos: doublePrecision('gramos').notNull().default(0),
    horas: doublePrecision('horas').notNull().default(0),
    unidadesPorCama: integer('unidades_por_cama').notNull().default(1),
    minPreparacion: integer('min_preparacion').notNull().default(0),
    minPostproceso: integer('min_postproceso').notNull().default(0),
    horasDiseno: doublePrecision('horas_diseno').notNull().default(0),
    unidadesLote: integer('unidades_lote').notNull().default(1),
    empaque: integer('empaque').notNull().default(0),
    margenPct: integer('margen_pct').notNull().default(50),
    /** Calculado al guardar, con la configuración de ese momento. */
    costo: integer('costo').notNull().default(0),
    precioCalculado: integer('precio_calculado').notNull().default(0),
    /** Precio subido a mano por el taller (null = se usa el calculado). */
    precioManual: integer('precio_manual'),
    notaAjuste: text('nota_ajuste').notNull().default(''),
    /** Precio con el que trabaja el comercial. */
    precioFabrica: integer('precio_fabrica').notNull().default(0),
    stock: integer('stock').notNull().default(0),
    creadoPor: integer('creado_por').references(() => usuarios.id),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index('productos_estado_idx').on(t.estado)]
)

/** Fotos y archivos (3MF, STL) de cada producto. */
export const productoArchivos = pgTable('producto_archivos', {
  id: serial('id').primaryKey(),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id, { onDelete: 'cascade' }),
  /** imagen | 3mf | stl | otro */
  tipo: text('tipo').notNull(),
  nombre: text('nombre').notNull(),
  url: text('url').notNull(),
  tamanoBytes: integer('tamano_bytes').notNull().default(0),
  esPortada: boolean('es_portada').notNull().default(false),
  creadoEn: creadoEn(),
})

/** Historial de entradas y salidas de producto terminado. */
export const movimientosStock = pgTable('movimientos_stock', {
  id: serial('id').primaryKey(),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id, { onDelete: 'cascade' }),
  /** produccion | venta | ajuste */
  tipo: text('tipo').notNull(),
  cantidad: integer('cantidad').notNull(),
  nota: text('nota').notNull().default(''),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  creadoEn: creadoEn(),
})

export type Usuario = typeof usuarios.$inferSelect
