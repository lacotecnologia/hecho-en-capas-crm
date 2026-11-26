import { Input } from '@/components/ui/input'
import { Campo } from '@/components/campo'
import { type DatosCliente } from './api'

/** Los campos del cliente (crear, editar y desde la cotización). */
export function CamposCliente({
  f,
  cambiar,
  errorDe,
  enfocar = false,
}: {
  f: DatosCliente
  cambiar: (c: Partial<DatosCliente>) => void
  errorDe: (campo: string) => string | undefined
  enfocar?: boolean
}) {
  const set =
    (k: keyof DatosCliente) => (e: React.ChangeEvent<HTMLInputElement>) =>
      cambiar({ [k]: e.target.value })
  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      <Campo
        etiqueta='Nombre o empresa'
        ayuda='Como lo conoces o como sale en su RUT.'
        error={errorDe('nombre')}
        className='sm:col-span-2'
      >
        {(id, ayuda) => (
          <Input
            id={id}
            aria-describedby={ayuda}
            value={f.nombre}
            onChange={set('nombre')}
            autoFocus={enfocar}
          />
        )}
      </Campo>
      <Campo
        etiqueta='WhatsApp'
        ayuda='Para mandarle cotizaciones y el seguimiento.'
        error={errorDe('whatsapp')}
      >
        {(id, ayuda) => (
          <Input
            id={id}
            aria-describedby={ayuda}
            inputMode='tel'
            placeholder='300 123 4567'
            value={f.whatsapp}
            onChange={set('whatsapp')}
          />
        )}
      </Campo>
      <Campo etiqueta='Correo' ayuda='Opcional.' error={errorDe('email')}>
        {(id, ayuda) => (
          <Input
            id={id}
            aria-describedby={ayuda}
            type='email'
            value={f.email}
            onChange={set('email')}
          />
        )}
      </Campo>
      <Campo etiqueta='Ciudad' ayuda='Para calcular el envío.'>
        {(id, ayuda) => (
          <Input
            id={id}
            aria-describedby={ayuda}
            value={f.ciudad}
            onChange={set('ciudad')}
          />
        )}
      </Campo>
      <Campo
        etiqueta='Cédula o NIT'
        ayuda='Opcional. Lo piden las empresas para la cuenta de cobro.'
      >
        {(id, ayuda) => (
          <Input
            id={id}
            aria-describedby={ayuda}
            value={f.documento}
            onChange={set('documento')}
          />
        )}
      </Campo>
      <Campo
        etiqueta='Dirección'
        ayuda='Para domicilios y envíos.'
        className='sm:col-span-2'
      >
        {(id, ayuda) => (
          <Input
            id={id}
            aria-describedby={ayuda}
            value={f.direccion}
            onChange={set('direccion')}
          />
        )}
      </Campo>
    </div>
  )
}
