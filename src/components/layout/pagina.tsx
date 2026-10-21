import { type ReactNode } from 'react'
import { EtiquetaPrueba } from '@/demo/aviso-prueba'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Header } from './header'
import { Main } from './main'

type PaginaProps = {
  titulo: string
  /** Una frase que explica para qué sirve esta pantalla. */
  descripcion?: string
  /** Botones a la derecha del título (por ejemplo el botón principal). */
  acciones?: ReactNode
  children: ReactNode
}

/** Estructura común de todas las pantallas privadas. */
export function Pagina({
  titulo,
  descripcion,
  acciones,
  children,
}: PaginaProps) {
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <EtiquetaPrueba />
        <ThemeSwitch />
      </Header>
      <Main>
        <div className='mb-6 flex flex-wrap items-end justify-between gap-4'>
          <div className='space-y-1'>
            <h1 className='text-2xl font-bold tracking-tight'>{titulo}</h1>
            {descripcion && (
              <p className='text-muted-foreground'>{descripcion}</p>
            )}
          </div>
          {acciones && <div className='flex gap-2'>{acciones}</div>}
        </div>
        {children}
      </Main>
    </>
  )
}
