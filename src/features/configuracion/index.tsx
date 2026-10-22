import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CAMPOS_CONFIG,
  GRUPOS_CONFIG,
  TEXTOS_CONFIG,
  type CampoConfig,
  type GrupoConfig,
} from '@shared/configuracion'
import { Loader2, Save, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Pagina } from '@/components/layout/pagina'
import {
  type ConfiguracionCompleta,
  consultaConfiguracionCompleta,
} from './api'

const DESCRIPCION_GRUPO: Record<GrupoConfig, string> = {
  costos:
    'Con estos valores el taller calcula cuánto cuesta fabricar cada producto.',
  precios:
    'Definen el precio de fábrica y hasta dónde puede subirlo el comercial.',
  cotizaciones: 'Reglas que se aplican solas a cada cotización.',
  envios:
    'Se suman al tiempo de fabricación para calcular la fecha de entrega.',
}

const formato = new Intl.NumberFormat('es-CO')

export function Configuracion() {
  const queryClient = useQueryClient()
  const { data: completo, isLoading } = useQuery(consultaConfiguracionCompleta)
  const guardados = completo?.valores
  const textosGuardados = completo?.textos
  const [edicionesTexto, setEdicionesTexto] = useState<Record<string, string>>(
    {}
  )
  const textos = useMemo(
    () => ({ ...(textosGuardados ?? {}), ...edicionesTexto }),
    [textosGuardados, edicionesTexto]
  )
  const textosCambiados = TEXTOS_CONFIG.filter(
    (c) => textosGuardados && textos[c.clave] !== textosGuardados[c.clave]
  )
  // Solo se guardan en estado los campos que la persona ha tocado;
  // el resto se muestra tal como viene del servidor.
  const [ediciones, setEdiciones] = useState<Record<string, string>>({})
  const valores = useMemo(
    () => ({
      ...Object.fromEntries(
        Object.entries(guardados ?? {}).map(([k, v]) => [k, String(v)])
      ),
      ...ediciones,
    }),
    [guardados, ediciones]
  )

  const cambiados = useMemo(
    () =>
      CAMPOS_CONFIG.filter(
        (c) => guardados && valores[c.clave] !== String(guardados[c.clave])
      ),
    [valores, guardados]
  )

  const errores = useMemo(() => {
    const e: Record<string, string> = {}
    for (const campo of CAMPOS_CONFIG) {
      const texto = valores[campo.clave]
      const n = Number(texto)
      if (texto === undefined) continue
      if (texto.trim() === '' || !Number.isFinite(n)) {
        e[campo.clave] = 'Escribe un número.'
      } else if (n < campo.min || n > campo.max) {
        e[campo.clave] =
          `Debe estar entre ${formato.format(campo.min)} y ${formato.format(campo.max)}.`
      }
    }
    return e
  }, [valores])

  const guardar = useMutation({
    mutationFn: () =>
      api<ConfiguracionCompleta>('/configuracion', {
        method: 'PUT',
        body: {
          valores: Object.fromEntries(
            cambiados.map((c) => [c.clave, Number(valores[c.clave])])
          ),
          textos: Object.fromEntries(
            textosCambiados.map((c) => [c.clave, textos[c.clave]])
          ),
        },
      }),
    onSuccess: (datos) => {
      queryClient.setQueryData(consultaConfiguracionCompleta.queryKey, datos)
      setEdiciones({})
      setEdicionesTexto({})
      toast.success(
        totalCambios === 1
          ? 'Cambio guardado. Se usará desde ahora en adelante.'
          : `${totalCambios} cambios guardados. Se usarán desde ahora en adelante.`
      )
    },
  })

  const totalCambios = cambiados.length + textosCambiados.length
  const hayErrores = Object.keys(errores).length > 0
  const grupos = Object.keys(GRUPOS_CONFIG) as GrupoConfig[]

  return (
    <Pagina
      titulo='Configuración'
      descripcion='Valores del negocio. Los cambios aplican a lo nuevo; lo ya cotizado no cambia.'
    >
      {isLoading ? (
        <div className='grid gap-4'>
          {grupos.map((g) => (
            <Skeleton key={g} className='h-48 w-full rounded-xl' />
          ))}
        </div>
      ) : (
        <form
          className='grid gap-6 pb-24'
          onSubmit={(e) => {
            e.preventDefault()
            if (!hayErrores && totalCambios > 0) guardar.mutate()
          }}
        >
          {grupos.map((grupo) => (
            <Card key={grupo}>
              <CardHeader>
                <CardTitle className='text-lg'>
                  {GRUPOS_CONFIG[grupo]}
                </CardTitle>
                <CardDescription>{DESCRIPCION_GRUPO[grupo]}</CardDescription>
              </CardHeader>
              <CardContent className='grid gap-6 md:grid-cols-2'>
                {CAMPOS_CONFIG.filter((c) => c.grupo === grupo).map((campo) => (
                  <CampoNumero
                    key={campo.clave}
                    campo={campo}
                    valor={valores[campo.clave] ?? ''}
                    error={errores[campo.clave]}
                    cambiado={cambiados.includes(campo)}
                    onChange={(v) =>
                      setEdiciones((prev) => ({ ...prev, [campo.clave]: v }))
                    }
                  />
                ))}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className='text-lg'>Datos del negocio</CardTitle>
              <CardDescription>
                Salen en el PDF de cada cotización.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-6 md:grid-cols-2'>
              {TEXTOS_CONFIG.map((campo) => {
                const id = `texto-${campo.clave}`
                const cambiado = textosCambiados.includes(campo)
                const valor = textos[campo.clave] ?? ''
                const cambiar = (v: string) =>
                  setEdicionesTexto((p) => ({ ...p, [campo.clave]: v }))
                return (
                  <div
                    key={campo.clave}
                    className={`grid content-start gap-2 ${campo.largo ? 'md:col-span-2' : ''}`}
                  >
                    <Label htmlFor={id} className='flex items-center gap-2'>
                      {campo.etiqueta}
                      {cambiado && (
                        <span className='rounded-full bg-marca-amarillo/40 px-2 text-xs font-normal'>
                          sin guardar
                        </span>
                      )}
                    </Label>
                    {campo.largo ? (
                      <Textarea
                        id={id}
                        rows={4}
                        value={valor}
                        maxLength={campo.max}
                        onChange={(e) => cambiar(e.target.value)}
                      />
                    ) : (
                      <Input
                        id={id}
                        value={valor}
                        maxLength={campo.max}
                        onChange={(e) => cambiar(e.target.value)}
                      />
                    )}
                    <p className='text-sm text-muted-foreground'>
                      {campo.ayuda}
                    </p>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <div className='sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur'>
            <p className='me-auto text-sm text-muted-foreground'>
              {totalCambios === 0
                ? 'No hay cambios sin guardar.'
                : totalCambios === 1
                  ? 'Tienes 1 cambio sin guardar.'
                  : `Tienes ${totalCambios} cambios sin guardar.`}
            </p>
            <Button
              type='button'
              variant='outline'
              disabled={totalCambios === 0 || guardar.isPending}
              onClick={() => {
                setEdiciones({})
                setEdicionesTexto({})
              }}
            >
              <Undo2 /> Deshacer
            </Button>
            <Button
              type='submit'
              disabled={totalCambios === 0 || hayErrores || guardar.isPending}
            >
              {guardar.isPending ? (
                <Loader2 className='animate-spin' />
              ) : (
                <Save />
              )}
              Guardar cambios
            </Button>
          </div>
        </form>
      )}
    </Pagina>
  )
}

type CampoNumeroProps = {
  campo: CampoConfig
  valor: string
  error?: string
  cambiado: boolean
  onChange: (valor: string) => void
}

function CampoNumero({
  campo,
  valor,
  error,
  cambiado,
  onChange,
}: CampoNumeroProps) {
  const id = `config-${campo.clave}`
  return (
    <div className='grid content-start gap-2'>
      <Label htmlFor={id} className='flex items-center gap-2'>
        {campo.etiqueta}
        {cambiado && (
          <span className='rounded-full bg-marca-amarillo/40 px-2 text-xs font-normal'>
            sin guardar
          </span>
        )}
      </Label>
      <div className='relative'>
        <Input
          id={id}
          inputMode='decimal'
          value={valor}
          onChange={(e) => onChange(e.target.value.replace(',', '.'))}
          aria-invalid={!!error}
          aria-describedby={`${id}-ayuda`}
          className='pe-20 text-base'
        />
        <span className='pointer-events-none absolute inset-e-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground'>
          {campo.unidad}
        </span>
      </div>
      <p id={`${id}-ayuda`} className='text-sm text-muted-foreground'>
        {campo.ayuda}
      </p>
      {error && <p className='text-sm font-medium text-destructive'>{error}</p>}
    </div>
  )
}
