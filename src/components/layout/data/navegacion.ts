import { type Rol } from '@shared/roles'
import {
  ClipboardList,
  Home,
  type LucideIcon,
  Package,
  Printer,
  Settings2,
  Truck,
  Users,
  Wallet,
  FileText,
  Layers,
  BarChart3,
} from 'lucide-react'

export type ItemMenu = {
  titulo: string
  url: string
  icono: LucideIcon
  /** Frase corta que explica para qué sirve (se usa en Inicio y en el buscador). */
  descripcion: string
  roles: readonly Rol[]
}

export type GrupoMenu = { titulo: string; items: ItemMenu[] }

const TODOS: readonly Rol[] = ['admin', 'comercial', 'fabricacion', 'entregas']

/**
 * Menú del sistema. Nombres cortos y en palabras del negocio.
 * Cada persona solo ve lo que su rol usa.
 */
export const MENU: GrupoMenu[] = [
  {
    titulo: 'Día a día',
    items: [
      {
        titulo: 'Inicio',
        url: '/',
        icono: Home,
        descripcion: 'Tus pendientes de hoy',
        roles: TODOS,
      },
      {
        titulo: 'Cotizar',
        url: '/cotizar',
        icono: FileText,
        descripcion: 'Arma una cotización y descarga el PDF para el cliente',
        roles: ['admin', 'comercial'],
      },
      {
        titulo: 'Pedidos',
        url: '/pedidos',
        icono: ClipboardList,
        descripcion: 'Mira en qué va cada pedido',
        roles: ['admin', 'comercial', 'fabricacion', 'entregas'],
      },
      {
        titulo: 'Cola de impresión',
        url: '/cola',
        icono: Layers,
        descripcion: 'Qué se está imprimiendo y qué sigue',
        roles: ['admin', 'fabricacion', 'comercial'],
      },
      {
        titulo: 'Taller',
        url: '/taller',
        icono: Printer,
        descripcion: 'Productos, impresoras, bobinas y precios de fábrica',
        roles: ['admin', 'fabricacion'],
      },
      {
        titulo: 'Catálogo',
        url: '/taller',
        icono: Package,
        descripcion: 'Productos listos para cotizar y su precio de fábrica',
        roles: ['comercial'],
      },
      {
        titulo: 'Cobros',
        url: '/cobros',
        icono: Wallet,
        descripcion: 'Anticipos, abonos y saldos por cobrar',
        roles: ['admin', 'comercial'],
      },
      {
        titulo: 'Entregas',
        url: '/entregas',
        icono: Truck,
        descripcion: 'Domicilios y envíos por transportadora',
        roles: ['admin', 'comercial', 'entregas'],
      },
      {
        titulo: 'Reportes',
        url: '/reportes',
        icono: BarChart3,
        descripcion: 'Ventas, ganancia de cada comercial y lo que falta cobrar',
        roles: ['admin', 'comercial'],
      },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      {
        titulo: 'Personas',
        url: '/personas',
        icono: Users,
        descripcion: 'Quién puede entrar al sistema y qué puede hacer',
        roles: ['admin'],
      },
      {
        titulo: 'Configuración',
        url: '/configuracion',
        icono: Settings2,
        descripcion: 'Tarifas, márgenes, anticipo y tiempos',
        roles: ['admin'],
      },
    ],
  },
]

export function menuPara(roles: readonly Rol[]): GrupoMenu[] {
  const vistas = new Set<string>()
  return MENU.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) => {
      if (!item.roles.some((r) => roles.includes(r)) || vistas.has(item.url))
        return false
      vistas.add(item.url)
      return true
    }),
  })).filter((grupo) => grupo.items.length > 0)
}
