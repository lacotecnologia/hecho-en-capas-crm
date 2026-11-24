import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type CotizacionDetalle } from '@shared/cotizacion'
import { CheckCircle2, Download, Loader2 } from 'lucide-react'
import { enPractica, esModoPrueba } from '@/lib/practica'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { consultaTextosNegocio } from '@/features/configuracion/api'
import { dibujarPaginas } from './dibujar-pdf'

type Props = {
  cotizacion: CotizacionDetalle | null
  onCerrar: () => void
  /** Si se pasa, aparece el botón para marcarla como enviada. */
  onMarcarEnviada?: () => void
  marcando?: boolean
}

export function VistaPdf({
  cotizacion,
  onCerrar,
  onMarcarEnviada,
  marcando,
}: Props) {
  const { data: textos } = useQuery(consultaTextosNegocio)
  const contenedor = useRef<HTMLDivElement>(null)
  // Resultado del último PDF armado; "para" dice de qué cotización es.
  const [resultado, setResultado] = useState<{
    para: CotizacionDetalle
    url?: string
    error?: string
  } | null>(null)
  const listo = resultado && resultado.para === cotizacion ? resultado : null
  const url = listo?.url ?? null
  const error = listo?.error ?? null
  const cargando = !!cotizacion && !listo

  useEffect(() => {
    if (!cotizacion || !textos) return
    let cancelado = false
    let enlace: string | null = null
    ;(async () => {
      try {
        const { generarPdfCotizacion } = await import('./pdf-cotizacion')
        const blob = await generarPdfCotizacion(cotizacion, textos)
        if (cancelado) return
        enlace = URL.createObjectURL(blob)
        if (contenedor.current) await dibujarPaginas(blob, contenedor.current)
        if (!cancelado) setResultado({ para: cotizacion, url: enlace })
      } catch (e) {
        console.error(e) // eslint-disable-line no-console
        if (!cancelado)
          setResultado({
            para: cotizacion,
            error: 'No se pudo armar el PDF. Intenta de nuevo.',
          })
      }
    })()
    return () => {
      cancelado = true
      if (enlace) URL.revokeObjectURL(enlace)
    }
  }, [cotizacion, textos])

  return (
    <Dialog open={!!cotizacion} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='flex max-h-[94svh] flex-col gap-4 sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>PDF de {cotizacion?.codigo}</DialogTitle>
          <DialogDescription>
            Así lo verá el cliente. No muestra el precio de fábrica ni tu
            ganancia.
          </DialogDescription>
        </DialogHeader>
        <div className='-mx-1 min-h-40 flex-1 overflow-y-auto px-1'>
          {cargando && (
            <p className='flex items-center justify-center gap-2 py-16 text-muted-foreground'>
              <Loader2 className='animate-spin' /> Armando el PDF…
            </p>
          )}
          {error && (
            <p className='py-10 text-center font-medium text-destructive'>
              {error}
            </p>
          )}
          <div ref={contenedor} className='grid gap-4' />
        </div>
        <DialogFooter className='flex-wrap gap-2'>
          {esModoPrueba() ? (
            <p className='me-auto self-center text-sm text-muted-foreground'>
              {enPractica()
                ? 'En la práctica no se descarga. En el sistema real aquí lo descargas o lo compartes por WhatsApp.'
                : 'En la versión de prueba no se descarga; en el sistema real sí.'}
            </p>
          ) : (
            <Button variant='outline' asChild disabled={!url}>
              <a
                href={url ?? undefined}
                download={`${cotizacion?.codigo ?? 'cotizacion'}.pdf`}
              >
                <Download /> Descargar PDF
              </a>
            </Button>
          )}
          {onMarcarEnviada && (
            <Button
              data-tour='ya-envie'
              onClick={onMarcarEnviada}
              disabled={!url || marcando}
            >
              {marcando ? (
                <Loader2 className='animate-spin' />
              ) : (
                <CheckCircle2 />
              )}
              Ya se la envié al cliente
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
