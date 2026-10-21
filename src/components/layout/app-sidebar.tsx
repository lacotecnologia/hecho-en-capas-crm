import { Link } from '@tanstack/react-router'
import { Logo, LogoIcono } from '@/assets/logo'
import { useSesion } from '@/lib/sesion'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { menuPara } from './data/navegacion'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const usuario = useSesion()
  const grupos = menuPara(usuario.roles)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <MarcaMenu />
      </SidebarHeader>
      <SidebarContent>
        {grupos.map((grupo) => (
          <NavGroup
            key={grupo.titulo}
            title={grupo.titulo}
            items={grupo.items.map((item) => ({
              title: item.titulo,
              url: item.url,
              icon: item.icono,
            }))}
          />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function MarcaMenu() {
  const { state, isMobile, setOpenMobile } = useSidebar()
  const contraido = state === 'collapsed' && !isMobile
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          size='lg'
          asChild
          className='hover:bg-transparent active:bg-transparent'
        >
          <Link
            to='/'
            onClick={() => setOpenMobile(false)}
            aria-label='Ir al inicio'
          >
            {contraido ? <LogoIcono className='size-8' /> : <Logo />}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
