import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type ElementoPapelera,
  NOMBRES_PAPELERA,
  TIPOS_PAPELERA,
  type TipoPapelera,
} from '@shared/papelera'
import {
  Box,
  ClipboardList,
  FileText,
  Loader2,
  type LucideIcon,
  Printer,
  RotateCcw,
  Spool,
  Trash2,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { mensajeDeError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { consultaPapelera, HAY_PAPELERA, recuperar } from './api'

const ICONOS: Record<TipoPapelera, LucideIcon> = {
  producto: Box,
  cliente: User,
  cotizacion: FileText,
  pedido: ClipboardList,
  bobina: Spool,
  impresora: Printer,
}

/** Dónde vuelve a aparecer cada cosa al recuperarla. */
const VUELVE_A: Record<TipoPapelera, string> = {
  producto: 'Taller',
  cliente: 'la lista de clientes',
  cotizacion: 'Cotizar',
  pedido: 'Pedidos',
  bobina: 'Taller → Bobinas',
  impresora: 'Taller → Impresoras',
}

const fechaHora = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))

export function PantallaPapelera() {
  const { data: elementos, isLoading } = useQuery({
    ...consultaPapelera,
    enabled: HAY_PAPELERA,
  })
  const [filtro, setFiltro] = useState<TipoPapelera | 'todos'>('todos')

  const lista = (elementos ?? []).filter(
    (e) => filtro === 'todos' || e.tipo === filtro
  )
  const cuenta = (t: TipoPapelera) =>
    (elementos ?? []).filter((e) => e.tipo === t).length

  return (
    <Pagina
      titulo='Papelera'
      descripcion='Lo que el administrador borró. Nada se pierde: con “Recuperar” vuelve a su lugar.'
    >
      {!HAY_PAPELERA ? (
        <p className='text-muted-foreground'>
          La versión de prueba no usa la Papelera.
        </p>
      ) : isLoading ? (
        <div className='grid gap-3'>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className='h-20 rounded-xl' />
          ))}
        </div>
      ) : (elementos ?? []).length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center gap-2 py-10 text-center'>
            <Trash2 className='size-10 text-muted-foreground/50' />
            <p className='font-medium'>La Papelera está vacía.</p>
            <p className='max-w-sm text-sm text-muted-foreground'>
              Cuando borres un producto, un cliente, una cotización o un pedido,
              aparece aquí por si lo necesitas de nuevo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4'>
          <div
            role='radiogroup'
            aria-label='Qué mostrar'
            className='flex flex-wrap gap-2'
          >
            {(['todos', ...TIPOS_PAPELERA] as const).map((t) => {
              const n = t === 'todos' ? (elementos ?? []).length : cuenta(t)
              if (t !== 'todos' && n === 0) return null
              return (
                <button
                  key={t}
                  type='button'
                  role='radio'
                  aria-checked={filtro === t}
                  onClick={() => setFiltro(t)}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-sm font-medium transition-colors',
                    filtro === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  )}
                >
                  {t === 'todos' ? 'Todo' : NOMBRES_PAPELERA[t].plural} ({n})
                </button>
              )
            })}
          </div>
          <ul className='grid gap-3'>
            {lista.map((e) => (
              <li key={`${e.tipo}-${e.id}`}>
                <Fila elemento={e} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Pagina>
  )
}

function Fila({ elemento: e }: { elemento: ElementoPapelera }) {
  const queryClient = useQueryClient()
  const Icono = ICONOS[e.tipo]
  const accion = useMutation({
    mutationFn: () => recuperar(e.tipo, e.id),
    onSuccess: () => {
      queryClient.invalidateQueries()
      toast.success(`${e.nombre} volvió a ${VUELVE_A[e.tipo]}.`)
    },
    onError: (err) => toast.error(mensajeDeError(err)),
  })
  return (
    <Card className='py-3'>
      <CardContent className='flex flex-wrap items-center gap-3 px-4'>
        <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted'>
          <Icono className='size-5 text-muted-foreground' />
        </span>
        <div className='min-w-0 flex-1 basis-48'>
          <p className='text-xs font-medium tracking-wide text-muted-foreground uppercase'>
            {NOMBRES_PAPELERA[e.tipo].singular}
          </p>
          <p className='font-medium break-words'>{e.nombre}</p>
          {e.detalle && (
            <p className='text-sm text-muted-foreground'>{e.detalle}</p>
          )}
          <p className='text-xs text-muted-foreground'>
            Borrado el {fechaHora(e.borradoEn)} por {e.borradoPor}
          </p>
        </div>
        <Button
          variant='outline'
          className='w-full sm:w-auto'
          disabled={accion.isPending}
          onClick={() => accion.mutate()}
        >
          {accion.isPending ? (
            <Loader2 className='animate-spin' />
          ) : (
            <RotateCcw />
          )}
          Recuperar
        </Button>
      </CardContent>
    </Card>
  )
}
