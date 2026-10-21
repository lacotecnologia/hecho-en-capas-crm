/**
 * Llamadas a la API propia (/api/...). La sesión viaja en una cookie
 * httpOnly, así que aquí no se maneja ningún token.
 */
export class ApiError extends Error {
  status: number
  campo?: string

  constructor(status: number, mensaje: string, campo?: string) {
    super(mensaje)
    this.status = status
    this.campo = campo
  }
}

type Opciones = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export async function api<T>(
  ruta: string,
  opciones: Opciones = {}
): Promise<T> {
  if (import.meta.env.VITE_DEMO === '1') {
    const { apiDemo } = await import('@/demo/api-demo')
    return apiDemo<T>(
      ruta,
      opciones.method ?? 'GET',
      opciones.body as Record<string, unknown> | undefined
    )
  }
  let respuesta: Response
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: opciones.method ?? 'GET',
      credentials: 'same-origin',
      headers:
        opciones.body !== undefined
          ? { 'content-type': 'application/json' }
          : undefined,
      body:
        opciones.body !== undefined ? JSON.stringify(opciones.body) : undefined,
    })
  } catch {
    throw new ApiError(
      0,
      'No hay conexión con el servidor. Revisa el internet e intenta de nuevo.'
    )
  }

  const datos = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    throw new ApiError(
      respuesta.status,
      datos?.mensaje ?? 'Algo salió mal. Intenta de nuevo.',
      datos?.campo
    )
  }
  return datos as T
}

export function mensajeDeError(error: unknown) {
  if (error instanceof ApiError) return error.message
  return 'Algo salió mal. Intenta de nuevo.'
}
