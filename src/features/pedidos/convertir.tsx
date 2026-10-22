import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type CotizacionDetalle } from '@shared/cotizacion'
import { ClipboardList, Loader2, Package, Printer, Wallet } from 'lucide-react'
import { toast } from 'sonner'
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
import { formatoPesos } from '@/features/taller/formato'
import { convertirCotizacion } from './api'

/** Botón de la cotización aprobada: la vuelve pedido (o lleva al pedido). */
export function ConvertirEnPedido({
  cotizacion: c,
  puede,
}: {
  cotizacion: CotizacionDetalle
  puede: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)

  const convertir = useMutation({
    mutationFn: () => convertirCotizacion(c.id),
    onSuccess: ({ pedido }) => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] })
      queryClient.invalidateQueries({ queryKey: ['cola'] })
      queryClient.invalidateQueries({ queryKey: ['cotizacion', c.id] })
      queryClient.invalidateQueries({ queryKey: ['taller'] })
      toast.success(`Listo: se creó el pedido ${pedido.codigo}.`)
      navigate({ to: '/pedidos/$id', params: { id: String(pedido.id) } })
    },
    onError: (e) => {
      // Si ya existía, lleva directo al pedido
      if (e instanceof ApiError && e.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['cotizacion', c.id] })
      }
      toast.error(mensajeDeError(e))
      setAbierto(false)
    },
  })

  if (c.pedido) {
    return (
      <Button size='lg' asChild>
        <Link to='/pedidos/$id' params={{ id: String(c.pedido.id) }}>
          <ClipboardList /> Ver el pedido {c.pedido.codigo}
        </Link>
      </Button>
    )
  }
  if (!puede || c.estado !== 'aprobada') return null

  const personalizados = c.lineas.filter((l) => l.personalizado)
  return (
    <>
      <Button size='lg' onClick={() => setAbierto(true)}>
        <ClipboardList /> Convertir en pedido
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>¿Convertir en pedido?</DialogTitle>
            <DialogDescription>Esto es lo que va a pasar:</DialogDescription>
          </DialogHeader>
          <ul className='grid gap-3 text-sm'>
            <li className='flex gap-3'>
              <Package className='mt-0.5 size-4 shrink-0 text-primary' />
              Lo que ya esté impreso en stock se aparta para este cliente.
            </li>
            <li className='flex gap-3'>
              <Printer className='mt-0.5 size-4 shrink-0 text-primary' />
              Lo demás pasa a la cola de impresión del taller.
            </li>
            {personalizados.length > 0 && c.resumen.anticipo > 0 && (
              <li className='flex gap-3'>
                <Wallet className='mt-0.5 size-4 shrink-0 text-marca-naranja' />
                <span>
                  Lo personalizado (
                  {personalizados.map((l) => l.nombre).join(', ')}) espera el
                  anticipo de{' '}
                  <strong>{formatoPesos(c.resumen.anticipo)}</strong> antes de
                  imprimirse.
                </span>
              </li>
            )}
          </ul>
          <DialogFooter>
            <Button variant='outline' onClick={() => setAbierto(false)}>
              Todavía no
            </Button>
            <Button
              disabled={convertir.isPending}
              onClick={() => convertir.mutate()}
            >
              {convertir.isPending ? (
                <Loader2 className='animate-spin' />
              ) : (
                <ClipboardList />
              )}
              Sí, crear el pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
