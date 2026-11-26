import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type ClienteFila } from '@shared/clientes'
import {
  ChevronRight,
  Loader2,
  MessageCircle,
  Search,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { tieneRol, useSesion } from '@/lib/sesion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { formatoDiaCorto } from '@/features/pedidos/fechas'
import { formatoPesos } from '@/features/taller/formato'
import { clienteVacio, consultaListaClientes, crearCliente } from './api'
import { CamposCliente } from './campos'

const coincide = (c: ClienteFila, q: string) =>
  [c.nombre, c.whatsapp, c.documento, c.ciudad, c.email].some((x) =>
    x.toLowerCase().includes(q)
  )

export function PantallaClientes() {
  const usuario = useSesion()
  const esAdmin = tieneRol(usuario, ['admin'])
  const { data: clientes, isLoading, isError, error } = useQuery(
    consultaListaClientes
  )
  const [buscar, setBuscar] = useState('')
  const [comercial, setComercial] = useState<number | 'todos'>('todos')
  const [creando, setCreando] = useState(false)

  const comerciales = useMemo(() => {
    const m = new Map<number, string>()
    for (const c of clientes ?? []) if (c.comercial) m.set(c.comercial.id, c.comercial.nombre)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [clientes])

  const lista = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (clientes ?? []).filter(
      (c) =>
        (comercial === 'todos' || c.comercial?.id === comercial) &&
        (!q || coincide(c, q))
    )
  }, [clientes, buscar, comercial])

  return (
    <Pagina
      titulo='Clientes'
      descripcion={
        esAdmin
          ? 'Todos los clientes y de qué comercial es cada uno.'
          : 'Tus clientes. Solo tú y el administrador los ven.'
      }
      acciones={
        <Button onClick={() => setCreando(true)}>
          <UserPlus /> Nuevo cliente
        </Button>
      }
    >
      <div className='mb-4 grid gap-3 sm:grid-cols-[1fr_auto]'>
        <div className='relative'>
          <Search className='absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder='Buscar por nombre, WhatsApp, NIT o ciudad'
            className='ps-9'
            aria-label='Buscar clientes'
          />
        </div>
        {esAdmin && comerciales.length > 1 && (
          <select
            aria-label='Comercial'
            className='h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs'
            value={comercial}
            onChange={(e) =>
              setComercial(e.target.value === 'todos' ? 'todos' : Number(e.target.value))
            }
          >
            <option value='todos'>Todos los comerciales</option>
            {comerciales.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading && (
        <div className='grid gap-2'>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className='h-20 w-full rounded-xl' />
          ))}
        </div>
      )}
      {isError && <p className='text-destructive'>{mensajeDeError(error)}</p>}
      {clientes && clientes.length === 0 && (
        <Card>
          <CardContent className='grid justify-items-center gap-2 py-12 text-center'>
            <Users className='size-10 text-muted-foreground' />
            <p className='font-medium'>Todavía no tienes clientes.</p>
            <p className='max-w-md text-sm text-muted-foreground'>
              Créalos aquí o desde una cotización. Cada comercial ve solo los
              suyos.
            </p>
            <Button className='mt-2' onClick={() => setCreando(true)}>
              <UserPlus /> Nuevo cliente
            </Button>
          </CardContent>
        </Card>
      )}
      {clientes && clientes.length > 0 && (
        <p className='mb-2 text-sm text-muted-foreground'>
          {lista.length === clientes.length
            ? `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'}`
            : `${lista.length} de ${clientes.length} clientes`}
        </p>
      )}
      {clientes && clientes.length > 0 && lista.length === 0 && (
        <p className='py-8 text-center text-muted-foreground'>
          Ningún cliente coincide con “{buscar}”.
        </p>
      )}

      <ul className='grid gap-2'>
        {lista.map((c) => (
          <li key={c.id}>
            <Link
              to='/clientes/$clienteId'
              params={{ clienteId: String(c.id) }}
              className='flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50'
            >
              <span className='flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary'>
                {c.nombre.trim().charAt(0).toUpperCase()}
              </span>
              <span className='grid min-w-0 flex-1 gap-0.5'>
                <span className='truncate font-medium'>{c.nombre}</span>
                <span className='flex flex-wrap gap-x-3 text-xs text-muted-foreground'>
                  {c.whatsapp && (
                    <span className='inline-flex items-center gap-1'>
                      <MessageCircle className='size-3' /> {c.whatsapp}
                    </span>
                  )}
                  {c.ciudad && <span>{c.ciudad}</span>}
                  {esAdmin && (
                    <span>
                      {c.comercial ? `De ${c.comercial.nombre}` : 'Sin comercial'}
                    </span>
                  )}
                </span>
              </span>
              <span className='hidden text-end text-xs text-muted-foreground sm:grid'>
                <span>
                  {c.pedidos} {c.pedidos === 1 ? 'pedido' : 'pedidos'} ·{' '}
                  {c.cotizaciones} {c.cotizaciones === 1 ? 'cotización' : 'cotizaciones'}
                </span>
                {c.ultimoMovimiento && <span>Último: {formatoDiaCorto(c.ultimoMovimiento)}</span>}
              </span>
              <span className='text-end text-sm font-semibold tabular-nums'>
                {c.comprado > 0 ? formatoPesos(c.comprado) : ''}
                <span className='block text-xs font-normal text-muted-foreground sm:hidden'>
                  {c.pedidos} {c.pedidos === 1 ? 'pedido' : 'pedidos'}
                </span>
              </span>
              <ChevronRight className='size-4 shrink-0 text-muted-foreground' />
            </Link>
          </li>
        ))}
      </ul>

      <NuevoCliente abierto={creando} onCerrar={() => setCreando(false)} />
    </Pagina>
  )
}

function NuevoCliente({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-lg'>
        {abierto && <FormNuevo onCerrar={onCerrar} />}
      </DialogContent>
    </Dialog>
  )
}

function FormNuevo({ onCerrar }: { onCerrar: () => void }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [f, setF] = useState(() => clienteVacio())
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null)
  const guardar = useMutation({
    mutationFn: () => crearCliente(f),
    onSuccess: ({ cliente }) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success(`${cliente.nombre} quedó en tus clientes.`)
      onCerrar()
      navigate({ to: '/clientes/$clienteId', params: { clienteId: String(cliente.id) } })
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: mensajeDeError(e) }
      ),
  })
  return (
    <form
      className='grid gap-4'
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>Nuevo cliente</DialogTitle>
        <DialogDescription>
          Solo el nombre es obligatorio. Queda como cliente tuyo: los demás
          comerciales no lo ven.
        </DialogDescription>
      </DialogHeader>
      <CamposCliente
        f={f}
        cambiar={(c) => {
          setF((p) => ({ ...p, ...c }))
          setError(null)
        }}
        errorDe={(campo) => (error?.campo === campo ? error.mensaje : undefined)}
        enfocar
      />
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter className='gap-2'>
        <Button type='button' variant='ghost' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          {guardar.isPending ? <Loader2 className='animate-spin' /> : <UserPlus />}
          Crear cliente
        </Button>
      </DialogFooter>
    </form>
  )
}
