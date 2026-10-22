/** Lo que le toca hoy a cada persona, para la pantalla de Inicio. */
export type Pendiente = {
  texto: string
  cantidad: number
  url: string
  /** urgente = algo que ya se pasó o vence hoy */
  tono: 'urgente' | 'normal'
}
