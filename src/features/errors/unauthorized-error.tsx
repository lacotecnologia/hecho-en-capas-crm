import { PaginaError } from './pagina-error'

export function UnauthorisedError() {
  return (
    <PaginaError
      codigo='401'
      titulo='Necesitas ingresar'
      explicacion='Tu sesión terminó. Ingresa de nuevo con tu usuario y tu PIN.'
    />
  )
}
