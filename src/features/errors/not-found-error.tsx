import { PaginaError } from './pagina-error'

export function NotFoundError() {
  return (
    <PaginaError
      codigo='404'
      titulo='No encontramos esta página'
      explicacion='Puede que la dirección esté mal escrita o que la página ya no exista.'
    />
  )
}
