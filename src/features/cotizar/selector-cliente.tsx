import { useDeferredValue, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Cliente } from '@shared/cotizacion'
import {
  Loader2,
  MapPin,
  MessageCircle,
  Search,
  UserPlus,
  X,
} from 'lucide-react'
import { ApiError } from '@/lib/api'
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
import { BotonBorrar } from '@/components/boton-borrar'
import { Campo } from '@/components/campo'
import { consultaClientes, crearCliente } from './api'

type Props = {
  cliente: Cliente | null
  onElegir: (cliente: Cliente | null) => void
  soloLectura?: boolean
  error?: string
}

export function SelectorCliente({
  cliente,
  onElegir,
  soloLectura,
  error,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const q = useDeferredValue(busqueda.trim())
  const [creando, setCreando] = useState(false)
  const { data: resultados = [], isFetching } = useQuery({
    ...consultaClientes(q),
    enabled: !cliente && !soloLectura,
  })

  if (cliente) {
    return (
      <div className='flex flex-wrap items-start gap-3 rounded-lg border bg-accent/40 p-4'>
        <div className='min-w-0 flex-1'>
          <p className='font-semibold'>{cliente.nombre}</p>
          <p className='flex flex-wrap gap-x-4 text-sm text-muted-foreground'>
            {cliente.whatsapp && (
              <span className='inline-flex items-center gap-1'>
                <MessageCircle className='size-3.5' /> {cliente.whatsapp}
              </span>
            )}
            {cliente.ciudad && (
              <span className='inline-flex items-center gap-1'>
                <MapPin className='size-3.5' /> {cliente.ciudad}
              </span>
            )}
            {cliente.documento && <span>Doc. {cliente.documento}</span>}
          </p>
        </div>
        {!soloLectura && (
          <div className='flex flex-wrap gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() => onElegir(null)}
            >
              <X /> Cambiar cliente
            </Button>
            <BotonBorrar
              tipo='cliente'
              id={cliente.id}
              nombre={cliente.nombre}
              variante='ghost'
              className='h-8 text-destructive hover:text-destructive'
              onBorrado={() => onElegir(null)}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='grid gap-3'>
      <div className='relative'>
        <Search className='pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder='Busca por nombre, WhatsApp o documento'
          aria-label='Buscar cliente'
          aria-invalid={!!error}
          className='h-11 ps-9 text-base'
        />
        {isFetching && (
          <Loader2 className='absolute inset-e-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground' />
        )}
      </div>
      {error && <p className='text-sm font-medium text-destructive'>{error}</p>}
      {resultados.length > 0 && (
        <ul className='max-h-64 divide-y overflow-y-auto rounded-lg border'>
          {resultados.map((c) => (
            <li key={c.id}>
              <button
                type='button'
                onClick={() => onElegir(c)}
                className='w-full px-4 py-2.5 text-start transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none'
              >
                <span className='font-medium'>{c.nombre}</span>
                <span className='block text-sm text-muted-foreground'>
                  {[c.whatsapp, c.ciudad].filter(Boolean).join(' · ') ||
                    'Sin datos de contacto'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {q && !isFetching && resultados.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          No hay clientes con “{q}”.
        </p>
      )}
      <Button
        type='button'
        variant='outline'
        className='justify-self-start'
        onClick={() => setCreando(true)}
      >
        <UserPlus /> Crear cliente nuevo
      </Button>
      <DialogoCliente
        abierto={creando}
        nombreInicial={busqueda}
        onCerrar={() => setCreando(false)}
        onCreado={(c) => {
          setCreando(false)
          onElegir(c)
        }}
      />
    </div>
  )
}

function DialogoCliente({
  abierto,
  nombreInicial,
  onCerrar,
  onCreado,
}: {
  abierto: boolean
  nombreInicial: string
  onCerrar: () => void
  onCreado: (c: Cliente) => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-lg'>
        {abierto && (
          <FormCliente
            nombreInicial={nombreInicial}
            onCerrar={onCerrar}
            onCreado={onCreado}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormCliente({
  nombreInicial,
  onCerrar,
  onCreado,
}: {
  nombreInicial: string
  onCerrar: () => void
  onCreado: (c: Cliente) => void
}) {
  const queryClient = useQueryClient()
  const [f, setF] = useState({
    nombre: nombreInicial,
    whatsapp: '',
    email: '',
    ciudad: 'Pereira',
    direccion: '',
    documento: '',
  })
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }))
  const errorDe = (campo: string) =>
    error?.campo === campo ? error.mensaje : undefined

  const guardar = useMutation({
    mutationFn: () => crearCliente(f),
    onSuccess: ({ cliente }) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      onCreado(cliente)
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: 'No se pudo guardar. Intenta de nuevo.' }
      ),
  })

  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        // El diálogo vive dentro del formulario de la cotización: que no lo envíe.
        e.stopPropagation()
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>Crear cliente</DialogTitle>
        <DialogDescription>
          Solo el nombre es obligatorio. El WhatsApp sirve para mandarle la
          cotización y el seguimiento.
        </DialogDescription>
      </DialogHeader>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Campo
          etiqueta='Nombre o empresa'
          error={errorDe('nombre')}
          className='sm:col-span-2'
        >
          {(id) => (
            <Input
              id={id}
              value={f.nombre}
              onChange={set('nombre')}
              autoFocus
            />
          )}
        </Campo>
        <Campo etiqueta='WhatsApp' error={errorDe('whatsapp')}>
          {(id) => (
            <Input
              id={id}
              inputMode='tel'
              placeholder='300 123 4567'
              value={f.whatsapp}
              onChange={set('whatsapp')}
            />
          )}
        </Campo>
        <Campo etiqueta='Correo' error={errorDe('email')}>
          {(id) => (
            <Input
              id={id}
              type='email'
              value={f.email}
              onChange={set('email')}
            />
          )}
        </Campo>
        <Campo etiqueta='Ciudad'>
          {(id) => <Input id={id} value={f.ciudad} onChange={set('ciudad')} />}
        </Campo>
        <Campo etiqueta='Cédula o NIT' ayuda='Opcional.'>
          {(id) => (
            <Input id={id} value={f.documento} onChange={set('documento')} />
          )}
        </Campo>
        <Campo
          etiqueta='Dirección'
          ayuda='Para domicilios y envíos.'
          className='sm:col-span-2'
        >
          {(id) => (
            <Input id={id} value={f.direccion} onChange={set('direccion')} />
          )}
        </Campo>
      </div>
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          {guardar.isPending && <Loader2 className='animate-spin' />}
          Crear y usar en la cotización
        </Button>
      </DialogFooter>
    </form>
  )
}
