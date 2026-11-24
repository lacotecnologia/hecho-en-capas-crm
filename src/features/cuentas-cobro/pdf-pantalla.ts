import { type RefObject, useEffect, useState } from 'react'
import { type CuentaPublica } from '@shared/cuenta-cobro'
import { dibujarPaginas } from '@/features/cotizar/dibujar-pdf'

/**
 * Arma el PDF de la cuenta de cobro y lo dibuja en el contenedor
 * (se ve igual en celular y computador). Devuelve el enlace para descargarlo.
 */
export function usePdfCuenta(
  cuenta: CuentaPublica | null | undefined,
  contenedor: RefObject<HTMLDivElement | null>
) {
  const [resultado, setResultado] = useState<{
    para: CuentaPublica
    url?: string
    error?: string
  } | null>(null)
  const listo = cuenta && resultado?.para === cuenta ? resultado : null

  useEffect(() => {
    if (!cuenta) return
    let cancelado = false
    let enlace: string | null = null
    ;(async () => {
      try {
        const { generarPdfCuenta } = await import('./pdf-cuenta')
        const blob = await generarPdfCuenta(cuenta)
        if (cancelado) return
        enlace = URL.createObjectURL(blob)
        if (contenedor.current) await dibujarPaginas(blob, contenedor.current)
        if (!cancelado) setResultado({ para: cuenta, url: enlace })
      } catch (e) {
        console.error(e) // eslint-disable-line no-console
        if (!cancelado)
          setResultado({
            para: cuenta,
            error: 'No se pudo armar el PDF. Recarga la página e intenta de nuevo.',
          })
      }
    })()
    return () => {
      cancelado = true
      if (enlace) URL.revokeObjectURL(enlace)
    }
  }, [cuenta, contenedor])

  return {
    url: listo?.url ?? null,
    error: listo?.error ?? null,
    cargando: !!cuenta && !listo,
  }
}
