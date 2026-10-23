import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { costoHoraImpresora } from '@shared/costos'
import { type Impresora } from '@shared/taller'
import { AlertTriangle, Loader2, Pencil, Plus, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { BotonBorrar } from '@/components/boton-borrar'
import { Campo, CampoNumero } from '@/components/campo'
import { consultaConfiguracion } from '@/features/configuracion/api'
import { consultaImpresoras, guardarImpresora } from './api'
import { formatoPesos } from './formato'

export function Impresoras() {
  const { data: lista, isLoading } = useQuery(consultaImpresoras)
  const { data: config } = useQuery(consultaConfiguracion)
  const [editando, setEditando] = useState<Impresora | 'nueva' | null>(null)

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-muted-foreground'>
          Con el precio y el consumo de cada impresora se calcula cuánto cuesta
          una hora de impresión.
        </p>
        <Button variant='outline' onClick={() => setEditando('nueva')}>
          <Plus /> Agregar impresora
        </Button>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        {isLoading &&
          [0, 1].map((i) => <Skeleton key={i} className='h-48 rounded-xl' />)}
        {lista?.map((imp) => {
          const hora = costoHoraImpresora(
            imp.precioCompra,
            imp.vidaUtilH,
            imp.potenciaW,
            config?.tarifa_kwh ?? 0
          )
          return (
            <Card key={imp.id} className={imp.activa ? '' : 'opacity-60'}>
              <CardContent className='grid gap-4'>
                <div className='flex items-start gap-3'>
                  <div className='flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary'>
                    <Printer className='size-5' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <h3 className='font-semibold'>{imp.nombre}</h3>
                    <p className='text-sm text-muted-foreground'>
                      {imp.modelo}
                    </p>
                  </div>
                  <Button
                    variant='ghost'
                    size='icon'
                    aria-label={`Editar ${imp.nombre}`}
                    onClick={() => setEditando(imp)}
                  >
                    <Pencil />
                  </Button>
                </div>
                <div className='flex flex-wrap gap-1.5'>
                  <Badge variant='secondary'>
                    {imp.multicolor ? 'Varios colores' : 'Un solo color'}
                  </Badge>
                  {!imp.activa && <Badge variant='outline'>Fuera de uso</Badge>}
                  {imp.potenciaW === null && (
                    <Badge className='bg-marca-amarillo/40 text-foreground'>
                      <AlertTriangle /> Falta medir el consumo
                    </Badge>
                  )}
                </div>
                <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                  <dt className='text-muted-foreground'>Precio de compra</dt>
                  <dd className='text-end tabular-nums'>
                    {formatoPesos(imp.precioCompra)}
                  </dd>
                  <dt className='text-muted-foreground'>Vida útil</dt>
                  <dd className='text-end tabular-nums'>
                    {imp.vidaUtilH.toLocaleString('es-CO')} horas
                  </dd>
                  <dt className='text-muted-foreground'>Consumo</dt>
                  <dd className='text-end tabular-nums'>
                    {imp.potenciaW === null
                      ? 'Sin medir'
                      : `${imp.potenciaW} W`}
                  </dd>
                  <dt className='font-medium'>Una hora cuesta</dt>
                  <dd className='text-end font-semibold tabular-nums'>
                    {formatoPesos(hora.desgaste + hora.energia)}
                    <span className='block text-xs font-normal text-muted-foreground'>
                      desgaste {formatoPesos(hora.desgaste)} + luz{' '}
                      {formatoPesos(hora.energia)}
                    </span>
                  </dd>
                </dl>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <DialogoImpresora
        impresora={editando === 'nueva' ? null : editando}
        abierto={editando !== null}
        onCerrar={() => setEditando(null)}
      />
    </div>
  )
}

function DialogoImpresora({
  impresora,
  abierto,
  onCerrar,
}: {
  impresora: Impresora | null
  abierto: boolean
  onCerrar: () => void
}) {
  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className='sm:max-w-lg'>
        {abierto && (
          <FormImpresora
            key={impresora?.id ?? 'nueva'}
            impresora={impresora}
            onCerrar={onCerrar}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormImpresora({
  impresora,
  onCerrar,
}: {
  impresora: Impresora | null
  onCerrar: () => void
}) {
  const queryClient = useQueryClient()
  const [f, setF] = useState({
    nombre: impresora?.nombre ?? '',
    modelo: impresora?.modelo ?? '',
    multicolor: impresora?.multicolor ?? false,
    potenciaW: impresora?.potenciaW?.toString() ?? '',
    precioCompra: impresora?.precioCompra.toString() ?? '',
    vidaUtilH: impresora?.vidaUtilH.toString() ?? '5000',
    activa: impresora?.activa ?? true,
  })
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }))
  const errorDe = (campo: string) =>
    error?.campo === campo ? error.mensaje : undefined

  const guardar = useMutation({
    mutationFn: () => guardarImpresora(impresora?.id ?? null, f),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taller'] })
      toast.success(
        impresora ? 'Impresora actualizada.' : 'Impresora agregada.'
      )
      onCerrar()
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
        setError(null)
        guardar.mutate()
      }}
    >
      <DialogHeader>
        <DialogTitle>
          {impresora ? `Editar ${impresora.nombre}` : 'Agregar impresora'}
        </DialogTitle>
        <DialogDescription>
          Estos datos se usan para calcular el costo de cada hora de impresión.
        </DialogDescription>
      </DialogHeader>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Campo etiqueta='Nombre' error={errorDe('nombre')}>
          {(id) => (
            <Input
              id={id}
              value={f.nombre}
              placeholder='Ejemplo: Bambu Lab A1'
              onChange={(e) => set('nombre')(e.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta='Modelo o detalle'>
          {(id) => (
            <Input
              id={id}
              value={f.modelo}
              placeholder='Ejemplo: con AMS lite'
              onChange={(e) => set('modelo')(e.target.value)}
            />
          )}
        </Campo>
        <CampoNumero
          etiqueta='Precio de compra'
          unidad='COP'
          valor={f.precioCompra}
          onChange={set('precioCompra')}
          error={errorDe('precioCompra')}
        />
        <CampoNumero
          etiqueta='Vida útil'
          unidad='horas'
          valor={f.vidaUtilH}
          onChange={set('vidaUtilH')}
          ayuda='Horas que esperas que dure antes de reemplazarla.'
          error={errorDe('vidaUtilH')}
        />
        <CampoNumero
          etiqueta='Consumo imprimiendo'
          unidad='W'
          valor={f.potenciaW}
          onChange={set('potenciaW')}
          ayuda='Déjalo vacío si aún no lo has medido.'
          error={errorDe('potenciaW')}
          className='sm:col-span-2'
        />
      </div>
      <label className='flex items-center gap-3'>
        <Checkbox
          checked={f.multicolor}
          onCheckedChange={(v) => set('multicolor')(v === true)}
        />
        Imprime varios colores (tiene AMS)
      </label>
      {impresora && (
        <label className='flex items-center gap-3'>
          <Checkbox
            checked={f.activa}
            onCheckedChange={(v) => set('activa')(v === true)}
          />
          En uso
        </label>
      )}
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        {impresora && (
          <BotonBorrar
            tipo='impresora'
            id={impresora.id}
            nombre={impresora.nombre}
            onBorrado={onCerrar}
            className='text-destructive hover:text-destructive sm:me-auto'
          />
        )}
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          {guardar.isPending && <Loader2 className='animate-spin' />}
          {impresora ? 'Guardar cambios' : 'Agregar impresora'}
        </Button>
      </DialogFooter>
    </form>
  )
}
