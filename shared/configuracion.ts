/**
 * Valores del negocio que el Admin puede cambiar desde Configuración.
 * Cada valor trae su explicación en lenguaje sencillo, la unidad y un
 * rango permitido, para que la pantalla no obligue a nadie a adivinar.
 */
export type CampoConfig = {
  clave: string
  grupo: GrupoConfig
  etiqueta: string
  ayuda: string
  unidad: 'COP' | 'COP/kWh' | 'COP/hora' | '%' | 'días'
  porDefecto: number
  min: number
  max: number
}

export const GRUPOS_CONFIG = {
  costos: 'Costos de fabricación',
  precios: 'Márgenes y precios',
  cotizaciones: 'Cotizaciones y anticipos',
  envios: 'Tiempos de envío',
} as const

export type GrupoConfig = keyof typeof GRUPOS_CONFIG

export const CAMPOS_CONFIG: CampoConfig[] = [
  {
    clave: 'tarifa_kwh',
    grupo: 'costos',
    etiqueta: 'Precio de la luz',
    ayuda: 'Lo que cobra la empresa de energía por cada kWh. Está en la factura.',
    unidad: 'COP/kWh',
    porDefecto: 836,
    min: 0,
    max: 5000,
  },
  {
    clave: 'tarifa_hora_mano_obra',
    grupo: 'costos',
    etiqueta: 'Valor de una hora de trabajo',
    ayuda: 'Para preparar la cama, retirar piezas, limpiar soportes y empacar.',
    unidad: 'COP/hora',
    porDefecto: 15000,
    min: 0,
    max: 500000,
  },
  {
    clave: 'tarifa_hora_diseno',
    grupo: 'costos',
    etiqueta: 'Valor de una hora de diseño',
    ayuda: 'Solo se cobra en productos personalizados.',
    unidad: 'COP/hora',
    porDefecto: 15000,
    min: 0,
    max: 500000,
  },
  {
    clave: 'porcentaje_falla',
    grupo: 'costos',
    etiqueta: 'Colchón por impresiones fallidas',
    ayuda: 'Se suma al costo para cubrir piezas que toca reimprimir.',
    unidad: '%',
    porDefecto: 8,
    min: 0,
    max: 50,
  },
  {
    clave: 'empaque_por_defecto',
    grupo: 'costos',
    etiqueta: 'Costo de empaque por unidad',
    ayuda: 'Valor que se pone solo al crear un producto. Se puede cambiar en cada uno.',
    unidad: 'COP',
    porDefecto: 300,
    min: 0,
    max: 100000,
  },
  {
    clave: 'margen_fabrica_bajo',
    grupo: 'precios',
    etiqueta: 'Margen de fábrica (opción baja)',
    ayuda: 'Una de las dos opciones que el taller elige al poner precio a un producto.',
    unidad: '%',
    porDefecto: 40,
    min: 0,
    max: 300,
  },
  {
    clave: 'margen_fabrica_alto',
    grupo: 'precios',
    etiqueta: 'Margen de fábrica (opción alta)',
    ayuda: 'La otra opción. Es la que viene marcada por defecto.',
    unidad: '%',
    porDefecto: 50,
    min: 0,
    max: 300,
  },
  {
    clave: 'tope_comercial',
    grupo: 'precios',
    etiqueta: 'Lo máximo que el comercial puede subir',
    ayuda: 'Sobre el precio de fábrica. Esa diferencia es la ganancia del comercial.',
    unidad: '%',
    porDefecto: 25,
    min: 0,
    max: 300,
  },
  {
    clave: 'anticipo_personalizados',
    grupo: 'cotizaciones',
    etiqueta: 'Anticipo en productos personalizados',
    ayuda: 'Sin este anticipo, un pedido personalizado no entra a la cola de impresión.',
    unidad: '%',
    porDefecto: 50,
    min: 0,
    max: 100,
  },
  {
    clave: 'vigencia_cotizacion_dias',
    grupo: 'cotizaciones',
    etiqueta: 'Días que dura una cotización',
    ayuda: 'Pasado este tiempo, la cotización queda vencida sola.',
    unidad: 'días',
    porDefecto: 10,
    min: 1,
    max: 90,
  },
  {
    clave: 'dias_envio_local',
    grupo: 'envios',
    etiqueta: 'Domicilio en Pereira y área metropolitana',
    ayuda: 'Días que se suman a la fecha de entrega.',
    unidad: 'días',
    porDefecto: 1,
    min: 0,
    max: 30,
  },
  {
    clave: 'dias_envio_nacional',
    grupo: 'envios',
    etiqueta: 'Envío nacional con transportadora',
    ayuda: 'Días hábiles que se suman a la fecha de entrega.',
    unidad: 'días',
    porDefecto: 5,
    min: 0,
    max: 30,
  },
]

export type ValoresConfig = Record<string, number>

export function valoresPorDefecto(): ValoresConfig {
  return Object.fromEntries(CAMPOS_CONFIG.map((c) => [c.clave, c.porDefecto]))
}
