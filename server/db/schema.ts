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
  uniqueIndex,
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
    /** El comercial escoge el color entre las bobinas preaprobadas (producto_colores). */
    escogeColor: boolean('escoge_color').notNull().default(false),
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
    /** Total de unidades impresas. Con colores, es la suma del stock de cada color. */
    stock: integer('stock').notNull().default(0),
    creadoPor: integer('creado_por').references(() => usuarios.id),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index('productos_estado_idx').on(t.estado)]
)

/**
 * Colores preaprobados de un producto (solo si escoge_color): cada uno es una
 * bobina del taller, con su propio stock de unidades ya impresas.
 */
export const productoColores = pgTable(
  'producto_colores',
  {
    id: serial('id').primaryKey(),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productos.id, { onDelete: 'cascade' }),
    bobinaId: integer('bobina_id')
      .notNull()
      .references(() => bobinas.id),
    stock: integer('stock').notNull().default(0),
    orden: integer('orden').notNull().default(0),
  },
  (t) => [uniqueIndex('producto_colores_unico_idx').on(t.productoId, t.bobinaId)]
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
  /** Color (bobina) del stock que se movió, si el producto tiene colores. */
  bobinaId: integer('bobina_id').references(() => bobinas.id),
  nota: text('nota').notNull().default(''),
  pedidoId: integer('pedido_id'),
  ordenId: integer('orden_id'),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  creadoEn: creadoEn(),
})

/** Clientes de Hecho en Capas. */
export const clientes = pgTable('clientes', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  whatsapp: text('whatsapp').notNull().default(''),
  email: text('email').notNull().default(''),
  ciudad: text('ciudad').notNull().default(''),
  direccion: text('direccion').notNull().default(''),
  documento: text('documento').notNull().default(''),
  creadoPor: integer('creado_por').references(() => usuarios.id),
  creadoEn: creadoEn(),
  actualizadoEn: actualizadoEn(),
})

/**
 * Cotizaciones. Cada versión es una fila; todas las versiones comparten
 * año y número (COT-2026-0007, COT-2026-0007-v2…).
 */
export const cotizaciones = pgTable(
  'cotizaciones',
  {
    id: serial('id').primaryKey(),
    anio: integer('anio').notNull(),
    numero: integer('numero').notNull(),
    version: integer('version').notNull().default(1),
    codigo: text('codigo').notNull(),
    /** borrador | enviada | aprobada | rechazada | vencida | reemplazada */
    estado: text('estado').notNull().default('borrador'),
    clienteId: integer('cliente_id').references(() => clientes.id),
    comercialId: integer('comercial_id')
      .notNull()
      .references(() => usuarios.id),
    /** recoge | local | nacional */
    modalidad: text('modalidad').notNull().default('local'),
    descuento: integer('descuento').notNull().default(0),
    notas: text('notas').notNull().default(''),
    // Resumen guardado al guardar (para listas y reportes)
    subtotal: integer('subtotal').notNull().default(0),
    totalCargos: integer('total_cargos').notNull().default(0),
    total: integer('total').notNull().default(0),
    ganancia: integer('ganancia').notNull().default(0),
    anticipoPct: integer('anticipo_pct').notNull().default(0),
    anticipo: integer('anticipo').notNull().default(0),
    diasFabricacion: integer('dias_fabricacion').notNull().default(0),
    diasEnvio: integer('dias_envio').notNull().default(0),
    motivoRechazo: text('motivo_rechazo').notNull().default(''),
    enviadaEn: timestamp('enviada_en', { withTimezone: true }),
    venceEn: timestamp('vence_en', { withTimezone: true }),
    decididaEn: timestamp('decidida_en', { withTimezone: true }),
    reemplazaId: integer('reemplaza_id'),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    uniqueIndex('cotizaciones_numero_version_idx').on(t.anio, t.numero, t.version),
    index('cotizaciones_estado_idx').on(t.estado),
  ]
)

/** Productos de cada cotización, con el precio congelado. */
export const cotizacionLineas = pgTable('cotizacion_lineas', {
  id: serial('id').primaryKey(),
  cotizacionId: integer('cotizacion_id')
    .notNull()
    .references(() => cotizaciones.id, { onDelete: 'cascade' }),
  orden: integer('orden').notNull().default(0),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion').notNull().default(''),
  imagen: text('imagen'),
  cantidad: integer('cantidad').notNull(),
  precioFabrica: integer('precio_fabrica').notNull(),
  precioVenta: integer('precio_venta').notNull(),
  personalizado: boolean('personalizado').notNull().default(false),
  diasFabricacion: integer('dias_fabricacion').notNull().default(0),
  desdeStock: boolean('desde_stock').notNull().default(false),
  /** Color escogido (bobina preaprobada); null si el producto no escoge color. */
  bobinaId: integer('bobina_id').references(() => bobinas.id),
  color: text('color').notNull().default(''),
  colorHex: text('color_hex').notNull().default(''),
})

/** Cargos extra: envío, diseño adicional, urgencia… */
export const cotizacionCargos = pgTable('cotizacion_cargos', {
  id: serial('id').primaryKey(),
  cotizacionId: integer('cotizacion_id')
    .notNull()
    .references(() => cotizaciones.id, { onDelete: 'cascade' }),
  concepto: text('concepto').notNull(),
  valor: integer('valor').notNull(),
})

/** Imágenes de referencia que manda el cliente. */
export const cotizacionImagenes = pgTable('cotizacion_imagenes', {
  id: serial('id').primaryKey(),
  cotizacionId: integer('cotizacion_id')
    .notNull()
    .references(() => cotizaciones.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  nombre: text('nombre').notNull().default(''),
  creadoEn: creadoEn(),
})

/**
 * Pedidos: nacen de una cotización aprobada. El estado se calcula solo
 * con las órdenes, los pagos y la entrega.
 */
export const pedidos = pgTable(
  'pedidos',
  {
    id: serial('id').primaryKey(),
    anio: integer('anio').notNull(),
    numero: integer('numero').notNull(),
    codigo: text('codigo').notNull(),
    /** Código para el seguimiento del cliente (HC-7K4P2Q). */
    seguimiento: text('seguimiento').notNull().unique(),
    cotizacionId: integer('cotizacion_id')
      .notNull()
      .unique()
      .references(() => cotizaciones.id),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    comercialId: integer('comercial_id')
      .notNull()
      .references(() => usuarios.id),
    /** confirmado | en_produccion | listo | en_entrega | entregado | cerrado | cancelado */
    estado: text('estado').notNull().default('confirmado'),
    modalidad: text('modalidad').notNull(),
    subtotal: integer('subtotal').notNull(),
    totalCargos: integer('total_cargos').notNull().default(0),
    descuento: integer('descuento').notNull().default(0),
    total: integer('total').notNull(),
    ganancia: integer('ganancia').notNull().default(0),
    anticipoPct: integer('anticipo_pct').notNull().default(0),
    anticipo: integer('anticipo').notNull().default(0),
    requiereAnticipo: boolean('requiere_anticipo').notNull().default(false),
    producirSinAnticipo: boolean('producir_sin_anticipo').notNull().default(false),
    diasFabricacion: integer('dias_fabricacion').notNull().default(0),
    diasEnvio: integer('dias_envio').notNull().default(0),
    /** Fecha prometida al cliente; se calcula cuando empieza la producción. */
    fechaCompromiso: timestamp('fecha_compromiso', { withTimezone: true }),
    notas: text('notas').notNull().default(''),
    numeroFactura: text('numero_factura').notNull().default(''),
    motivoCancelacion: text('motivo_cancelacion').notNull().default(''),
    creadoPor: integer('creado_por').references(() => usuarios.id),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [
    uniqueIndex('pedidos_numero_idx').on(t.anio, t.numero),
    index('pedidos_estado_idx').on(t.estado),
  ]
)

/** Productos del pedido (copiados de la cotización). */
export const pedidoLineas = pgTable('pedido_lineas', {
  id: serial('id').primaryKey(),
  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id, { onDelete: 'cascade' }),
  orden: integer('orden').notNull().default(0),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productos.id),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion').notNull().default(''),
  imagen: text('imagen'),
  cantidad: integer('cantidad').notNull(),
  precioFabrica: integer('precio_fabrica').notNull(),
  precioVenta: integer('precio_venta').notNull(),
  personalizado: boolean('personalizado').notNull().default(false),
  /** Se descontó del stock al crear el pedido: no se imprime. */
  desdeStock: boolean('desde_stock').notNull().default(false),
  bobinaId: integer('bobina_id').references(() => bobinas.id),
  color: text('color').notNull().default(''),
  colorHex: text('color_hex').notNull().default(''),
})

export const pedidoCargos = pgTable('pedido_cargos', {
  id: serial('id').primaryKey(),
  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id, { onDelete: 'cascade' }),
  concepto: text('concepto').notNull(),
  valor: integer('valor').notNull(),
})

/**
 * Órdenes de producción: lo que pasa por la cola de impresión.
 * Sin pedido = se imprime para stock.
 */
export const ordenesProduccion = pgTable(
  'ordenes_produccion',
  {
    id: serial('id').primaryKey(),
    pedidoId: integer('pedido_id').references(() => pedidos.id, { onDelete: 'cascade' }),
    lineaId: integer('linea_id').references(() => pedidoLineas.id, { onDelete: 'cascade' }),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productos.id),
    cantidad: integer('cantidad').notNull(),
    /** espera_anticipo | en_cola | imprimiendo | postproceso | listo | cancelada */
    estado: text('estado').notNull().default('en_cola'),
    impresoraId: integer('impresora_id').references(() => impresoras.id),
    /** Bobina con la que se imprimió (la elige el taller al empezar). */
    bobinaId: integer('bobina_id').references(() => bobinas.id),
    /** Color que pidió el cliente (o el de stock); el taller debe usar ese color. */
    colorBobinaId: integer('color_bobina_id').references(() => bobinas.id),
    operadorId: integer('operador_id').references(() => usuarios.id),
    inicio: timestamp('inicio', { withTimezone: true }),
    finEstimado: timestamp('fin_estimado', { withTimezone: true }),
    finReal: timestamp('fin_real', { withTimezone: true }),
    intentos: integer('intentos').notNull().default(0),
    gramosPerdidos: integer('gramos_perdidos').notNull().default(0),
    motivoFalla: text('motivo_falla').notNull().default(''),
    creadoPor: integer('creado_por').references(() => usuarios.id),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index('ordenes_estado_idx').on(t.estado), index('ordenes_pedido_idx').on(t.pedidoId)]
)

/** Dinero recibido por cada pedido. */
export const pagos = pgTable('pagos', {
  id: serial('id').primaryKey(),
  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id, { onDelete: 'cascade' }),
  /** anticipo | abono | saldo */
  tipo: text('tipo').notNull(),
  /** efectivo | nequi | daviplata | transferencia | datafono */
  metodo: text('metodo').notNull(),
  monto: integer('monto').notNull(),
  referencia: text('referencia').notNull().default(''),
  comprobanteUrl: text('comprobante_url'),
  /** Motivo de una devolución (reembolso). */
  nota: text('nota').notNull().default(''),
  usuarioId: integer('usuario_id').references(() => usuarios.id),
  creadoEn: creadoEn(),
})

/**
 * Entrega de cada pedido: recoge en taller, domicilio local o transportadora.
 * por_programar | programada | en_camino | entregada
 */
export const entregas = pgTable(
  'entregas',
  {
    id: serial('id').primaryKey(),
    pedidoId: integer('pedido_id')
      .notNull()
      .unique()
      .references(() => pedidos.id, { onDelete: 'cascade' }),
    modalidad: text('modalidad').notNull(),
    estado: text('estado').notNull().default('por_programar'),
    fechaProgramada: timestamp('fecha_programada', { withTimezone: true }),
    franja: text('franja').notNull().default(''),
    direccion: text('direccion').notNull().default(''),
    ciudad: text('ciudad').notNull().default(''),
    recibe: text('recibe').notNull().default(''),
    telefono: text('telefono').notNull().default(''),
    /** mensajero | tercero */
    quienLleva: text('quien_lleva'),
    mensajeroId: integer('mensajero_id').references(() => usuarios.id),
    servicioTercero: text('servicio_tercero').notNull().default(''),
    transportadora: text('transportadora').notNull().default(''),
    guia: text('guia').notNull().default(''),
    costoCobrado: integer('costo_cobrado').notNull().default(0),
    costoReal: integer('costo_real'),
    contraentrega: boolean('contraentrega').notNull().default(false),
    montoContraentrega: integer('monto_contraentrega').notNull().default(0),
    evidenciaUrl: text('evidencia_url'),
    novedad: text('novedad').notNull().default(''),
    recibidoPor: text('recibido_por').notNull().default(''),
    salioEn: timestamp('salio_en', { withTimezone: true }),
    entregadaEn: timestamp('entregada_en', { withTimezone: true }),
    notas: text('notas').notNull().default(''),
    creadoEn: creadoEn(),
    actualizadoEn: actualizadoEn(),
  },
  (t) => [index('entregas_estado_idx').on(t.estado)]
)

/** Quién cambió qué y cuándo (también las notas del pedido). */
export const historialEstados = pgTable(
  'historial_estados',
  {
    id: serial('id').primaryKey(),
    /** pedido | orden */
    entidad: text('entidad').notNull(),
    entidadId: integer('entidad_id').notNull(),
    de: text('de'),
    a: text('a'),
    nota: text('nota').notNull().default(''),
    visibleCliente: boolean('visible_cliente').notNull().default(false),
    usuarioId: integer('usuario_id').references(() => usuarios.id),
    creadoEn: creadoEn(),
  },
  (t) => [index('historial_entidad_idx').on(t.entidad, t.entidadId)]
)

export type Usuario = typeof usuarios.$inferSelect
