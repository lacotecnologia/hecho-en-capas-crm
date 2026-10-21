import { useEffect } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/theme-provider'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

/** Un solo botón: alterna entre modo claro (por defecto) y modo oscuro. */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()
  const oscuro = resolvedTheme === 'dark'
  const texto = oscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro'

  useEffect(() => {
    const meta = document.querySelector("meta[name='theme-color']")
    if (meta) meta.setAttribute('content', oscuro ? '#121212' : '#ffffff')
  }, [oscuro])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='rounded-full'
          onClick={() => setTheme(oscuro ? 'light' : 'dark')}
          aria-label={texto}
        >
          {oscuro ? <Sun className='size-5' /> : <Moon className='size-5' />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{texto}</TooltipContent>
    </Tooltip>
  )
}
