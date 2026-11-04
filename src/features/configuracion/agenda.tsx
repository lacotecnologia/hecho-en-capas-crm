import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  type AccionRegla,
  type Agenda,
  DIAS_SEMANA,
  describirRegla,
  festivosColombia,
  MODALIDADES_REGLA,
  minutosDeHora,
  type ReglaEntrega,
} from '@shared/agenda'
import { type Modalidad } from '@shared/cotizacion'
import { CalendarOff, Loader2, Plus, Save, Trash2, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { CampoNumero } from '@/components/campo'
import {
  consultaAgenda,
  consultaConfiguracionCompleta,
  guardarAgenda,
} from './api'

const ORDEN_MODALIDAD: Modalidad[] = ['local', 'recoge', 'nacional']

/** Las reglas con hora van primero (de la más temprana); "a cualquier hora" al final. */
function ordenar(reglas: ReglaEntrega[]) {
  return [...reglas].sort((a, b) => {
    const ma = ORDEN_MODALIDAD.indexOf(a.modalidad)
    const mb = ORDEN_MODALIDAD.indexOf(b.modalidad)
    if (ma !== mb) return ma - mb
    const ha = a.listoAntesDe ? minutosDeHora(a.listoAntesDe) : Infinity
    const hb = b.listoAntesDe ? minutosDeHora(b.listoAntesDe) : Infinity
    return ha - hb
  })
}

const fechaLarga = (iso: string) =>
  new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`))

export function AgendaEntregas() {
  const queryClient = useQueryClient()
  const { data: guardada, isLoading } = useQuery(consultaAgenda)
  const [borrador, setBorrador] = useState<Agenda | null>(null)
  const agenda = borrador ?? guardada
  const cambiada =
    !!borrador && JSON.stringify(borrador) !== JSON.stringify(guardada)
  const [error, setError] = useState<{
    mensaje: string
    campo?: string
  } | null>(null)

  const cambiar = (f: (a: Agenda) => Agenda) => {
    if (!agenda) return
    setBorrador(f(structuredClone(agenda)))
    setError(null)
  }

  const guardar = useMutation({
    mutationFn: () =>
      guardarAgenda({ ...agenda!, reglas: ordenar(agenda!.reglas) }),
    onSuccess: (datos) => {
      queryClient.setQueryData(consultaConfiguracionCompleta.queryKey, datos)
      queryClient.invalidateQueries({ queryKey: ['taller-cotizar'] })
      setBorrador(null)
      toast.success(
        'Horarios y reglas guardados. Las próximas cotizaciones ya los usan.'
      )
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: mensajeDeError(e) }
      ),
  })

  // Festivos de este año y el siguiente que todavía no pasan
  const hoy = new Date().toISOString().slice(0, 10)
  const anio = new Date().getFullYear()
  const festivos = useMemo(
    () =>
      [...festivosColombia(anio), ...festivosColombia(anio + 1)].filter(
        (f) => f.fecha >= hoy
      ),
    [anio, hoy]
  )

  if (isLoading || !agenda) {
    return (
      <div className='grid gap-4'>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className='h-48 w-full rounded-xl' />
        ))}
      </div>
    )
  }

  const reglas = ordenar(agenda.reglas)
  const errorDe = (campo: string) =>
    error?.campo === campo ? (
      <p className='text-sm font-medium text-destructive' role='alert'>
        {error.mensaje}
      </p>
    ) : null

  return (
    <form
      className='grid gap-6 pb-24'
      onSubmit={(e) => {
        e.preventDefault()
        if (cambiada) guardar.mutate()
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Reglas de entrega</CardTitle>
          <CardDescription>
            Convierten “queda listo a tal hora” en la hora de entrega que ve el
            comercial. Se usa la primera regla que aplica, de la hora más
            temprana a la más tarde.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-6'>
          {ORDEN_MODALIDAD.map((m) => (
            <section key={m} className='grid gap-3'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <h3 className='font-semibold'>{MODALIDADES_REGLA[m]}</h3>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    cambiar((a) => ({
                      ...a,
                      reglas: [
                        ...a.reglas,
                        {
                          id: `r${Date.now().toString(36)}`,
                          modalidad: m,
                          listoAntesDe: '10:00',
                          accion: { tipo: 'horas', horas: 4 },
                          activa: true,
                        },
                      ],
                    }))
                  }
                >
                  <Plus /> Agregar regla
                </Button>
              </div>
              {reglas.filter((r) => r.modalidad === m).length === 0 ? (
                <p className='rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground'>
                  Sin reglas: no se podrá calcular la entrega para{' '}
                  {MODALIDADES_REGLA[m].toLowerCase()}.
                </p>
              ) : (
                <ul className='grid gap-2'>
                  {reglas
                    .filter((r) => r.modalidad === m)
                    .map((r) => (
                      <FilaRegla
                        key={r.id}
                        regla={r}
                        onCambiar={(nueva) =>
                          cambiar((a) => ({
                            ...a,
                            reglas: a.reglas.map((x) =>
                              x.id === r.id ? nueva : x
                            ),
                          }))
                        }
                        onBorrar={() =>
                          cambiar((a) => ({
                            ...a,
                            reglas: a.reglas.filter((x) => x.id !== r.id),
                          }))
                        }
                      />
                    ))}
                </ul>
              )}
            </section>
          ))}
          {errorDe('reglas')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Horario del taller</CardTitle>
          <CardDescription>
            Las impresoras siguen de noche, pero empezar una impresión, quitarla
            y dar acabado solo se hace en este horario.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-2'>
          {[1, 2, 3, 4, 5, 6, 0].map((i) => {
            const d = agenda.horario[i]
            return (
              <div
                key={i}
                className='flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border px-3 py-2'
              >
                <label className='flex min-w-36 items-center gap-3 font-medium'>
                  <Switch
                    checked={d.abierto}
                    onCheckedChange={(v) =>
                      cambiar((a) => {
                        a.horario[i].abierto = v
                        return a
                      })
                    }
                    aria-label={`${DIAS_SEMANA[i]}: abre`}
                  />
                  {DIAS_SEMANA[i]}
                </label>
                {d.abierto ? (
                  <div className='flex items-center gap-2 text-sm'>
                    de
                    <Input
                      type='time'
                      value={d.abre}
                      aria-label={`${DIAS_SEMANA[i]}: abre a las`}
                      className='w-32'
                      onChange={(e) =>
                        cambiar((a) => {
                          a.horario[i].abre = e.target.value
                          return a
                        })
                      }
                    />
                    a
                    <Input
                      type='time'
                      value={d.cierra}
                      aria-label={`${DIAS_SEMANA[i]}: cierra a las`}
                      className='w-32'
                      onChange={(e) =>
                        cambiar((a) => {
                          a.horario[i].cierra = e.target.value
                          return a
                        })
                      }
                    />
                  </div>
                ) : (
                  <span className='text-sm text-muted-foreground'>Cerrado</span>
                )}
              </div>
            )
          })}
          {errorDe('horario')}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Tiempos del taller</CardTitle>
          <CardDescription>
            Se suman al tiempo de impresión y acabado de cada producto.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-6 md:grid-cols-2'>
          <CampoNumero
            etiqueta='Alistar y empacar un pedido'
            unidad='min'
            valor={String(agenda.minAlistar)}
            onChange={(v) =>
              cambiar((a) => ({ ...a, minAlistar: Number(v) || 0 }))
            }
            ayuda='Revisar, empacar y dejar listo para entregar.'
            error={error?.campo === 'minAlistar' ? error.mensaje : undefined}
          />
          <CampoNumero
            etiqueta='Margen de seguridad'
            unidad='min'
            valor={String(agenda.minMargen)}
            onChange={(v) =>
              cambiar((a) => ({ ...a, minMargen: Number(v) || 0 }))
            }
            ayuda='Solo cuando hay que imprimir: por si una impresión falla.'
            error={error?.campo === 'minMargen' ? error.mensaje : undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Días sin taller</CardTitle>
          <CardDescription>
            Los festivos de Colombia ya están cargados. Apaga los que sí se
            trabajan y agrega días como vacaciones.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <ul className='grid gap-1 sm:grid-cols-2'>
            {festivos.map((f) => {
              const quitado = agenda.festivosQuitados.includes(f.fecha)
              return (
                <li key={f.fecha}>
                  <label className='flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/50'>
                    <Switch
                      checked={!quitado}
                      onCheckedChange={(cerrado) =>
                        cambiar((a) => ({
                          ...a,
                          festivosQuitados: cerrado
                            ? a.festivosQuitados.filter((x) => x !== f.fecha)
                            : [...a.festivosQuitados, f.fecha],
                        }))
                      }
                      aria-label={`${f.nombre}: cerrado`}
                    />
                    <span
                      className={cn(
                        'text-sm',
                        quitado && 'text-muted-foreground line-through'
                      )}
                    >
                      <span className='font-medium'>{fechaLarga(f.fecha)}</span>{' '}
                      · {f.nombre}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className='grid gap-2'>
            <h3 className='text-sm font-semibold'>Otros días sin taller</h3>
            {agenda.festivosExtra.map((f, i) => (
              <div key={i} className='flex flex-wrap items-center gap-2'>
                <Input
                  type='date'
                  value={f.fecha}
                  aria-label='Fecha'
                  className='w-44'
                  onChange={(e) =>
                    cambiar((a) => {
                      a.festivosExtra[i].fecha = e.target.value
                      return a
                    })
                  }
                />
                <Input
                  value={f.nombre}
                  placeholder='Motivo (ej. vacaciones)'
                  aria-label='Motivo'
                  className='min-w-40 flex-1'
                  onChange={(e) =>
                    cambiar((a) => {
                      a.festivosExtra[i].nombre = e.target.value
                      return a
                    })
                  }
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  aria-label='Quitar este día'
                  onClick={() =>
                    cambiar((a) => ({
                      ...a,
                      festivosExtra: a.festivosExtra.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button
              type='button'
              variant='outline'
              className='justify-self-start'
              onClick={() =>
                cambiar((a) => ({
                  ...a,
                  festivosExtra: [
                    ...a.festivosExtra,
                    { fecha: hoy, nombre: '' },
                  ],
                }))
              }
            >
              <CalendarOff /> Agregar un día sin taller
            </Button>
            {errorDe('festivos')}
          </div>
        </CardContent>
      </Card>

      {error &&
        !['reglas', 'horario', 'festivos', 'minAlistar', 'minMargen'].includes(
          error.campo ?? ''
        ) && (
          <p className='text-sm font-medium text-destructive'>
            {error.mensaje}
          </p>
        )}

      <div className='sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur'>
        <p className='me-auto text-sm text-muted-foreground'>
          {cambiada
            ? 'Tienes cambios sin guardar.'
            : 'No hay cambios sin guardar.'}
        </p>
        <Button
          type='button'
          variant='outline'
          disabled={!cambiada || guardar.isPending}
          onClick={() => {
            setBorrador(null)
            setError(null)
          }}
        >
          <Undo2 /> Deshacer
        </Button>
        <Button type='submit' disabled={!cambiada || guardar.isPending}>
          {guardar.isPending ? <Loader2 className='animate-spin' /> : <Save />}
          Guardar horarios y reglas
        </Button>
      </div>
    </form>
  )
}

const selectCls =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

function FilaRegla({
  regla: r,
  onCambiar,
  onBorrar,
}: {
  regla: ReglaEntrega
  onCambiar: (r: ReglaEntrega) => void
  onBorrar: () => void
}) {
  const accion = r.accion
  const cambiarAccion = (tipo: AccionRegla['tipo']) =>
    onCambiar({
      ...r,
      accion:
        tipo === 'horas'
          ? { tipo, horas: 4 }
          : tipo === 'dia_habil'
            ? { tipo, dias: 1, antesDe: '12:00' }
            : { tipo },
    })
  return (
    <li
      className={cn(
        'grid gap-3 rounded-lg border p-3',
        !r.activa && 'bg-muted/50 text-muted-foreground'
      )}
    >
      <p className='text-sm font-medium'>{describirRegla(r)}</p>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <span>Si queda listo</span>
        <select
          className={selectCls}
          value={r.listoAntesDe ? 'antes' : 'cualquiera'}
          aria-label='Cuándo aplica'
          onChange={(e) =>
            onCambiar({
              ...r,
              listoAntesDe: e.target.value === 'antes' ? '11:35' : null,
            })
          }
        >
          <option value='antes'>antes de las</option>
          <option value='cualquiera'>a cualquier otra hora</option>
        </select>
        {r.listoAntesDe && (
          <Input
            type='time'
            value={r.listoAntesDe}
            className='w-32'
            aria-label='Hora límite'
            onChange={(e) => onCambiar({ ...r, listoAntesDe: e.target.value })}
          />
        )}
      </div>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <span>se entrega</span>
        <select
          className={selectCls}
          value={accion.tipo}
          aria-label='Qué pasa con la entrega'
          onChange={(e) => cambiarAccion(e.target.value as AccionRegla['tipo'])}
        >
          <option value='horas'>el mismo día, máximo</option>
          <option value='dia_habil'>unos días hábiles después</option>
          <option value='listo'>en cuanto esté listo</option>
        </select>
        {accion.tipo === 'horas' && (
          <>
            <Input
              inputMode='decimal'
              value={String(accion.horas)}
              className='w-20'
              aria-label='Horas'
              onChange={(e) =>
                onCambiar({
                  ...r,
                  accion: {
                    tipo: 'horas',
                    horas: Number(e.target.value.replace(',', '.')) || 0,
                  },
                })
              }
            />
            <span>horas después</span>
          </>
        )}
        {accion.tipo === 'dia_habil' && (
          <>
            <Input
              inputMode='numeric'
              value={String(accion.dias)}
              className='w-20'
              aria-label='Días hábiles'
              onChange={(e) =>
                onCambiar({
                  ...r,
                  accion: {
                    ...accion,
                    dias: Number(e.target.value.replace(/\D/g, '')) || 0,
                  },
                })
              }
            />
            <span>
              {accion.dias === 1 ? 'día hábil' : 'días hábiles'} después, antes
              de las
            </span>
            <Input
              type='time'
              value={accion.antesDe}
              className='w-32'
              aria-label='Antes de las'
              onChange={(e) =>
                onCambiar({
                  ...r,
                  accion: { ...accion, antesDe: e.target.value },
                })
              }
            />
          </>
        )}
      </div>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <label className='flex items-center gap-2 text-sm'>
          <Switch
            checked={r.activa}
            onCheckedChange={(v) => onCambiar({ ...r, activa: v })}
          />
          {r.activa ? 'Encendida' : 'Apagada'}
        </label>
        <Button type='button' variant='ghost' size='sm' onClick={onBorrar}>
          <Trash2 /> Borrar regla
        </Button>
      </div>
    </li>
  )
}
