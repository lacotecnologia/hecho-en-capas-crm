import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Hand,
  Loader2,
  LogOut,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, mensajeDeError } from '@/lib/api'
import { irAPaso, terminarPractica, usePractica } from '@/lib/practica'
import { consultaSesion, type UsuarioSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PARTES, PASOS } from './pasos'

type Caja = { top: number; left: number; width: number; height: number }

const cruzan = (a: Caja, b: Caja) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

/**
 * Guía del recorrido de práctica: resalta el elemento de cada paso y
 * muestra qué hacer. Solo aparece mientras se practica.
 */
export function Recorrido() {
  const practica = usePractica()
  if (!practica) return null
  // Cada paso arranca de cero
  return (
    <Guia
      key={practica.paso}
      paso={practica.paso}
      voluntaria={practica.voluntaria}
    />
  )
}

function Guia({ paso: i, voluntaria }: { paso: number; voluntaria: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const ruta = useRouterState({ select: (s) => s.location.pathname })
  const paso = PASOS[Math.min(i, PASOS.length - 1)]
  const ultimo = i >= PASOS.length - 1
  const [objetivo, setObjetivo] = useState<Caja | null>(null)
  const [hecho, setHecho] = useState(false)
  const [encogida, setEncogida] = useState(false)
  /** Hay una ventana abierta que no es la del paso: la guía se achica sola. */
  const [tapada, setTapada] = useState(false)
  const tapabaAntes = useRef(false)
  const [terminando, setTerminando] = useState(false)
  const [atascado, setAtascado] = useState(false)
  const tarjeta = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<React.CSSProperties>({})
  const fueraDeLugar = !!paso.donde && !paso.donde.test(ruta)

  // Al empezar un paso: llevar a su pantalla y reiniciar
  useEffect(() => {
    if (paso.ir && ruta !== paso.ir) navigate({ to: paso.ir })
    const t = setTimeout(() => setAtascado(true), 90_000)
    let desplazado = false
    // Busca el elemento (puede tardar en aparecer) y lo centra una vez
    const buscar = setInterval(() => {
      const el = paso.objetivo
        ? document.querySelector(`[data-tour='${paso.objetivo}']`)
        : null
      if (el && !desplazado) {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        desplazado = true
      }
    }, 300)
    return () => {
      clearTimeout(t)
      clearInterval(buscar)
    }
    // Solo al cambiar de paso
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  // Sigue el elemento resaltado y revisa si ya hizo lo que se pide
  useEffect(() => {
    const revisar = () => {
      const el = paso.objetivo
        ? document.querySelector(`[data-tour='${paso.objetivo}']`)
        : null
      // Solo al abrir o cerrar una ventana (si la persona la vuelve a abrir, se respeta)
      const ventana = document.querySelector('[data-slot="dialog-content"]')
      const tapa = !!ventana && !(el && ventana.contains(el))
      if (tapa !== tapabaAntes.current) {
        tapabaAntes.current = tapa
        setTapada(tapa)
      }
      if (el) {
        const r = el.getBoundingClientRect()
        setObjetivo(
          r.width || r.height
            ? { top: r.top, left: r.left, width: r.width, height: r.height }
            : null
        )
      } else setObjetivo(null)
      if (paso.listo && !hecho && paso.listo()) setHecho(true)
    }
    revisar()
    const t = setInterval(revisar, 350)
    window.addEventListener('scroll', revisar, true)
    window.addEventListener('resize', revisar)
    return () => {
      clearInterval(t)
      window.removeEventListener('scroll', revisar, true)
      window.removeEventListener('resize', revisar)
    }
  }, [paso, hecho])

  // Lo hizo: felicita y sigue solo
  useEffect(() => {
    if (!hecho || !paso.hazlo || ultimo) return
    const t = setTimeout(() => irAPaso(i + 1), 1100)
    return () => clearTimeout(t)
  }, [hecho, paso, i, ultimo])

  // Ubica la tarjeta donde no tape lo que se está señalando
  useLayoutEffect(() => {
    const t = tarjeta.current
    if (!t) return
    const ancho = window.innerWidth
    const alto = window.innerHeight
    const h = t.offsetHeight
    const celular = ancho < 768
    const w = celular ? ancho - 16 : 380
    const opciones: Caja[] = celular
      ? [
          { top: alto - h - 8, left: 8, width: w, height: h },
          { top: 8, left: 8, width: w, height: h },
        ]
      : [
          { top: alto - h - 16, left: ancho - w - 16, width: w, height: h },
          { top: alto - h - 16, left: 16, width: w, height: h },
          { top: 72, left: ancho - w - 16, width: w, height: h },
          { top: 72, left: 16, width: w, height: h },
        ]
    const zona = objetivo && {
      top: objetivo.top - 8,
      left: objetivo.left - 8,
      width: objetivo.width + 16,
      height: objetivo.height + 16,
    }
    const elegida =
      opciones.find((o) => !zona || !cruzan(o, zona)) ?? opciones[0]
    setPos({ top: elegida.top, left: elegida.left, width: w })
  }, [objetivo, encogida, tapada, i, hecho, atascado])

  const terminar = async () => {
    setTerminando(true)
    try {
      const { usuario } = await api<{ usuario: UsuarioSesion }>(
        '/auth/recorrido',
        { method: 'POST' }
      )
      terminarPractica()
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== 'sesion',
      })
      queryClient.setQueryData(consultaSesion.queryKey, { usuario })
      toast.success('¡Listo! Ya puedes cotizar de verdad.')
      navigate({ to: '/', replace: true })
    } catch (e) {
      toast.error(mensajeDeError(e))
      setTerminando(false)
    }
  }

  const salir = () => {
    terminarPractica()
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'sesion' })
    navigate({ to: '/', replace: true })
  }

  const puedeSeguir = !paso.hazlo || hecho || atascado
  const chica = encogida || tapada

  return (
    <>
      {objetivo && !fueraDeLugar && (
        <div
          aria-hidden
          className='pointer-events-none fixed z-[60] rounded-xl ring-4 ring-marca-ambar transition-all duration-200'
          style={{
            top: objetivo.top - 6,
            left: objetivo.left - 6,
            width: objetivo.width + 12,
            height: objetivo.height + 12,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.28)',
          }}
        />
      )}
      <div
        ref={tarjeta}
        role='dialog'
        aria-label='Recorrido de práctica'
        className='fixed z-[70] grid gap-3 rounded-2xl border-2 border-marca-ambar bg-background p-4 shadow-2xl'
        style={{ ...pos, pointerEvents: 'auto' }}
      >
        <div className='flex items-center gap-2 text-xs font-medium text-muted-foreground'>
          <GraduationCap className='size-4 text-marca-naranja' />
          <span className='flex-1'>
            Práctica · Parte {paso.parte} de 4: {PARTES[paso.parte - 1]}
          </span>
          <button
            type='button'
            onClick={() => (tapada ? setTapada(false) : setEncogida((v) => !v))}
            aria-label={chica ? 'Ver el paso' : 'Achicar'}
            className='rounded p-1 hover:bg-accent'
          >
            {chica ? (
              <ChevronUp className='size-4' />
            ) : (
              <ChevronDown className='size-4' />
            )}
          </button>
        </div>
        <div
          className='h-1.5 overflow-hidden rounded-full bg-muted'
          role='progressbar'
          aria-valuenow={i + 1}
          aria-valuemin={1}
          aria-valuemax={PASOS.length}
        >
          <div
            className='h-full rounded-full bg-primary transition-all'
            style={{ width: `${((i + 1) / PASOS.length) * 100}%` }}
          />
        </div>
        {chica && paso.hazlo && !hecho && (
          <p className='text-sm font-medium'>Hazlo tú: {paso.hazlo}</p>
        )}
        {!chica && (
          <>
            <div className='grid gap-1'>
              <p className='text-xs text-muted-foreground'>
                Paso {i + 1} de {PASOS.length}
              </p>
              <h2 className='text-lg leading-snug font-bold'>{paso.titulo}</h2>
              <p className='text-sm'>{paso.texto}</p>
            </div>
            {paso.hazlo && (
              <p
                className={cn(
                  'flex items-start gap-2 rounded-lg p-2.5 text-sm font-medium',
                  hecho ? 'bg-primary/15 text-primary' : 'bg-marca-amarillo/25'
                )}
              >
                {hecho ? (
                  <Check className='mt-0.5 size-4 shrink-0' />
                ) : (
                  <Hand className='mt-0.5 size-4 shrink-0 text-marca-naranja' />
                )}
                {hecho ? '¡Muy bien!' : `Hazlo tú: ${paso.hazlo}`}
              </p>
            )}
            {fueraDeLugar && (
              <p className='text-sm text-muted-foreground'>
                Este paso es en la pantalla anterior.{' '}
                <button
                  type='button'
                  className='font-medium text-primary underline'
                  onClick={() => window.history.back()}
                >
                  Volver allá
                </button>
              </p>
            )}
            <div className='flex flex-wrap items-center gap-2'>
              {i > 0 && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => irAPaso(i - 1)}
                >
                  <ArrowLeft /> Atrás
                </Button>
              )}
              {voluntaria && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground'
                  onClick={salir}
                >
                  <LogOut /> Salir
                </Button>
              )}
              <span className='flex-1' />
              {ultimo ? (
                <Button onClick={terminar} disabled={terminando}>
                  {terminando ? (
                    <Loader2 className='animate-spin' />
                  ) : (
                    <Check />
                  )}
                  Terminar la práctica
                </Button>
              ) : paso.hazlo && !hecho && atascado ? (
                <Button variant='outline' onClick={() => irAPaso(i + 1)}>
                  ¿No te funciona? Saltar este paso
                </Button>
              ) : (
                <Button onClick={() => irAPaso(i + 1)} disabled={!puedeSeguir}>
                  Siguiente <ArrowRight />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
