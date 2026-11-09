import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ETIQUETAS_WEB_SUGERIDAS, type ProductoDetalle } from '@shared/taller'
import { ExternalLink, Globe, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ApiError, mensajeDeError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Campo, CampoNumero } from '@/components/campo'
import { consultaGruposWeb, guardarWeb } from './api'
import { formatoPesos } from './formato'

export const DIRECCION_WEB = 'https://hechoencapas.vercel.app'

/** Solo el administrador: si el producto sale en la página web, a qué precio y cómo. */
export function TarjetaWeb({ producto }: { producto: ProductoDetalle }) {
  const queryClient = useQueryClient()
  const { data: grupos = [] } = useQuery(consultaGruposWeb)
  const w = producto.web
  const [visible, setVisible] = useState(w.visible)
  const [precio, setPrecio] = useState(w.precio ? String(w.precio) : '')
  const [etiqueta, setEtiqueta] = useState(w.etiqueta)
  const [agrupar, setAgrupar] = useState(!!w.grupo)
  const [grupo, setGrupo] = useState(w.grupo)
  const [tamano, setTamano] = useState(w.tamano)
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null)

  const valor = Number(precio) || 0
  const fabrica = producto.precioFabrica
  const bajo = valor > 0 && fabrica > 0 && valor < fabrica
  const noRedondo = valor > 0 && valor % 1000 !== 0
  const ganancia = valor > fabrica && fabrica > 0 ? valor - fabrica : 0

  const datos = {
    visible,
    precio: valor > 0 ? valor : null,
    etiqueta: etiqueta.trim(),
    grupo: agrupar ? grupo.trim() : '',
    tamano: agrupar ? tamano.trim() : '',
  }
  const sinCambios =
    datos.visible === w.visible &&
    datos.precio === w.precio &&
    datos.etiqueta === w.etiqueta &&
    datos.grupo === w.grupo &&
    datos.tamano === w.tamano

  const guardar = useMutation({
    mutationFn: () => guardarWeb(producto.id, datos),
    onSuccess: ({ producto: nuevo }) => {
      queryClient.invalidateQueries({ queryKey: ['taller'] })
      setError(null)
      toast.success(
        nuevo.web.visible
          ? 'Listo. En un minuto se ve así en la página web.'
          : 'Listo. Este producto no sale en la página web.'
      )
    },
    onError: (e) =>
      setError({
        mensaje: mensajeDeError(e),
        campo: e instanceof ApiError ? e.campo : undefined,
      }),
  })

  const errorDe = (campo: string) => (error?.campo === campo ? error.mensaje : undefined)
  const inactivo = producto.estado === 'inactivo'

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Globe className='size-5' />
          Página web
        </CardTitle>
        <CardDescription>
          Cómo lo ven los clientes en{' '}
          <a
            href={DIRECCION_WEB}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4'
          >
            hechoencapas.vercel.app
            <ExternalLink className='size-3.5' />
          </a>
          . Solo el administrador lo cambia. Las fotos son las de arriba.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-5'>
        <label className='flex items-center justify-between gap-3 rounded-xl border p-3'>
          <span>
            <span className='block font-medium'>Mostrar en la página web</span>
            <span className='block text-sm text-muted-foreground'>
              {inactivo
                ? 'Este producto está inactivo: no sale en la web aunque lo prendas.'
                : 'Los clientes lo ven y lo pueden pedir por WhatsApp.'}
            </span>
          </span>
          <Switch checked={visible} onCheckedChange={setVisible} aria-label='Mostrar en la página web' />
        </label>

        <CampoNumero
          etiqueta='Precio al público'
          unidad='COP'
          valor={precio}
          onChange={setPrecio}
          placeholder='Vacío = "Consulta el precio"'
          ayuda={
            fabrica > 0
              ? `Déjalo vacío y la web dirá "Consulta el precio". En miles redondos, mínimo ${formatoPesos(fabrica)} (el precio de fábrica).`
              : 'Déjalo vacío y la web dirá "Consulta el precio". En miles redondos. Cuando costees el producto, no podrá quedar por debajo del precio de fábrica.'
          }
          error={
            bajo
              ? `No puede ser menor al precio de fábrica (${formatoPesos(fabrica)}).`
              : noRedondo
                ? 'Escríbelo en miles redondos, por ejemplo 45000.'
                : errorDe('precio')
          }
        />
        {ganancia > 0 && (
          <p className='-mt-3 text-sm text-muted-foreground'>
            Sobre el precio de fábrica quedan{' '}
            <strong className='text-foreground tabular-nums'>{formatoPesos(ganancia)}</strong> por
            unidad.
          </p>
        )}

        <Campo
          etiqueta='Sello de la tarjeta (opcional)'
          ayuda='Una o dos palabras que salen sobre la foto, por ejemplo "De temporada".'
        >
          {(id, ayudaId) => (
            <>
              <Input
                id={id}
                list='etiquetas-web'
                value={etiqueta}
                maxLength={24}
                aria-describedby={ayudaId}
                onChange={(e) => setEtiqueta(e.target.value)}
              />
              <datalist id='etiquetas-web'>
                {ETIQUETAS_WEB_SUGERIDAS.map((e) => (
                  <option key={e} value={e} />
                ))}
              </datalist>
            </>
          )}
        </Campo>

        <div className='grid gap-4 rounded-xl border p-3'>
          <label className='flex items-center justify-between gap-3'>
            <span>
              <span className='block font-medium'>Es un tamaño de otro producto</span>
              <span className='block text-sm text-muted-foreground'>
                Ej.: "Reno 3D" de 9 cm y de 12 cm salen en una sola tarjeta y el cliente toca el
                tamaño.
              </span>
            </span>
            <Switch checked={agrupar} onCheckedChange={setAgrupar} aria-label='Es un tamaño de otro producto' />
          </label>
          {agrupar && (
            <div className='grid gap-4 sm:grid-cols-2'>
              <Campo
                etiqueta='Nombre en la tarjeta'
                ayuda='Escríbelo igual en todos los tamaños del mismo producto.'
                error={errorDe('grupo')}
              >
                {(id, ayudaId) => (
                  <>
                    <Input
                      id={id}
                      list='grupos-web'
                      value={grupo}
                      maxLength={60}
                      placeholder='Reno 3D'
                      aria-describedby={ayudaId}
                      onChange={(e) => setGrupo(e.target.value)}
                    />
                    <datalist id='grupos-web'>
                      {grupos.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  </>
                )}
              </Campo>
              <Campo
                etiqueta='Tamaño'
                ayuda='Lo que dice el botón, ej. "9 cm".'
                error={errorDe('tamano')}
              >
                {(id, ayudaId) => (
                  <Input
                    id={id}
                    value={tamano}
                    maxLength={30}
                    placeholder='9 cm'
                    aria-describedby={ayudaId}
                    onChange={(e) => setTamano(e.target.value)}
                  />
                )}
              </Campo>
            </div>
          )}
        </div>

        {error && !error.campo && (
          <p className='text-sm font-medium text-destructive' role='alert'>
            {error.mensaje}
          </p>
        )}
        <Button
          type='button'
          size='lg'
          onClick={() => guardar.mutate()}
          disabled={guardar.isPending || sinCambios || bajo || noRedondo}
        >
          {guardar.isPending && <Loader2 className='animate-spin' />}
          Guardar cambios de la página web
        </Button>
      </CardContent>
    </Card>
  )
}
