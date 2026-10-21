import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ROLES_INFO } from '@shared/roles'
import {
  KeyRound,
  Lock,
  MoreVertical,
  Pencil,
  Power,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'
import { useSesion } from '@/lib/sesion'
import { iniciales } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pagina } from '@/components/layout/pagina'
import {
  actualizarPersona,
  consultaPersonas,
  estaBloqueada,
  type Persona,
} from './api'
import { DialogoPersona } from './dialogo-persona'
import { DialogoPin } from './dialogo-pin'

export function Personas() {
  const yo = useSesion()
  const queryClient = useQueryClient()
  const { data: personas, isLoading } = useQuery(consultaPersonas)

  const [formAbierto, setFormAbierto] = useState(false)
  const [editando, setEditando] = useState<Persona | null>(null)
  const [cambiandoPin, setCambiandoPin] = useState<Persona | null>(null)
  const [desactivando, setDesactivando] = useState<Persona | null>(null)

  const cambiar = useMutation({
    mutationFn: ({
      persona,
      cambios,
    }: {
      persona: Persona
      cambios: Parameters<typeof actualizarPersona>[1]
      aviso: string
    }) => actualizarPersona(persona.id, cambios),
    onSuccess: (_r, { aviso }) => {
      queryClient.invalidateQueries({ queryKey: ['personas'] })
      toast.success(aviso)
    },
  })

  return (
    <Pagina
      titulo='Personas'
      descripcion='Quién puede entrar al sistema y qué puede hacer cada uno.'
      acciones={
        <Button
          onClick={() => {
            setEditando(null)
            setFormAbierto(true)
          }}
        >
          <UserPlus />
          Agregar persona
        </Button>
      }
    >
      <div className='grid gap-3'>
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-20 w-full rounded-xl' />
          ))}

        {personas?.map((persona) => {
          const bloqueada = estaBloqueada(persona)
          const soyYo = persona.id === yo.id
          return (
            <Card
              key={persona.id}
              className={persona.activo ? '' : 'opacity-60'}
            >
              <CardContent className='flex flex-wrap items-center gap-4'>
                <Avatar className='size-11'>
                  <AvatarFallback className='bg-accent font-semibold text-primary'>
                    {iniciales(persona.nombre)}
                  </AvatarFallback>
                </Avatar>
                <div className='min-w-40 flex-1'>
                  <p className='font-semibold'>
                    {persona.nombre}
                    {soyYo && (
                      <span className='ms-2 text-sm font-normal text-muted-foreground'>
                        (tú)
                      </span>
                    )}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    Usuario: {persona.usuario}
                  </p>
                </div>
                <div className='flex flex-wrap gap-1.5'>
                  {persona.roles.map((rol) => (
                    <Badge key={rol} variant='secondary'>
                      {ROLES_INFO[rol].nombre}
                    </Badge>
                  ))}
                  {!persona.activo && (
                    <Badge variant='outline'>Sin acceso</Badge>
                  )}
                  {bloqueada && (
                    <Badge className='bg-marca-naranja text-white'>
                      <Lock /> Bloqueada
                    </Badge>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant='ghost'
                      size='icon'
                      aria-label={`Opciones para ${persona.nombre}`}
                    >
                      <MoreVertical />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuItem
                      onClick={() => {
                        setEditando(persona)
                        setFormAbierto(true)
                      }}
                    >
                      <Pencil /> Editar nombre y permisos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCambiandoPin(persona)}>
                      <KeyRound /> Cambiar PIN
                    </DropdownMenuItem>
                    {bloqueada && (
                      <DropdownMenuItem
                        onClick={() =>
                          cambiar.mutate({
                            persona,
                            cambios: { desbloquear: true },
                            aviso: `${persona.nombre} ya puede intentar entrar de nuevo.`,
                          })
                        }
                      >
                        <Lock /> Desbloquear
                      </DropdownMenuItem>
                    )}
                    {!soyYo && (
                      <>
                        <DropdownMenuSeparator />
                        {persona.activo ? (
                          <DropdownMenuItem
                            variant='destructive'
                            onClick={() => setDesactivando(persona)}
                          >
                            <Power /> Quitar acceso
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              cambiar.mutate({
                                persona,
                                cambios: { activo: true },
                                aviso: `${persona.nombre} puede entrar de nuevo.`,
                              })
                            }
                          >
                            <Power /> Devolver acceso
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <DialogoPersona
        abierto={formAbierto}
        persona={editando}
        onCerrar={() => setFormAbierto(false)}
      />
      <DialogoPin
        persona={cambiandoPin}
        onCerrar={() => setCambiandoPin(null)}
      />
      <ConfirmDialog
        open={!!desactivando}
        onOpenChange={(v) => !v && setDesactivando(null)}
        title={`¿Quitarle el acceso a ${desactivando?.nombre}?`}
        desc='No podrá entrar al sistema hasta que le devuelvas el acceso. Su historial se conserva.'
        confirmText='Sí, quitar acceso'
        cancelBtnText='Cancelar'
        destructive
        handleConfirm={() => {
          if (!desactivando) return
          cambiar.mutate({
            persona: desactivando,
            cambios: { activo: false },
            aviso: `${desactivando.nombre} ya no puede entrar.`,
          })
          setDesactivando(null)
        }}
      />
    </Pagina>
  )
}
