import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Label } from '@/components/ui/label'
import { actualizarPersona, type Persona } from './api'

type DialogoPinProps = { persona: Persona | null; onCerrar: () => void }

export function DialogoPin({ persona, onCerrar }: DialogoPinProps) {
  const [pin, setPin] = useState('')
  const queryClient = useQueryClient()
  const valido = /^\d{4,6}$/.test(pin)

  const cambiar = useMutation({
    mutationFn: () => actualizarPersona(persona!.id, { pin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personas'] })
      toast.success(
        `Listo. ${persona!.nombre} ya puede entrar con el PIN nuevo.`
      )
      cerrar()
    },
  })

  const cerrar = () => {
    setPin('')
    onCerrar()
  }

  return (
    <Dialog open={!!persona} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Cambiar el PIN de {persona?.nombre}</DialogTitle>
          <DialogDescription>
            El PIN anterior deja de servir. Si estaba bloqueada, se desbloquea.
          </DialogDescription>
        </DialogHeader>
        <form
          id='form-pin'
          className='grid gap-2'
          onSubmit={(e) => {
            e.preventDefault()
            if (valido) cambiar.mutate()
          }}
        >
          <Label htmlFor='pin-nuevo'>PIN nuevo</Label>
          <Input
            id='pin-nuevo'
            inputMode='numeric'
            maxLength={6}
            placeholder='Ejemplo: 4821'
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            autoFocus
          />
          <p className='text-sm text-muted-foreground'>De 4 a 6 números.</p>
        </form>
        <DialogFooter>
          <Button variant='outline' onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            type='submit'
            form='form-pin'
            disabled={!valido || cambiar.isPending}
          >
            {cambiar.isPending && <Loader2 className='animate-spin' />}
            Guardar PIN nuevo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
