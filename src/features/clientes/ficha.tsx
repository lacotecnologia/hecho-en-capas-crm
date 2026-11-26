import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { type ClienteFicha } from '@shared/clientes'
import { type EstadoCotizacion } from '@shared/cotizacion'
import { type EstadoPedido } from '@shared/pedidos'
import {
  ArrowLeft,
  FilePlus2,
  Loader2,
  MessageCircle,
  Save,
  Trash2,
  Undo2,
  UserRoundCog,
} from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { EstadoCotizacionBadge } from '@/features/cotizar/estado'
import { enlaceWhatsapp } from '@/features/entregas/entrega'
import { formatoDiaCorto } from '@/features/pedidos/fechas'
import { EstadoPedidoBadge } from '@/features/pedidos/estado'
import { formatoPesos } from '@/features/taller/formato'
import {
  borrarCliente,
  consultaFichaCliente,
  type DatosCliente,
  editarCliente,
  pasarCliente,
} from './api'
import { CamposCliente } from './campos'

function Volver() {
  return (
    <Button variant='ghost' size='sm' asChild className='-ms-2 mb-2'>
      <Link to='/clientes'>
        <ArrowLeft /> Volver a Clientes
      </Link>
    </Button>
  )
}

export function FichaCliente({ id }: { id: number }) {
  const { data, isLoading, isError, error } = useQuery(consultaFichaCliente(id))

  if (isLoading) {
    return (
      <Pagina titulo='Cliente'>
        <div className='grid gap-4 lg:grid-cols-[1fr_22rem]'>
          <Skeleton className='h-96 rounded-xl' />
          <Skeleton className='h-64 rounded-xl' />
        </div>
      </Pagina>
    )
  }
  if (isError || !data) {
    return (
      <Pagina titulo='Cliente'>
        <Volver />
        <p className='text-destructive'>{mensajeDeError(error)}</p>
      </Pagina>
    )
  }
  return <Contenido key={data.cliente.id} f={data} />
}

const iguales = (a: DatosCliente, b: DatosCliente) =>
  (Object.keys(a) as (keyof DatosCliente)[]).every((k) => a[k] === b[k])

function Contenido({ f }: { f: ClienteFicha }) {
  const usuario = useSesion()
  const esAdmin = tieneRol(usuario, ['admin'])
  const queryClient = useQueryClient()
  const { id, ...guardados } = f.cliente
  const [datos, setDatos] = useState<DatosCliente>(guardados)
  const cambiado = !iguales(datos, guardados)
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null)

  const guardar = useMutation({
    mutationFn: () => editarCliente(id, datos),
    onSuccess: ({ cliente }) => {
      const { id: _id, ...nuevos } = cliente
      setDatos(nuevos)
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
      toast.success('Cliente guardado.')
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: mensajeDeError(e) }
      ),
  })

  return (
    <Pagina
      titulo={f.cliente.nombre}
      descripcion={
        esAdmin
          ? f.comercial
            ? `Cliente de ${f.comercial.nombre}.`
            : 'Sin comercial asignado.'
          : 'Cliente tuyo. Los demás comerciales no lo ven.'
      }
      acciones={
        <Button asChild>
          <Link to='/cotizar/$id' params={{ id: 'nueva' }} search={{ cliente: id }}>
            <FilePlus2 /> Nueva cotización
          </Link>
        </Button>
      }
    >
      <Volver />
      <div className='grid items-start gap-4 lg:grid-cols-[1fr_22rem]'>
        <div className='grid gap-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Datos</CardTitle>
              <CardDescription>
                Lo que cambies aquí sale en las cotizaciones y pedidos nuevos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className='grid gap-4'
                onSubmit={(e) => {
                  e.preventDefault()
                  setError(null)
                  if (cambiado) guardar.mutate()
                }}
              >
                <CamposCliente
                  f={datos}
                  cambiar={(c) => {
                    setDatos((p) => ({ ...p, ...c }))
                    setError(null)
                  }}
                  errorDe={(campo) => (error?.campo === campo ? error.mensaje : undefined)}
                />
                {error && !error.campo && (
                  <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
                )}
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  {datos.whatsapp && (
                    <Button variant='outline' asChild className='me-auto'>
                      <a
                        href={enlaceWhatsapp(datos.whatsapp, `Hola, ${datos.nombre}.`)}
                        target='_blank'
                        rel='noreferrer'
                      >
                        <MessageCircle /> Escribirle
                      </a>
                    </Button>
                  )}
                  <Button
                    type='button'
                    variant='ghost'
                    disabled={!cambiado || guardar.isPending}
                    onClick={() => {
                      setDatos(guardados)
                      setError(null)
                    }}
                  >
                    <Undo2 /> Deshacer
                  </Button>
                  <Button type='submit' disabled={!cambiado || guardar.isPending}>
                    {guardar.isPending ? <Loader2 className='animate-spin' /> : <Save />}
                    Guardar cambios
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Movimientos titulo='Pedidos' vacio='Todavía no tiene pedidos.' esAdmin={esAdmin}>
            {f.pedidos.map((p) => (
              <FilaMovimiento
                key={p.id}
                a={{ to: '/pedidos/$id', params: { id: String(p.id) } }}
                codigo={p.codigo}
                fecha={p.creadoEn}
                total={p.total}
                comercial={p.comercial}
                estado={<EstadoPedidoBadge estado={p.estado as EstadoPedido} />}
              />
            ))}
          </Movimientos>
          <Movimientos
            titulo='Cotizaciones'
            vacio='Todavía no tiene cotizaciones.'
            esAdmin={esAdmin}
          >
            {f.cotizaciones.map((q) => (
              <FilaMovimiento
                key={q.id}
                a={{ to: '/cotizar/$id', params: { id: String(q.id) } }}
                codigo={q.codigo}
                fecha={q.creadoEn}
                total={q.total}
                comercial={q.comercial}
                estado={<EstadoCotizacionBadge estado={q.estado as EstadoCotizacion} />}
              />
            ))}
          </Movimientos>
        </div>

        <div className='grid gap-4'>
          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Resumen</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 text-sm'>
              <Dato nombre='Ha comprado' valor={formatoPesos(f.comprado)} grande />
              <Dato
                nombre='Pedidos'
                valor={String(f.pedidos.filter((p) => p.estado !== 'cancelado').length)}
              />
              <Dato nombre='Cotizaciones' valor={String(f.cotizaciones.length)} />
              <Dato nombre='Cliente desde' valor={formatoDiaCorto(f.creadoEn)} />
            </CardContent>
          </Card>
          {esAdmin && <PasarAComercial f={f} />}
          <BorrarCliente f={f} />
        </div>
      </div>
    </Pagina>
  )
}

function Dato({ nombre, valor, grande }: { nombre: string; valor: string; grande?: boolean }) {
  return (
    <div className='flex items-baseline justify-between gap-2'>
      <span className='text-muted-foreground'>{nombre}</span>
      <span className={grande ? 'text-xl font-bold tabular-nums' : 'font-medium tabular-nums'}>
        {valor}
      </span>
    </div>
  )
}

function Movimientos({
  titulo,
  vacio,
  esAdmin,
  children,
}: {
  titulo: string
  vacio: string
  esAdmin: boolean
  children: React.ReactNode[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>{titulo}</CardTitle>
        {!esAdmin && (
          <CardDescription>Solo los que hiciste tú.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {children.length === 0 ? (
          <p className='text-sm text-muted-foreground'>{vacio}</p>
        ) : (
          <ul className='grid divide-y'>{children}</ul>
        )}
      </CardContent>
    </Card>
  )
}

function FilaMovimiento({
  a,
  codigo,
  fecha,
  total,
  comercial,
  estado,
}: {
  a:
    | { to: '/pedidos/$id'; params: { id: string } }
    | { to: '/cotizar/$id'; params: { id: string } }
  codigo: string
  fecha: string
  total: number
  comercial: string
  estado: React.ReactNode
}) {
  return (
    <li>
      <Link
        {...a}
        className='flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:text-primary'
      >
        <span className='font-medium'>{codigo}</span>
        {estado}
        <span className='text-xs text-muted-foreground'>
          {formatoDiaCorto(fecha)}
          {comercial && ` · ${comercial}`}
        </span>
        <span className='ms-auto font-semibold tabular-nums'>{formatoPesos(total)}</span>
      </Link>
    </li>
  )
}

function PasarAComercial({ f }: { f: ClienteFicha }) {
  const queryClient = useQueryClient()
  const [destino, setDestino] = useState<number>(f.comercial?.id ?? 0)
  const pasar = useMutation({
    mutationFn: () => pasarCliente(f.cliente.id, destino),
    onSuccess: (nueva) => {
      queryClient.setQueryData(consultaFichaCliente(f.cliente.id).queryKey, nueva)
      queryClient.invalidateQueries({ queryKey: ['clientes', 'lista'] })
      toast.success(`Listo: ahora es cliente de ${nueva.comercial?.nombre ?? ''}.`)
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <UserRoundCog className='size-5 text-primary' /> Comercial
        </CardTitle>
        <CardDescription>
          Solo ese comercial (y tú) lo ve. Las cotizaciones y pedidos que ya
          existen se quedan con quien los hizo.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-2'>
        <select
          aria-label='Comercial del cliente'
          className='h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs'
          value={destino}
          onChange={(e) => setDestino(Number(e.target.value))}
        >
          {!f.comercial && <option value={0}>Sin comercial</option>}
          {f.comerciales.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <Button
          variant='outline'
          disabled={!destino || destino === f.comercial?.id || pasar.isPending}
          onClick={() => pasar.mutate()}
        >
          {pasar.isPending && <Loader2 className='animate-spin' />}
          Pasar a este comercial
        </Button>
      </CardContent>
    </Card>
  )
}

function BorrarCliente({ f }: { f: ClienteFicha }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const borrar = useMutation({
    mutationFn: () => borrarCliente(f.cliente.id),
    onSuccess: async () => {
      setAbierto(false)
      toast.success(`${f.cliente.nombre} se borró.`)
      await navigate({ to: '/clientes', replace: true })
      queryClient.removeQueries({ queryKey: ['clientes', 'ficha', f.cliente.id] })
      queryClient.invalidateQueries({ queryKey: ['clientes'] })
    },
    onError: (e) => setError(mensajeDeError(e)),
  })
  return (
    <Card>
      <CardContent className='grid gap-2 pt-6 text-sm'>
        {f.noSePuedeBorrar ? (
          <>
            <Button variant='outline' disabled className='text-muted-foreground'>
              <Trash2 /> Borrar cliente
            </Button>
            <p className='text-muted-foreground'>{f.noSePuedeBorrar}</p>
          </>
        ) : (
          <>
            <Button
              variant='outline'
              className='text-destructive hover:text-destructive'
              onClick={() => {
                setError(null)
                setAbierto(true)
              }}
            >
              <Trash2 /> Borrar cliente
            </Button>
            <p className='text-muted-foreground'>
              Se puede borrar porque no tiene pedidos.
            </p>
          </>
        )}
      </CardContent>
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar a {f.cliente.nombre}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ya no saldrá en tu lista ni al cotizar. Sus cotizaciones quedan
              guardadas. Si te equivocas, el administrador lo puede recuperar
              desde la Papelera.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className='text-sm font-medium text-destructive'>{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>No borrar</AlertDialogCancel>
            <Button
              variant='destructive'
              disabled={borrar.isPending}
              onClick={() => borrar.mutate()}
            >
              {borrar.isPending ? <Loader2 className='animate-spin' /> : <Trash2 />}
              Sí, borrar cliente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
