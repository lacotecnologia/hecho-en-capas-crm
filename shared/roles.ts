/**
 * Roles del sistema. Se comparten entre el servidor y la pantalla.
 * Los textos están en lenguaje sencillo porque se muestran al usuario.
 */
export const ROLES = ['admin', 'comercial', 'fabricacion', 'entregas'] as const

export type Rol = (typeof ROLES)[number]

export const ROLES_INFO: Record<Rol, { nombre: string; descripcion: string }> =
  {
    admin: {
      nombre: 'Administrador',
      descripcion:
        'Ve y cambia todo: personas, valores del negocio, reembolsos y reportes.',
    },
    comercial: {
      nombre: 'Comercial',
      descripcion:
        'Hace cotizaciones, convierte pedidos, registra pagos y programa entregas.',
    },
    fabricacion: {
      nombre: 'Taller',
      descripcion:
        'Sube productos, calcula el precio de fábrica y maneja la cola de impresión.',
    },
    entregas: {
      nombre: 'Entregas',
      descripcion:
        'Ve las entregas del día, las marca como entregadas y cobra contra entrega.',
    },
  }

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor)
}
