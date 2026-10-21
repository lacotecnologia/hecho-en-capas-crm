import { PaginaError } from './pagina-error'

type GeneralErrorProps = { minimal?: boolean; className?: string }

export function GeneralError({ minimal, className }: GeneralErrorProps) {
  return (
    <PaginaError
      codigo='500'
      titulo='Algo salió mal'
      explicacion='No es culpa tuya. Intenta de nuevo en un momento; si sigue pasando, avisa al administrador.'
      minimal={minimal}
      className={className}
    />
  )
}
