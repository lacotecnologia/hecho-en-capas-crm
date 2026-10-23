import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { NOMBRES_PAPELERA, type TipoPapelera } from '@shared/papelera'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { mensajeDeError } from '@/lib/api'
import { tieneRol, useSesion } from '@/lib/sesion'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { borrar, HAY_PAPELERA } from '@/features/papelera/api'

/**
 * "Borrar" para el administrador: lo manda a la Papelera (no se pierde).
 * Para las demás personas no aparece.
 */
export function BotonBorrar({
  tipo,
  id,
  nombre,
  onBorrado,
  variante = 'outline',
  className,
}: {
  tipo: TipoPapelera
  id: number
  /** Cómo se llama lo que se borra, ej. "PED-2026-0004". */
  nombre: string
  onBorrado?: () => void
  variante?: 'outline' | 'ghost'
  className?: string
}) {
  const usuario = useSesion()
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const quien = NOMBRES_PAPELERA[tipo]

  const accion = useMutation({
    mutationFn: () => borrar(tipo, id),
    onSuccess: async () => {
      // Todo queda desactualizado, pero se recarga después de salir de la
      // pantalla de lo borrado (si no, esa pantalla pediría algo que ya no está).
      await queryClient.invalidateQueries({ refetchType: 'none' })
      toast.success(
        `Listo: ${nombre} quedó en la Papelera. Desde ahí lo puedes recuperar.`
      )
      setAbierto(false)
      onBorrado?.()
      setTimeout(
        () => queryClient.refetchQueries({ type: 'active', stale: true }),
        300
      )
    },
    onError: (e) => setError(mensajeDeError(e)),
  })

  if (!HAY_PAPELERA || !tieneRol(usuario, ['admin'])) return null

  return (
    <>
      <Button
        type='button'
        variant={variante}
        className={className ?? 'text-destructive hover:text-destructive'}
        onClick={() => {
          setError(null)
          setAbierto(true)
        }}
      >
        <Trash2 /> Borrar
      </Button>
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Borrar {quien.articulo} {quien.singular} {nombre}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Desaparece de las listas, pero no se pierde: queda en la Papelera
              (Administración → Papelera) y lo puedes recuperar cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p
              role='alert'
              className='rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive'
            >
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>No, dejarlo</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={accion.isPending}
              onClick={() => accion.mutate()}
            >
              {accion.isPending ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Trash2 />
              )}
              Sí, mandar a la Papelera
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
