import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Ban, CheckCircle2, Download, Loader2 } from 'lucide-react'
import { Logo } from '@/assets/logo'
import { mensajeDeError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatoPesos } from '@/features/taller/formato'
import { avisarDescarga, consultaCuentaPublica } from './api'
import { fechaCuenta } from './fechas'
import { usePdfCuenta } from './pdf-pantalla'

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-svh bg-muted/40'>
      <header className='border-b bg-background'>
        <div className='mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3'>
          <Logo />
          <span className='text-sm text-muted-foreground'>Cuenta de cobro</span>
        </div>
      </header>
      <main className='mx-auto grid max-w-2xl gap-4 px-4 py-6'>{children}</main>
      <footer className='mx-auto max-w-2xl px-4 pb-8 text-center text-xs text-muted-foreground'>
        Hecho en Capas · Impresión 3D
      </footer>
    </div>
  )
}

/** Lo que ve el cliente al abrir el enlace de WhatsApp. */
export function CuentaParaCliente({ token }: { token: string }) {
  const { data, isLoading, isError, error } = useQuery(consultaCuentaPublica(token))
  const cuenta = data && !data.anulada ? data.cuenta : null
  const contenedor = useRef<HTMLDivElement>(null)
  const pdf = usePdfCuenta(cuenta, contenedor)
  const [descargada, setDescargada] = useState(false)

  if (isLoading) {
    return (
      <Marco>
        <Skeleton className='h-40 w-full rounded-xl' />
        <Skeleton className='h-96 w-full rounded-xl' />
      </Marco>
    )
  }
  if (isError) {
    return (
      <Marco>
        <Card>
          <CardContent className='py-10 text-center'>
            <p className='font-medium'>{mensajeDeError(error)}</p>
          </CardContent>
        </Card>
      </Marco>
    )
  }
  if (data?.anulada) {
    return (
      <Marco>
        <Card>
          <CardContent className='grid justify-items-center gap-2 py-10 text-center'>
            <Ban className='size-10 text-destructive' />
            <p className='text-lg font-semibold'>
              La cuenta de cobro {data.codigo} fue anulada
            </p>
            <p className='max-w-sm text-sm text-muted-foreground'>
              Ya no es válida. Hecho en Capas te enviará la nueva por WhatsApp.
            </p>
          </CardContent>
        </Card>
      </Marco>
    )
  }
  if (!cuenta) return null

  const descargar = () => {
    if (!pdf.url) return
    // Se avisa que la descargó (queda aceptada) y se descarga igual si falla el aviso
    avisarDescarga(token).catch(() => undefined)
    const a = document.createElement('a')
    a.href = pdf.url
    a.download = `Cuenta de cobro ${cuenta.codigo}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setDescargada(true)
  }

  return (
    <Marco>
      <Card>
        <CardContent className='grid gap-4 pt-6'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <p className='text-sm text-muted-foreground'>
                Cuenta de cobro No. {cuenta.codigo} · {fechaCuenta(cuenta.fecha)}
              </p>
              <h1 className='text-xl font-bold'>{cuenta.pagador.nombre}</h1>
              <p className='text-sm text-muted-foreground'>
                Debe a {cuenta.cobrador.nombre}
              </p>
            </div>
            <div className='sm:text-end'>
              <p className='text-sm text-muted-foreground'>Total</p>
              <p className='text-2xl font-bold tabular-nums'>
                {formatoPesos(cuenta.total)}
              </p>
            </div>
          </div>
          <p className='text-sm'>{cuenta.concepto}</p>
          {descargada ? (
            <p className='flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm font-medium text-primary'>
              <CheckCircle2 className='size-5 shrink-0' />
              Listo, ya la tienes. Gracias: le avisamos a Hecho en Capas que la
              recibiste.
            </p>
          ) : null}
          <Button
            size='lg'
            className='h-12 text-base'
            onClick={descargar}
            disabled={!pdf.url}
          >
            {pdf.url ? <Download /> : <Loader2 className='animate-spin' />}
            {descargada ? 'Descargar otra vez' : 'Descargar PDF'}
          </Button>
          {!descargada && (
            <p className='-mt-2 text-center text-xs text-muted-foreground'>
              Al descargarla le confirmas a Hecho en Capas que la recibiste y
              la aceptas.
            </p>
          )}
        </CardContent>
      </Card>

      {pdf.cargando && (
        <p className='flex items-center justify-center gap-2 py-10 text-muted-foreground'>
          <Loader2 className='animate-spin' /> Armando el documento…
        </p>
      )}
      {pdf.error && (
        <p className='py-6 text-center font-medium text-destructive'>{pdf.error}</p>
      )}
      <div ref={contenedor} className='grid gap-4' />
    </Marco>
  )
}
