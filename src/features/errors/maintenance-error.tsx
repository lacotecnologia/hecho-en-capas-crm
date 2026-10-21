import { PaginaError } from './pagina-error'

export function MaintenanceError() {
  return (
    <PaginaError
      codigo='503'
      titulo='Estamos haciendo mejoras'
      explicacion='El sistema vuelve en unos minutos. Gracias por la paciencia.'
    />
  )
}
