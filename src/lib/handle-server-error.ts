import { toast } from 'sonner'
import { mensajeDeError } from './api'

/** Muestra el error del servidor en un aviso, en palabras sencillas. */
export function handleServerError(error: unknown) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(error)
  }
  toast.error(mensajeDeError(error))
}
