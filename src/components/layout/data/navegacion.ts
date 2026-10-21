import { type Rol } from '@shared/roles'
import {
  ClipboardList,
  Home,
  type LucideIcon,
  Printer,
  Settings2,
  Truck,
  Users,
  Wallet,
  FileText,
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
        roles: ['admin', 'comercial', 'fabricacion'],
      },
      {
        titulo: 'Taller',
        url: '/taller',
        icono: Printer,
        descripcion: 'Productos, precios de fábrica y cola de impresión',
        roles: ['admin', 'comercial', 'fabricacion'],
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
  return MENU.map((grupo) => ({
    ...grupo,
    items: grupo.items.filter((item) =>
      item.roles.some((r) => roles.includes(r))
    ),
  })).filter((grupo) => grupo.items.length > 0)
}
