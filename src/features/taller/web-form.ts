import { type ProductoWeb } from '@shared/taller'
import { formatoPesos } from './formato'

/** Lo que se escribe en la tarjeta (los números como texto, como en el resto de la ficha). */
export type FormWeb = {
  visible: boolean
  precio: string
  etiqueta: string
  agrupar: boolean
  grupo: string
  tamano: string
}

export function formWebDe(w: ProductoWeb | undefined): FormWeb {
  return {
    visible: w?.visible ?? false,
    precio: w?.precio ? String(w.precio) : '',
    etiqueta: w?.etiqueta ?? '',
    agrupar: !!w?.grupo,
    grupo: w?.grupo ?? '',
    tamano: w?.tamano ?? '',
  }
}

export function datosWeb(f: FormWeb): ProductoWeb {
  const precio = Number(f.precio) || 0
  return {
    visible: f.visible,
    precio: precio > 0 ? precio : null,
    etiqueta: f.etiqueta.trim(),
    grupo: f.agrupar ? f.grupo.trim() : '',
    tamano: f.agrupar ? f.tamano.trim() : '',
  }
}

export function webCambio(f: FormWeb, w: ProductoWeb) {
  const d = datosWeb(f)
  return (
    d.visible !== w.visible ||
    d.precio !== w.precio ||
    d.etiqueta !== w.etiqueta ||
    d.grupo !== w.grupo ||
    d.tamano !== w.tamano
  )
}

/** Avisos que se ven mientras se escribe (el servidor revisa lo mismo al guardar). */
export function avisoPrecioWeb(f: FormWeb, precioFabrica: number) {
  const valor = Number(f.precio) || 0
  if (valor > 0 && valor % 1000 !== 0) return 'Escríbelo en miles redondos, por ejemplo 45000.'
  if (valor > 0 && precioFabrica > 0 && valor < precioFabrica) {
    return `No puede ser menor al precio de fábrica (${formatoPesos(precioFabrica)}).`
  }
  return undefined
}
