import { useQuery } from '@tanstack/react-query'
import { ETIQUETAS_WEB_SUGERIDAS, type ProductoDetalle } from '@shared/taller'
import { ExternalLink, Globe } from 'lucide-react'
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
import { consultaGruposWeb } from './api'
import { formatoPesos } from './formato'
import { avisoPrecioWeb, type FormWeb } from './web-form'

const DIRECCION_WEB = 'https://hechoencapas.vercel.app'

/**
 * Solo el administrador: si el producto sale en la página web, a qué precio y cómo.
 * Se guarda con el botón "Guardar cambios" de la ficha.
 */
export function TarjetaWeb({
  producto,
  valor: f,
  onChange,
  error,
}: {
  producto: ProductoDetalle
  valor: FormWeb
  onChange: (f: FormWeb) => void
  error?: { mensaje: string; campo?: string } | null
}) {
  const { data: grupos = [] } = useQuery(consultaGruposWeb)
  const set = <K extends keyof FormWeb>(k: K) => (v: FormWeb[K]) => onChange({ ...f, [k]: v })

  const fabrica = producto.precioFabrica
  const valor = Number(f.precio) || 0
  const ganancia = valor > fabrica && fabrica > 0 ? valor - fabrica : 0
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
          . Usa las fotos de arriba. Solo el administrador lo cambia; se guarda con
          "Guardar cambios" y en un minuto se ve en la web.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-5'>
        <label className='flex items-center justify-between gap-3 rounded-xl border p-3'>
          <span>
            <span className='block font-medium'>Mostrar en la página web</span>
            <span className='block text-sm text-muted-foreground'>
              {inactivo
                ? 'Este producto está retirado: no sale en la web aunque lo prendas.'
                : 'Los clientes lo ven y lo pueden pedir por WhatsApp.'}
            </span>
          </span>
          <Switch
            checked={f.visible}
            onCheckedChange={set('visible')}
            aria-label='Mostrar en la página web'
          />
        </label>

        <CampoNumero
          etiqueta='Precio al público'
          unidad='COP'
          valor={f.precio}
          onChange={set('precio')}
          placeholder='Vacío = "Consulta el precio"'
          ayuda={
            fabrica > 0
              ? `Déjalo vacío y la web dirá "Consulta el precio". En miles redondos, mínimo ${formatoPesos(fabrica)} (el precio de fábrica).`
              : 'Déjalo vacío y la web dirá "Consulta el precio". En miles redondos. Cuando costees el producto, no podrá quedar por debajo del precio de fábrica.'
          }
          error={avisoPrecioWeb(f, fabrica) ?? errorDe('precio')}
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
                value={f.etiqueta}
                maxLength={24}
                aria-describedby={ayudaId}
                onChange={(e) => set('etiqueta')(e.target.value)}
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
            <Switch
              checked={f.agrupar}
              onCheckedChange={set('agrupar')}
              aria-label='Es un tamaño de otro producto'
            />
          </label>
          {f.agrupar && (
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
                      value={f.grupo}
                      maxLength={60}
                      placeholder='Reno 3D'
                      aria-describedby={ayudaId}
                      onChange={(e) => set('grupo')(e.target.value)}
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
                    value={f.tamano}
                    maxLength={30}
                    placeholder='9 cm'
                    aria-describedby={ayudaId}
                    onChange={(e) => set('tamano')(e.target.value)}
                  />
                )}
              </Campo>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
