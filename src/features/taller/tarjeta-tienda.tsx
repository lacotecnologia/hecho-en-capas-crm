import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type ProductoDetalle } from '@shared/taller'
import { Loader2, Store } from 'lucide-react'
import { toast } from 'sonner'
import { mensajeDeError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { CampoNumero } from '@/components/campo'
import { guardarPrecioTienda } from './api'
import { formatoPesos } from './formato'

/** Solo Admin: precio al público y si el producto sale en la tienda web. */
export function TarjetaTienda({ producto }: { producto: ProductoDetalle }) {
  const queryClient = useQueryClient()
  const [precio, setPrecio] = useState(
    producto.precioTienda ? String(producto.precioTienda) : ''
  )
  const [visible, setVisible] = useState(producto.enTienda)
  const [error, setError] = useState<string | null>(null)

  const valor = Number(precio) || 0
  const bajo = valor > 0 && valor < producto.precioFabrica
  const sinCambios =
    valor === (producto.precioTienda ?? 0) && visible === producto.enTienda
  const ganancia =
    valor > producto.precioFabrica ? valor - producto.precioFabrica : 0

  const guardar = useMutation({
    mutationFn: () =>
      guardarPrecioTienda(producto.id, {
        precioTienda: valor > 0 ? valor : null,
        enTienda: visible,
      }),
    onSuccess: ({ producto: nuevo }) => {
      queryClient.invalidateQueries({ queryKey: ['taller'] })
      setError(null)
      toast.success(
        nuevo.enTienda
          ? 'Listo. El producto ya se ve en la tienda.'
          : 'Listo. El producto no se muestra en la tienda.'
      )
    },
    onError: (e) => setError(mensajeDeError(e)),
  })

  const estaActivo = producto.estado === 'activo'

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <Store className='size-5' />
          Tienda en línea
        </CardTitle>
        <CardDescription>
          El precio que paga el público en la página web. Solo lo ve y lo cambia
          el administrador.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4'>
        <CampoNumero
          etiqueta='Precio al público'
          unidad='COP'
          valor={precio}
          onChange={setPrecio}
          ayuda={`En miles redondos. Mínimo ${formatoPesos(producto.precioFabrica)} (el precio de fábrica).`}
          error={
            bajo
              ? `No puede ser menor al precio de fábrica (${formatoPesos(producto.precioFabrica)}).`
              : undefined
          }
        />
        {ganancia > 0 && (
          <p className='text-sm text-muted-foreground'>
            Sobre el precio de fábrica quedan{' '}
            <strong className='text-foreground tabular-nums'>
              {formatoPesos(ganancia)}
            </strong>{' '}
            por unidad.
          </p>
        )}
        <label className='flex items-center justify-between gap-3 rounded-xl border p-3'>
          <span>
            <span className='block font-medium'>Mostrar en la tienda</span>
            <span className='block text-sm text-muted-foreground'>
              {estaActivo
                ? 'Los clientes lo podrán pedir desde la web.'
                : 'Primero pasa el producto a “Listo para vender”.'}
            </span>
          </span>
          <Switch
            checked={visible}
            disabled={!estaActivo && !visible}
            onCheckedChange={setVisible}
          />
        </label>
        {error && (
          <p className='text-sm font-medium text-destructive' role='alert'>
            {error}
          </p>
        )}
        <Button
          type='button'
          onClick={() => guardar.mutate()}
          disabled={guardar.isPending || sinCambios || bajo}
        >
          {guardar.isPending && <Loader2 className='animate-spin' />}
          Guardar precio de tienda
        </Button>
      </CardContent>
    </Card>
  )
}
