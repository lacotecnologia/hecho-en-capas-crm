import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DECLARACION_POR_DEFECTO,
  type DatosCobrador,
  type TipoDocumento,
  TIPOS_DOCUMENTO,
  validarDatosCobrador,
} from '@shared/cuenta-cobro'
import {
  ImageUp,
  Info,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Campo } from '@/components/campo'
import { consultaDatosCobrador, guardarDatosCobrador } from './api'
import { selectCls } from './estilos'

/**
 * Convierte la foto de la firma en un PNG liviano con el fondo transparente
 * (el papel blanco desaparece y queda solo el trazo).
 */
async function firmaComoPng(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo)
  try {
    const img = new window.Image()
    img.src = url
    await img.decode()
    const escala = Math.min(1, 600 / img.naturalWidth, 240 / img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala))
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const datos = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const px = datos.data
    for (let i = 0; i < px.length; i += 4) {
      const brillo = (px[i] + px[i + 1] + px[i + 2]) / 3
      // Lo claro (papel) se vuelve transparente; lo oscuro (tinta) se queda
      if (brillo > 200) px[i + 3] = 0
      else if (brillo > 150) px[i + 3] = Math.round(((200 - brillo) / 50) * 255)
    }
    ctx.putImageData(datos, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Configuración → Cuenta de cobro: datos de quien cobra y su firma. */
export function DatosCuentaCobro() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(consultaDatosCobrador)
  const guardados = data?.datos
  const [borrador, setBorrador] = useState<DatosCobrador | null>(null)
  const d = borrador ?? guardados
  const cambiada =
    !!borrador && JSON.stringify(borrador) !== JSON.stringify(guardados)
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(
    null
  )
  const [leyendoFirma, setLeyendoFirma] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)

  const cambiar = (c: Partial<DatosCobrador>) => {
    if (!d) return
    setBorrador({ ...d, ...c })
    setError(null)
  }

  const guardar = useMutation({
    mutationFn: () => guardarDatosCobrador(d!),
    onSuccess: (r) => {
      queryClient.setQueryData(consultaDatosCobrador.queryKey, r)
      queryClient.invalidateQueries({ queryKey: ['cuentas-cobro', 'pedido'] })
      setBorrador(null)
      toast.success(
        r.falta.length
          ? `Guardado. Para hacer cuentas de cobro todavía falta ${r.falta.join(', ')}.`
          : 'Datos guardados. Ya puedes hacer cuentas de cobro desde cada pedido.'
      )
    },
    onError: (e) =>
      setError(
        e instanceof ApiError
          ? { mensaje: e.message, campo: e.campo }
          : { mensaje: mensajeDeError(e) }
      ),
  })

  if (isLoading || !d) {
    return (
      <div className='grid gap-4'>
        {[0, 1].map((i) => (
          <Skeleton key={i} className='h-48 w-full rounded-xl' />
        ))}
      </div>
    )
  }

  const errorDe = (campo: string) =>
    error?.campo === campo ? error.mensaje : undefined

  const subirFirma = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) {
      setError({ campo: 'firma', mensaje: `"${f.name}" no es una foto. Sube JPG o PNG.` })
      return
    }
    setLeyendoFirma(true)
    try {
      cambiar({ firma: await firmaComoPng(f) })
    } catch {
      setError({ campo: 'firma', mensaje: 'No se pudo leer la foto. Intenta con otra.' })
    } finally {
      setLeyendoFirma(false)
      if (archivo.current) archivo.current.value = ''
    }
  }

  return (
    <form
      className='grid gap-6 pb-24'
      onSubmit={(e) => {
        e.preventDefault()
        const v = validarDatosCobrador(d)
        if (!v.ok) return setError({ mensaje: v.mensaje, campo: v.campo })
        if (cambiada) guardar.mutate()
      }}
    >
      <p className='flex gap-2 rounded-lg bg-marca-amarillo/20 p-3 text-sm'>
        <Info className='mt-0.5 size-4 shrink-0 text-marca-naranja' />
        <span>
          La cuenta de cobro solo vale si quien cobra <strong>no está obligado a facturar</strong>{' '}
          (persona natural no responsable de IVA). Si eso cambia, habla con tu
          contador antes de seguir usándola.
        </span>
      </p>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Quién cobra</CardTitle>
          <CardDescription>
            La persona a cuyo nombre salen todas las cuentas de cobro. Estos
            datos solo los ve el administrador y salen en el documento.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4 sm:grid-cols-2'>
          <Campo
            etiqueta='Nombre completo'
            ayuda='Como aparece en la cédula o el RUT.'
            error={errorDe('nombre')}
            className='sm:col-span-2'
          >
            {(id, ayuda) => (
              <Input
                id={id}
                aria-describedby={ayuda}
                value={d.nombre}
                onChange={(e) => cambiar({ nombre: e.target.value })}
              />
            )}
          </Campo>
          <Campo etiqueta='Tipo de documento'>
            {(id) => (
              <select
                id={id}
                className={selectCls}
                value={d.tipoDocumento}
                onChange={(e) =>
                  cambiar({ tipoDocumento: e.target.value as TipoDocumento })
                }
              >
                {Object.entries(TIPOS_DOCUMENTO).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          <Campo
            etiqueta='Número de documento'
            ayuda='Solo números; puedes usar puntos.'
            error={errorDe('documento')}
          >
            {(id, ayuda) => (
              <Input
                id={id}
                aria-describedby={ayuda}
                inputMode='numeric'
                value={d.documento}
                onChange={(e) => cambiar({ documento: e.target.value })}
              />
            )}
          </Campo>
          <Campo etiqueta='Dirección' ayuda='Opcional.' error={errorDe('direccion')}>
            {(id, ayuda) => (
              <Input
                id={id}
                aria-describedby={ayuda}
                value={d.direccion}
                onChange={(e) => cambiar({ direccion: e.target.value })}
              />
            )}
          </Campo>
          <Campo
            etiqueta='Ciudad'
            ayuda='Sale junto a la fecha: “Pereira, 24 de noviembre…”.'
            error={errorDe('ciudad')}
          >
            {(id, ayuda) => (
              <Input
                id={id}
                aria-describedby={ayuda}
                value={d.ciudad}
                onChange={(e) => cambiar({ ciudad: e.target.value })}
              />
            )}
          </Campo>
          <Campo etiqueta='Teléfono' ayuda='Opcional.' error={errorDe('telefono')}>
            {(id, ayuda) => (
              <Input
                id={id}
                aria-describedby={ayuda}
                inputMode='tel'
                value={d.telefono}
                onChange={(e) => cambiar({ telefono: e.target.value })}
              />
            )}
          </Campo>
          <Campo etiqueta='Correo' ayuda='Opcional.' error={errorDe('email')}>
            {(id, ayuda) => (
              <Input
                id={id}
                aria-describedby={ayuda}
                type='email'
                value={d.email}
                onChange={(e) => cambiar({ email: e.target.value })}
              />
            )}
          </Campo>
          <Campo
            etiqueta='Datos para pagar'
            ayuda='Banco, tipo y número de cuenta a nombre de esta persona. Salen al final.'
            error={errorDe('datosPago')}
            className='sm:col-span-2'
          >
            {(id, ayuda) => (
              <Textarea
                id={id}
                aria-describedby={ayuda}
                rows={3}
                value={d.datosPago}
                placeholder='Bancolombia ahorros 123-456789-00'
                onChange={(e) => cambiar({ datosPago: e.target.value })}
              />
            )}
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='text-lg'>Declaración y firma</CardTitle>
          <CardDescription>
            La declaración va antes de la firma. Si tu contador te pide otro
            texto (por ejemplo sobre retención en la fuente), escríbelo aquí.
          </CardDescription>
        </CardHeader>
        <CardContent className='grid gap-4'>
          <Campo
            etiqueta='Declaración'
            ayuda={
              d.declaracion.trim() !== DECLARACION_POR_DEFECTO ? (
                <button
                  type='button'
                  className='inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline'
                  onClick={() => cambiar({ declaracion: DECLARACION_POR_DEFECTO })}
                >
                  <RotateCcw className='size-3.5' /> Volver al texto sugerido
                </button>
              ) : (
                'Texto sugerido. Puedes cambiarlo.'
              )
            }
            error={errorDe('declaracion')}
          >
            {(id, ayuda) => (
              <Textarea
                id={id}
                aria-describedby={ayuda}
                rows={4}
                value={d.declaracion}
                onChange={(e) => cambiar({ declaracion: e.target.value })}
              />
            )}
          </Campo>

          <div className='grid gap-2'>
            <p className='text-sm font-medium'>Firma</p>
            <div className='flex flex-wrap items-end gap-4'>
              <div className='grid h-28 w-64 place-items-center rounded-lg border border-dashed bg-white'>
                {d.firma ? (
                  <img
                    src={d.firma}
                    alt='Firma guardada'
                    className='max-h-24 max-w-60 object-contain'
                  />
                ) : (
                  <span className='px-4 text-center text-sm text-muted-foreground'>
                    Sin firma: la línea sale vacía para firmar a mano
                  </span>
                )}
              </div>
              <div className='flex flex-wrap gap-2'>
                <input
                  ref={archivo}
                  type='file'
                  accept='image/*'
                  className='hidden'
                  onChange={(e) => subirFirma(e.target.files?.[0])}
                />
                <Button
                  type='button'
                  variant='outline'
                  disabled={leyendoFirma}
                  onClick={() => archivo.current?.click()}
                >
                  {leyendoFirma ? <Loader2 className='animate-spin' /> : <ImageUp />}
                  {d.firma ? 'Cambiar la firma' : 'Subir foto de la firma'}
                </Button>
                {d.firma && (
                  <Button
                    type='button'
                    variant='ghost'
                    onClick={() => cambiar({ firma: null })}
                  >
                    <Trash2 /> Quitar
                  </Button>
                )}
              </div>
            </div>
            <p className='text-sm text-muted-foreground'>
              Firma en una hoja blanca con lapicero negro y tómale una foto de
              cerca. El fondo blanco se quita solo.
            </p>
            {errorDe('firma') && (
              <p className='text-sm font-medium text-destructive' role='alert'>
                {errorDe('firma')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {error && !error.campo && (
        <p className='text-sm font-medium text-destructive' role='alert'>
          {error.mensaje}
        </p>
      )}

      <div className='sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur'>
        <p className='me-auto text-sm text-muted-foreground'>
          {cambiada ? 'Tienes cambios sin guardar.' : 'No hay cambios sin guardar.'}
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
          Guardar datos
        </Button>
      </div>
    </form>
  )
}
