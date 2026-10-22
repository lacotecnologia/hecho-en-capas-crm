const hora = new Intl.DateTimeFormat('es-CO', {
  hour: 'numeric',
  minute: '2-digit',
})
const diaCorto = new Intl.DateTimeFormat('es-CO', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
const diaHora = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

export const formatoHora = (d: string | Date) => hora.format(new Date(d))
export const formatoDiaCorto = (d: string | Date) =>
  diaCorto.format(new Date(d))
export const formatoDiaHora = (d: string | Date) => diaHora.format(new Date(d))

const inicioDelDia = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

/** "para hoy", "para mañana", "para el jue 29 oct", "atrasado 2 días" */
export function textoCompromiso(fecha: string | null) {
  if (!fecha) return null
  const dias = Math.round(
    (inicioDelDia(new Date(fecha)) - inicioDelDia(new Date())) / 86_400_000
  )
  if (dias < 0)
    return {
      texto: `atrasado ${-dias} ${dias === -1 ? 'día' : 'días'}`,
      tono: 'tarde' as const,
    }
  if (dias === 0) return { texto: 'para hoy', tono: 'pronto' as const }
  if (dias === 1) return { texto: 'para mañana', tono: 'pronto' as const }
  return { texto: `para el ${formatoDiaCorto(fecha)}`, tono: 'normal' as const }
}

/** "1 h 30 min", "45 min" */
export function textoHoras(horas: number) {
  const min = Math.round(horas * 60)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}
