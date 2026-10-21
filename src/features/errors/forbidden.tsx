import { PaginaError } from './pagina-error'

export function ForbiddenError() {
  return (
    <PaginaError
      codigo='403'
      titulo='Esta sección no es para tu rol'
      explicacion='Si crees que deberías poder entrar, pídele al administrador que revise tus permisos en Personas.'
    />
  )
}
