import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  estadoEnvio,
  mensajeCuenta,
  rutaPublicaCuenta,
  validarMotivoAnulacion,
} from '@shared/cuenta-cobro'
import {
  Ban,
  Copy,
  Download,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { mensajeDeError } from '@/lib/api'
import { esModoPrueba } from '@/lib/practica'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Campo } from '@/components/campo'
import { enlaceWhatsapp } from '@/features/entregas/entrega'
import { formatoDiaHora } from '@/features/pedidos/fechas'
import { anularCuenta, consultaCuenta, marcarEnviada } from './api'
import { EstadoCuentaBadge, PasosEnvio } from './estado'
import { usePdfCuenta } from './pdf-pantalla'

/** Ver una cuenta de cobro: PDF, enviarla por WhatsApp, copiar el enlace o anularla. */
export function VistaCuenta({
  id,
  onCerrar,
}: {
  id: number | null
  onCerrar: () => void
}) {
  const queryClient = useQueryClient()
  const { data, isError, error } = useQuery({
    ...consultaCuenta(id ?? 0),
    enabled: id !== null,
  })
  const cuenta = id !== null ? data?.cuenta : undefined
  const contenedor = useRef<HTMLDivElement>(null)
  const pdf = usePdfCuenta(cuenta, contenedor)
  const [anulando, setAnulando] = useState(false)

  const refrescar = () =>
    queryClient.invalidateQueries({ queryKey: ['cuentas-cobro'] })

  const enviada = useMutation({
    mutationFn: () => marcarEnviada(id!),
    onSuccess: refrescar,
  })

  const enlace = cuenta
    ? `${window.location.origin}${rutaPublicaCuenta(cuenta.token)}`
    : ''
  const whatsapp = data?.whatsapp ?? ''
  const anulada = cuenta?.estado === 'anulada'

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace)
      toast.success('Enlace copiado. Pégalo en el chat del cliente.')
      enviada.mutate()
    } catch {
      toast.error('No se pudo copiar. Mantén presionado el enlace y cópialo a mano.')
    }
  }

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='flex max-h-[94svh] flex-col gap-4 sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle className='flex flex-wrap items-center gap-2'>
            Cuenta de cobro {cuenta?.codigo}
            {cuenta && (
              <EstadoCuentaBadge
                estado={cuenta.estado}
                envio={estadoEnvio(cuenta)}
              />
            )}
          </DialogTitle>
          <DialogDescription>
            {cuenta
              ? `A nombre de ${cuenta.pagador.nombre} · pedido ${cuenta.pedido.codigo}`
              : 'Cargando…'}
          </DialogDescription>
        </DialogHeader>

        <div className='-mx-1 grid min-h-40 flex-1 content-start gap-4 overflow-y-auto px-1'>
          {isError && (
            <p className='py-10 text-center font-medium text-destructive'>
              {mensajeDeError(error)}
            </p>
          )}
          {cuenta && anulada && (
            <p className='rounded-lg bg-destructive/10 p-3 text-sm'>
              <strong>Anulada</strong>
              {cuenta.anuladaEn ? ` el ${formatoDiaHora(cuenta.anuladaEn)}` : ''}
              : {cuenta.motivoAnulacion}. Si el cliente abre el enlace, verá que
              fue anulada.
            </p>
          )}
          {cuenta && !anulada && (
            <div className='grid gap-2'>
              <div className='sm:hidden'>
                <PasosEnvio {...cuenta} angosto />
              </div>
              <div className='hidden sm:block'>
                <PasosEnvio {...cuenta} />
              </div>
              {!cuenta.enviadaEn && (
                <p className='text-sm text-muted-foreground'>
                  Mándale el enlace al cliente. Cuando lo abra quedará
                  “Recibida”, y cuando la descargue, “Aceptada”.
                </p>
              )}
            </div>
          )}
          {anulando && cuenta && (
            <FormAnular
              id={cuenta.id}
              onListo={() => {
                setAnulando(false)
                refrescar()
              }}
              onCancelar={() => setAnulando(false)}
            />
          )}
          {pdf.cargando && (
            <p className='flex items-center justify-center gap-2 py-16 text-muted-foreground'>
              <Loader2 className='animate-spin' /> Armando el PDF…
            </p>
          )}
          {pdf.error && (
            <p className='py-10 text-center font-medium text-destructive'>
              {pdf.error}
            </p>
          )}
          <div ref={contenedor} className='grid gap-4' />
        </div>

        {cuenta && !anulando && (
          <DialogFooter className='flex-wrap gap-2 sm:justify-between'>
            {!anulada ? (
              <Button
                variant='ghost'
                className='text-destructive sm:me-auto'
                onClick={() => setAnulando(true)}
              >
                <Ban /> Anular
              </Button>
            ) : (
              <span />
            )}
            <div className='flex flex-wrap gap-2'>
              {!esModoPrueba() && (
                <Button variant='outline' asChild disabled={!pdf.url}>
                  <a href={pdf.url ?? undefined} download={`${cuenta.codigo}.pdf`}>
                    <Download /> Descargar PDF
                  </a>
                </Button>
              )}
              {!anulada && (
                <>
                  <Button variant='outline' onClick={copiar}>
                    <Copy /> Copiar enlace
                  </Button>
                  {whatsapp ? (
                    <Button asChild>
                      <a
                        href={enlaceWhatsapp(whatsapp, mensajeCuenta(cuenta, enlace))}
                        target='_blank'
                        rel='noreferrer'
                        onClick={() => enviada.mutate()}
                      >
                        <MessageCircle /> Enviar por WhatsApp
                      </a>
                    </Button>
                  ) : (
                    <p className='self-center text-sm text-muted-foreground'>
                      El cliente no tiene WhatsApp guardado: copia el enlace.
                    </p>
                  )}
                </>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormAnular({
  id,
  onListo,
  onCancelar,
}: {
  id: number
  onListo: () => void
  onCancelar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const anular = useMutation({
    mutationFn: () => anularCuenta(id, motivo),
    onSuccess: () => {
      toast.success('Cuenta de cobro anulada. Ya puedes hacer una nueva desde el pedido.')
      onListo()
    },
    onError: (e) => setAviso(mensajeDeError(e)),
  })
  return (
    <form
      className='grid gap-3 rounded-lg border border-destructive/40 p-3'
      onSubmit={(e) => {
        e.preventDefault()
        const v = validarMotivoAnulacion(motivo)
        if (!v.ok) return setAviso(v.mensaje)
        anular.mutate()
      }}
    >
      <Campo
        etiqueta='¿Por qué se anula?'
        ayuda='El número no se vuelve a usar. Después puedes hacer una nueva con los datos bien.'
        error={aviso ?? undefined}
      >
        {(idCampo, ayuda) => (
          <Textarea
            id={idCampo}
            aria-describedby={ayuda}
            value={motivo}
            rows={2}
            placeholder='Ej. el NIT del cliente estaba mal'
            onChange={(e) => {
              setMotivo(e.target.value)
              setAviso(null)
            }}
          />
        )}
      </Campo>
      <div className='flex flex-wrap justify-end gap-2'>
        <Button type='button' variant='ghost' onClick={onCancelar}>
          No anular
        </Button>
        <Button type='submit' variant='destructive' disabled={anular.isPending}>
          {anular.isPending ? <Loader2 className='animate-spin' /> : <Ban />}
          Anular cuenta de cobro
        </Button>
      </div>
    </form>
  )
}
