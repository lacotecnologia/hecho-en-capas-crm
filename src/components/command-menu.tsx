import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Laptop, Moon, Sun } from 'lucide-react'
import { useSesion } from '@/lib/sesion'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { menuPara } from './layout/data/navegacion'
import { ScrollArea } from './ui/scroll-area'

/**
 * Buscador global (⌘K). Por ahora lleva a cada sección; cuando existan
 * clientes, pedidos y productos también los encontrará por nombre o código.
 */
export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const usuario = useSesion()

  const ejecutar = React.useCallback(
    (accion: () => unknown) => {
      setOpen(false)
      accion()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder='¿Qué buscas? Escribe una sección…' />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>No encontramos nada con esas palabras.</CommandEmpty>
          {menuPara(usuario.roles).map((grupo) => (
            <CommandGroup key={grupo.titulo} heading={grupo.titulo}>
              {grupo.items.map((item) => (
                <CommandItem
                  key={item.url}
                  value={`${item.titulo} ${item.descripcion}`}
                  onSelect={() => ejecutar(() => navigate({ to: item.url }))}
                >
                  <item.icono className='text-muted-foreground' />
                  <span>{item.titulo}</span>
                  <span className='ms-2 truncate text-xs text-muted-foreground'>
                    {item.descripcion}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading='Apariencia'>
            <CommandItem onSelect={() => ejecutar(() => setTheme('light'))}>
              <Sun /> <span>Modo claro</span>
            </CommandItem>
            <CommandItem onSelect={() => ejecutar(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Modo oscuro</span>
            </CommandItem>
            <CommandItem onSelect={() => ejecutar(() => setTheme('system'))}>
              <Laptop />
              <span>Igual que el equipo</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
