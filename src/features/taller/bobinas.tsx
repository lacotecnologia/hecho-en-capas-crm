import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type Bobina, MATERIALES } from '@shared/taller'
import { Loader2, Pencil, Plus } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Campo, CampoNumero } from '@/components/campo'
import { consultaBobinas, guardarBobina } from './api'
import { formatoNumero, formatoPesos, precioGramo } from './formato'

export function MuestraColor({
  hex,
  className,
}: {
  hex: string
  className?: string
}) {
  return (
    <span
      aria-hidden='true'
      className={`inline-block size-4 shrink-0 rounded-full border border-black/15 ${className ?? ''}`}
      style={{ backgroundColor: hex }}
    />
  )
}

export function Bobinas() {
  const { data: lista, isLoading } = useQuery(consultaBobinas)
  const [editando, setEditando] = useState<Bobina | 'nueva' | null>(null)

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <p className='text-muted-foreground'>
          Cada rollo con su serial, igual que en Bambu Studio. El precio por
          gramo sale de aquí.
        </p>
        <Button variant='outline' onClick={() => setEditando('nueva')}>
          <Plus /> Agregar bobina
        </Button>
      </div>

      {isLoading && <Skeleton className='h-40 rounded-xl' />}

      {lista?.length === 0 && (
        <Card className='border-dashed'>
          <CardContent className='py-6 text-center text-muted-foreground'>
            Aún no hay bobinas. Agrega la primera para poder calcular el
            material de los productos.
          </CardContent>
        </Card>
      )}

      {lista && lista.length > 0 && (
        <Card className='py-0'>
          <ul className='divide-y'>
            {lista.map((b) => (
              <li
                key={b.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 ${b.activa ? '' : 'opacity-60'}`}
              >
                <MuestraColor hex={b.colorHex} className='size-6' />
                <div className='min-w-40 flex-1'>
                  <p className='font-medium'>
                    {b.material} · {b.color}
                    {!b.activa && (
                      <Badge variant='outline' className='ms-2'>
                        Terminada
                      </Badge>
                    )}
                  </p>
                  <p className='text-sm text-muted-foreground'>
                    {[b.marca, b.serial && `S/N ${b.serial}`]
                      .filter(Boolean)
                      .join(' · ') || 'Sin marca ni serial'}
                  </p>
                </div>
                <div className='text-end text-sm tabular-nums'>
                  <p className='font-medium'>
                    {formatoPesos(precioGramo(b))} por gramo
                  </p>
                  <p className='text-muted-foreground'>
                    {formatoPesos(b.precioRollo)} ·{' '}
                    {formatoNumero(b.pesoG / 1000)} kg
                  </p>
                </div>
                <Button
                  variant='ghost'
                  size='icon'
                  aria-label={`Editar ${b.material} ${b.color}`}
                  onClick={() => setEditando(b)}
                >
                  <Pencil />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Dialog
        open={editando !== null}
        onOpenChange={(v) => !v && setEditando(null)}
      >
        <DialogContent className='sm:max-w-lg'>
          {editando !== null && (
            <FormBobina
              key={editando === 'nueva' ? 'nueva' : editando.id}
              bobina={editando === 'nueva' ? null : editando}
              onCerrar={() => setEditando(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormBobina({
  bobina,
  onCerrar,
}: {
  bobina: Bobina | null
  onCerrar: () => void
}) {
  const queryClient = useQueryClient()
  const [f, setF] = useState({
    material: bobina?.material ?? 'PLA',
    color: bobina?.color ?? '',
    colorHex: bobina?.colorHex ?? '#007a52',
    marca: bobina?.marca ?? '',
    serial: bobina?.serial ?? '',
    precioRollo: bobina?.precioRollo.toString() ?? '',
    pesoG: bobina?.pesoG.toString() ?? '1000',
    activa: bobina?.activa ?? true,
  })
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)
  const set = (k: keyof typeof f) => (v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }))
  const errorDe = (campo: string) =>
    error?.campo === campo ? error.mensaje : undefined
  const gramo = precioGramo({
    precioRollo: Number(f.precioRollo) || 0,
    pesoG: Number(f.pesoG) || 0,
  })

  const guardar = useMutation({
    mutationFn: () => guardarBobina(bobina?.id ?? null, f),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taller'] })
      toast.success(bobina ? 'Bobina actualizada.' : 'Bobina agregada.')
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
        <DialogTitle>{bobina ? 'Editar bobina' : 'Agregar bobina'}</DialogTitle>
        <DialogDescription>
          Usa el mismo serial de la etiqueta para distinguir rollos del mismo
          color.
        </DialogDescription>
      </DialogHeader>
      <div className='grid gap-4 sm:grid-cols-2'>
        <Campo etiqueta='Material' error={errorDe('material')}>
          {(id) => (
            <Select value={f.material} onValueChange={set('material')}>
              <SelectTrigger id={id} className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATERIALES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Campo>
        <Campo etiqueta='Color' error={errorDe('color')}>
          {(id) => (
            <div className='flex gap-2'>
              <input
                type='color'
                aria-label='Color de muestra'
                value={f.colorHex}
                onChange={(e) => set('colorHex')(e.target.value)}
                className='h-9 w-11 shrink-0 cursor-pointer rounded-md border bg-transparent p-1'
              />
              <Input
                id={id}
                value={f.color}
                placeholder='Ejemplo: Rojo'
                onChange={(e) => set('color')(e.target.value)}
              />
            </div>
          )}
        </Campo>
        <Campo etiqueta='Marca'>
          {(id) => (
            <Input
              id={id}
              value={f.marca}
              placeholder='Ejemplo: Bambu Lab'
              onChange={(e) => set('marca')(e.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta='Serial (S/N)' ayuda='El de la etiqueta del rollo.'>
          {(id) => (
            <Input
              id={id}
              value={f.serial}
              onChange={(e) => set('serial')(e.target.value)}
            />
          )}
        </Campo>
        <CampoNumero
          etiqueta='Precio del rollo'
          unidad='COP'
          valor={f.precioRollo}
          onChange={set('precioRollo')}
          error={errorDe('precioRollo')}
        />
        <CampoNumero
          etiqueta='Peso del rollo'
          unidad='g'
          valor={f.pesoG}
          onChange={set('pesoG')}
          error={errorDe('pesoG')}
        />
      </div>
      <p className='rounded-lg bg-accent/60 px-3 py-2 text-sm'>
        Precio por gramo:{' '}
        <strong className='tabular-nums'>{formatoPesos(gramo)}</strong>
      </p>
      {bobina && (
        <label className='flex items-center gap-3'>
          <Checkbox
            checked={!f.activa}
            onCheckedChange={(v) => set('activa')(v !== true)}
          />
          Este rollo ya se terminó
        </label>
      )}
      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive'>{error.mensaje}</p>
      )}
      <DialogFooter>
        <Button type='button' variant='outline' onClick={onCerrar}>
          Cancelar
        </Button>
        <Button type='submit' disabled={guardar.isPending}>
          {guardar.isPending && <Loader2 className='animate-spin' />}
          {bobina ? 'Guardar cambios' : 'Agregar bobina'}
        </Button>
      </DialogFooter>
    </form>
  )
}
