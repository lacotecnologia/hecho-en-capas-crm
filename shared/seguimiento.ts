/**
 * Seguimiento público: lo que ve el cliente con su código HC-…, sin login.
 * Solo datos pensados para el cliente: nada de costos, ganancias ni notas internas.
 */
import { type Modalidad } from './cotizacion.js'
import { type EstadoEntrega } from './entregas.js'
import { type EstadoPedido } from './pedidos.js'

export type EstadoLineaCliente = 'esperando' | 'fabricando' | 'listo'

export type SeguimientoPublico = {
  codigo: string
  seguimiento: string
  /** Solo el primer nombre (o el nombre del negocio). */
  cliente: string
  estado: EstadoPedido
  fechaCompromiso: string | null
  modalidad: Modalidad
  lineas: { nombre: string; cantidad: number; imagen: string | null; estado: EstadoLineaCliente }[]
  entrega: {
    estado: EstadoEntrega
    fechaProgramada: string | null
    franja: string
    transportadora: string
    guia: string
    recibidoPor: string
    entregadaEn: string | null
  } | null
  dinero: { total: number; pagado: number; falta: number; anticipoPendiente: number }
  eventos: { fecha: string; texto: string }[]
  negocio: { whatsapp: string; email: string; ciudad: string; datosPago: string }
}

/** Lo que dice cada estado, en palabras para el cliente. */
export const ESTADO_PARA_CLIENTE: Record<EstadoPedido, { titulo: string; texto: string }> = {
  confirmado: {
    titulo: 'Recibimos tu pedido',
    texto: 'Empezamos a fabricarlo en cuanto recibamos el anticipo.',
  },
  en_produccion: {
    titulo: 'Lo estamos fabricando',
    texto: 'Tu pedido está en nuestras impresoras 3D.',
  },
  listo: { titulo: '¡Tu pedido está listo!', texto: 'Ya está impreso y empacado. Pronto coordinamos la entrega.' },
  en_entrega: { titulo: 'Va en camino', texto: 'Tu pedido ya tiene fecha de entrega.' },
  entregado: { titulo: 'Entregado', texto: 'Tu pedido ya fue entregado. ¡Gracias!' },
  cerrado: { titulo: '¡Pedido completo!', texto: 'Entregado y pagado. Gracias por confiar en Hecho en Capas.' },
  cancelado: { titulo: 'Pedido cancelado', texto: 'Este pedido se canceló. Si tienes dudas, escríbenos.' },
}

/** Pasos que ve el cliente. */
export const PASOS_CLIENTE: { estado: EstadoPedido; nombre: string }[] = [
  { estado: 'confirmado', nombre: 'Recibido' },
  { estado: 'en_produccion', nombre: 'Fabricando' },
  { estado: 'listo', nombre: 'Listo' },
  { estado: 'en_entrega', nombre: 'En camino' },
  { estado: 'entregado', nombre: 'Entregado' },
]

/** Convierte un evento del historial (visible para el cliente) en una frase para él. */
export function textoEventoCliente(e: { de: string | null; a: string | null; nota: string }) {
  if (e.a) {
    const info = ESTADO_PARA_CLIENTE[e.a as EstadoPedido]
    if (e.a === 'cancelado' && e.nota) return `${info.titulo}: ${e.nota}`
    return info?.titulo ?? null
  }
  if (e.nota.startsWith('Novedad en la entrega:')) {
    return `${e.nota.replace('. Hay que volver a programarla.', '')}. Te contactaremos para coordinar otra vez.`
  }
  return e.nota || null
}

/** Acepta "hc-7k4p2q", "7K4P2Q" o "HC 7K4P2Q" y devuelve "HC-7K4P2Q". */
export function normalizarCodigo(texto: string) {
  const limpio = texto.toUpperCase().replace(/[^0-9A-Z]/g, '')
  const sinPrefijo = limpio.startsWith('HC') && limpio.length === 8 ? limpio.slice(2) : limpio
  return /^[2-9A-Z]{6}$/.test(sinPrefijo) ? `HC-${sinPrefijo}` : null
}
