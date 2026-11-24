import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  type CuentaCobro,
  type CuentasDelPedido,
  enLetras,
  type Pagador,
  type TipoDocumento,
  TIPOS_DOCUMENTO,
  validarNuevaCuenta,
} from '@shared/cuenta-cobro'
import { FileSignature, Loader2 } from 'lucide-react'
import { ApiError, mensajeDeError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Campo } from '@/components/campo'
import { formatoPesos } from '@/features/taller/formato'
import { hacerCuenta } from './api'
import { selectCls } from './estilos'

/** Formulario para hacer la cuenta de cobro de un pedido. */
export function HacerCuenta({
  abierto,
  pedido,
  datos,
  onCerrar,
  onHecha,
}: {
  abierto: boolean
  pedido: { id: number; codigo: string }
  datos: CuentasDelPedido
  onCerrar: () => void
  onHecha: (c: CuentaCobro) => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='flex max-h-[94svh] flex-col gap-4 sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Cuenta de cobro del pedido {pedido.codigo}</DialogTitle>
          <DialogDescription>
            Los productos, el total y tus datos salen solos del pedido y de
            Configuración. Solo revisa a nombre de quién va.
          </DialogDescription>
        </DialogHeader>
        {abierto && (
          <Formulario
            pedidoId={pedido.id}
            datos={datos}
            onCerrar={onCerrar}
            onHecha={onHecha}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function Formulario({
  pedidoId,
  datos,
  onCerrar,
  onHecha,
}: {
  pedidoId: number
  datos: CuentasDelPedido
  onCerrar: () => void
  onHecha: (c: CuentaCobro) => void
}) {
  const queryClient = useQueryClient()
  const [pagador, setPagador] = useState<Pagador>(datos.sugerencia.pagador)
  const [concepto, setConcepto] = useState(datos.sugerencia.concepto)
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(
    null
  )
  const total = datos.sugerencia.total

  const cambiar = (c: Partial<Pagador>) => {
    setPagador((p) => ({ ...p, ...c }))
    setError(null)
  }

  const hacer = useMutation({
    mutationFn: () => hacerCuenta(pedidoId, pagador, concepto),
    onSuccess: ({ cuenta }) => {
      queryClient.invalidateQueries({ queryKey: ['cuentas-cobro'] })
      queryClient.invalidateQueries({ queryKey: ['pedido', pedidoId] })
      onHecha(cuenta)
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: mensajeDeError(e) }
      ),
  })

  const errorDe = (campo: string) =>
    error?.campo === campo ? error.mensaje : undefined

  return (
    <form
      className='-mx-1 grid gap-4 overflow-y-auto px-1'
      onSubmit={(e) => {
        e.preventDefault()
        const v = validarNuevaCuenta({ pagador, concepto })
        if (!v.ok) return setError({ mensaje: v.mensaje, campo: v.campo })
        hacer.mutate()
      }}
    >
      <Campo
        etiqueta='A nombre de'
        ayuda='La empresa o persona que paga, como aparece en su RUT.'
        error={errorDe('nombre')}
      >
        {(id, ayuda) => (
          <Input
            id={id}
            aria-describedby={ayuda}
            value={pagador.nombre}
            onChange={(e) => cambiar({ nombre: e.target.value })}
          />
        )}
      </Campo>
      <div className='grid gap-4 sm:grid-cols-[11rem_1fr]'>
        <Campo etiqueta='Tipo de documento'>
          {(id) => (
            <select
              id={id}
              className={selectCls}
              value={pagador.tipoDocumento}
              onChange={(e) =>
                cambiar({ tipoDocumento: e.target.value as TipoDocumento })
              }
            >
              {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo
          etiqueta={pagador.tipoDocumento === 'NIT' ? 'NIT' : 'Número'}
          ayuda={
            pagador.tipoDocumento === 'NIT'
              ? 'Con el dígito de verificación, ej. 900.123.456-7.'
              : 'Sin espacios.'
          }
          error={errorDe('documento')}
        >
          {(id, ayuda) => (
            <Input
              id={id}
              aria-describedby={ayuda}
              inputMode='numeric'
              value={pagador.documento}
              onChange={(e) => cambiar({ documento: e.target.value })}
            />
          )}
        </Campo>
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Campo
          etiqueta='Dirección'
          ayuda='Opcional.'
          error={errorDe('direccion')}
        >
          {(id, ayuda) => (
            <Input
              id={id}
              aria-describedby={ayuda}
              value={pagador.direccion}
              onChange={(e) => cambiar({ direccion: e.target.value })}
            />
          )}
        </Campo>
        <Campo etiqueta='Ciudad' ayuda='Opcional.'>
          {(id, ayuda) => (
            <Input
              id={id}
              aria-describedby={ayuda}
              value={pagador.ciudad}
              onChange={(e) => cambiar({ ciudad: e.target.value })}
            />
          )}
        </Campo>
      </div>
      <Campo
        etiqueta='Por concepto de'
        ayuda='Qué se cobra. Abajo del concepto salen los productos del pedido.'
        error={errorDe('concepto')}
      >
        {(id, ayuda) => (
          <Textarea
            id={id}
            aria-describedby={ayuda}
            rows={2}
            value={concepto}
            onChange={(e) => {
              setConcepto(e.target.value)
              setError(null)
            }}
          />
        )}
      </Campo>

      <div className='rounded-lg bg-muted/60 p-3'>
        <p className='text-xs tracking-wide text-muted-foreground uppercase'>
          La suma de
        </p>
        <p className='text-2xl font-bold tabular-nums'>{formatoPesos(total)}</p>
        <p className='text-sm'>{enLetras(total)}</p>
      </div>

      {error && !['nombre', 'documento', 'direccion', 'concepto'].includes(error.campo ?? '') && (
        <p className='text-sm font-medium text-destructive' role='alert'>
          {error.mensaje}
        </p>
      )}

      <DialogFooter className='gap-2'>
        <Button type='button' variant='ghost' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={hacer.isPending}>
          {hacer.isPending ? (
            <Loader2 className='animate-spin' />
          ) : (
            <FileSignature />
          )}
          Hacer cuenta de cobro
        </Button>
      </DialogFooter>
    </form>
  )
}
