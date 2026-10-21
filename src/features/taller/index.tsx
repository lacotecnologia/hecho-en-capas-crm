import { useNavigate, useSearch } from '@tanstack/react-router'
import { tieneRol, useSesion } from '@/lib/sesion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Pagina } from '@/components/layout/pagina'
import { Bobinas } from './bobinas'
import { Impresoras } from './impresoras'
import { ProductosLista } from './productos-lista'

export type PestanaTaller = 'productos' | 'impresoras' | 'bobinas'

export function Taller() {
  const usuario = useSesion()
  const esTaller = tieneRol(usuario, ['admin', 'fabricacion'])
  const { pestana = 'productos' } = useSearch({
    from: '/_authenticated/taller/',
  })
  const navigate = useNavigate({ from: '/taller/' })

  if (!esTaller) {
    return (
      <Pagina
        titulo='Catálogo'
        descripcion='Productos listos para cotizar, con su precio de fábrica.'
      >
        <ProductosLista puedeEditar={false} />
      </Pagina>
    )
  }

  return (
    <Pagina
      titulo='Taller'
      descripcion='Productos, precios de fábrica, impresoras y bobinas.'
    >
      <Tabs
        value={pestana}
        onValueChange={(v) =>
          navigate({ search: { pestana: v as PestanaTaller }, replace: true })
        }
        className='gap-4'
      >
        <TabsList>
          <TabsTrigger value='productos'>Productos</TabsTrigger>
          <TabsTrigger value='impresoras'>Impresoras</TabsTrigger>
          <TabsTrigger value='bobinas'>Bobinas</TabsTrigger>
        </TabsList>
        <TabsContent value='productos'>
          <ProductosLista puedeEditar />
        </TabsContent>
        <TabsContent value='impresoras'>
          <Impresoras />
        </TabsContent>
        <TabsContent value='bobinas'>
          <Bobinas />
        </TabsContent>
      </Tabs>
    </Pagina>
  )
}
