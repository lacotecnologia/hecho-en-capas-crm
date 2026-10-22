import { queryOptions } from '@tanstack/react-query'
import { type TextosConfig, type ValoresConfig } from '@shared/configuracion'
import { api } from '@/lib/api'

export type ConfiguracionCompleta = {
  valores: ValoresConfig
  textos: TextosConfig
}

const base = {
  queryKey: ['configuracion'],
  queryFn: () => api<ConfiguracionCompleta>('/configuracion'),
}

/** Valores numéricos (tarifas, márgenes, tope, anticipo, días). */
export const consultaConfiguracion = queryOptions({
  ...base,
  select: (d: ConfiguracionCompleta) => d.valores,
})

/** Textos del negocio (WhatsApp, datos de pago, condiciones). */
export const consultaTextosNegocio = queryOptions({
  ...base,
  select: (d: ConfiguracionCompleta) => d.textos,
})

export const consultaConfiguracionCompleta = queryOptions(base)
