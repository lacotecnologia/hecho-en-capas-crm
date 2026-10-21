import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ROLES } from '@shared/roles'
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { actualizarPersona, crearPersona, type Persona } from './api'
import { SelectorRoles } from './selector-roles'

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre de la persona.'),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,30}$/,
      'De 3 a 30 letras o números, sin espacios ni tildes. Ejemplo: ana o ana.m'
    ),
  pin: z.string(),
  roles: z.array(z.enum(ROLES)).min(1, 'Elige al menos un rol.'),
})

type Datos = z.infer<typeof esquema>

type DialogoPersonaProps = {
  abierto: boolean
  onCerrar: () => void
  /** Si viene una persona, se edita; si no, se crea una nueva. */
  persona?: Persona | null
}

export function DialogoPersona({
  abierto,
  onCerrar,
  persona,
}: DialogoPersonaProps) {
  const editando = !!persona
  const queryClient = useQueryClient()

  const form = useForm<Datos>({
    resolver: zodResolver(
      esquema.refine((d) => editando || /^\d{4,6}$/.test(d.pin), {
        path: ['pin'],
        message: 'El PIN debe tener de 4 a 6 números.',
      })
    ),
    defaultValues: { nombre: '', usuario: '', pin: '', roles: [] },
  })

  useEffect(() => {
    if (abierto) {
      form.reset({
        nombre: persona?.nombre ?? '',
        usuario: persona?.usuario ?? '',
        pin: '',
        roles: persona?.roles ?? [],
      })
    }
  }, [abierto, persona, form])

  const guardar = useMutation({
    mutationFn: (datos: Datos) =>
      editando
        ? actualizarPersona(persona.id, {
            nombre: datos.nombre,
            roles: datos.roles,
          })
        : crearPersona(datos),
    onSuccess: (_r, datos) => {
      queryClient.invalidateQueries({ queryKey: ['personas'] })
      queryClient.invalidateQueries({ queryKey: ['sesion'] })
      toast.success(
        editando
          ? `Cambios guardados para ${datos.nombre}.`
          : `${datos.nombre} ya puede entrar con el usuario "${datos.usuario}" y su PIN.`
      )
      onCerrar()
    },
  })

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {editando ? `Editar a ${persona.nombre}` : 'Agregar una persona'}
          </DialogTitle>
          <DialogDescription>
            {editando
              ? 'Cambia el nombre o lo que puede hacer en el sistema.'
              : 'Crea el acceso de alguien de la familia o del equipo.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            id='form-persona'
            onSubmit={form.handleSubmit((d) => guardar.mutate(d))}
            className='grid gap-5'
          >
            <FormField
              control={form.control}
              name='nombre'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder='Ejemplo: Ana María' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='usuario'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Usuario para entrar</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Ejemplo: ana'
                      autoCapitalize='none'
                      autoCorrect='off'
                      spellCheck={false}
                      disabled={editando}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {editando
                      ? 'El usuario no se puede cambiar.'
                      : 'Corto y fácil de recordar. Sin espacios ni tildes.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!editando && (
              <FormField
                control={form.control}
                name='pin'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIN</FormLabel>
                    <FormControl>
                      <Input
                        inputMode='numeric'
                        maxLength={6}
                        placeholder='Ejemplo: 4821'
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.replace(/\D/g, ''))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      De 4 a 6 números. Díselo a la persona en privado.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name='roles'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Qué puede hacer?</FormLabel>
                  <FormDescription>Puedes marcar más de uno.</FormDescription>
                  <SelectorRoles
                    valor={field.value}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button variant='outline' onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            type='submit'
            form='form-persona'
            disabled={guardar.isPending}
          >
            {guardar.isPending && <Loader2 className='animate-spin' />}
            {editando ? 'Guardar cambios' : 'Crear acceso'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
