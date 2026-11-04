import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type Modalidad, MODALIDADES } from '@shared/cotizacion'
import {
  calcularPromesa,
  claveExistencia,
  type LineaPromesa,
  type LineaResultado,
  momento,
  type Promesa,
} from '@shared/promesa'
import { type ProductoResumen } from '@shared/taller'
import { consultaTallerCotizar } from './api'

export type LineaParaEntrega = {
  productoId: number
  cantidad: number
  bobinaId: number | null
  /** Lleva nombre o texto: siempre se imprime y suma el ajuste del diseño. */
  personaliza: boolean
}

/**
 * Calcula, mientras se escribe, cuándo se entregaría si el cliente confirma
 * ahora (con la cola real del taller). También para cada forma de entrega.
 */
export function usePromesaCotizacion(
  lineas: LineaParaEntrega[],
  modalidad: Modalidad,
  catalogo: Map<number, ProductoResumen>
) {
  const { data: taller, isLoading, isError } = useQuery(consultaTallerCotizar)
  // Las líneas cambian de objeto en cada render: se comparan por contenido
  const clave = JSON.stringify(lineas)
  return useMemo(() => {
    const lineas = JSON.parse(clave) as LineaParaEntrega[]
    if (!taller || catalogo.size === 0) {
      return {
        cargando: isLoading,
        error: isError,
        promesa: null,
        porModalidad: null,
      }
    }
    const existencias: Record<string, number> = {}
    const lineasPromesa: LineaPromesa[] = []
    lineas.forEach((l, i) => {
      const p = catalogo.get(l.productoId)
      if (!p) return
      if (p.escogeColor) {
        for (const c of p.colores)
          existencias[claveExistencia(p.id, c.bobinaId)] = c.stock
      } else {
        existencias[claveExistencia(p.id, null)] = p.stock
      }
      lineasPromesa.push({
        clave: String(i),
        nombre: p.nombre,
        cantidad: l.cantidad,
        claveExistencia: claveExistencia(
          p.id,
          p.escogeColor ? l.bobinaId : null
        ),
        horasPorUnidad: p.tiempos.horasPorUnidad,
        unidadesPorCama: p.tiempos.unidadesPorCama,
        minPreparacion: p.tiempos.minPreparacion,
        minAcabado: p.tiempos.minAcabado,
        multicolor: p.multicolor,
        usaExistencias: !l.personaliza,
        minDiseno: l.personaliza ? p.personalizacion.minutos * l.cantidad : 0,
      })
    })
    const desde = new Date()
    const calcular = (m: Modalidad) =>
      lineasPromesa.length
        ? calcularPromesa({
            desde,
            lineas: lineasPromesa,
            modalidad: m,
            agenda: taller.agenda,
            taller: taller.taller,
            existencias,
          })
        : null
    const porModalidad = Object.fromEntries(
      MODALIDADES.map((m) => [m, calcular(m)])
    ) as Record<Modalidad, Promesa | null>
    return {
      cargando: false,
      error: false,
      promesa: porModalidad[modalidad],
      porModalidad,
    }
  }, [clave, modalidad, catalogo, taller, isLoading, isError])
}

/** Frase corta de disponibilidad de una línea, con el resultado de la calculadora. */
export function disponibilidad(r: LineaResultado | undefined, ahora: string) {
  if (!r) return null
  if (r.aImprimir === 0) {
    return {
      tono: 'listo' as const,
      texto: `${r.deExistencia} ${r.deExistencia === 1 ? 'lista' : 'listas'} en existencia`,
    }
  }
  const imprime = `${r.deExistencia ? `faltan ${r.aImprimir}: ` : ''}se ${r.aImprimir === 1 ? 'imprime' : 'imprimen'} en la ${r.impresora}, lista ${momento(r.listaEn, ahora)}`
  return {
    tono: 'imprime' as const,
    texto: r.deExistencia
      ? `${r.deExistencia} en existencia, ${imprime}`
      : imprime,
  }
}

/** Frase corta por forma de entrega (para los botones de modalidad). */
export function fraseCorta(p: Promesa | null) {
  if (!p) return 'Agrega productos'
  if (!p.ok) return 'Sin regla de entrega'
  return p.frase.charAt(0).toUpperCase() + p.frase.slice(1)
}
