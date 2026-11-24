/** "2026-11-24" → "24 de noviembre de 2026" */
export const fechaCuenta = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
