/**
 * Calculadora de entrega: cuándo queda listo un pedido y cuándo se entrega,
 * con las existencias, la cola real de las impresoras, el horario del taller
 * y las reglas de entrega. La usan la pantalla (mientras se cotiza) y el
 * servidor (al guardar y al crear el pedido), para que den lo mismo.
 *
 * Colombia no cambia de hora: todo se calcula en hora de Bogotá (UTC−5).
 */
import {
  type Agenda,
  antesDeLa,
  diasSinTaller,
  horaLegible,
  minutosDeHora,
  type ReglaEntrega,
} from './agenda.js'
import { type Modalidad } from './cotizacion.js'

const MIN = 60_000
const HORA_MS = 3_600_000
const DIA = 86_400_000
const BOGOTA = -5 * HORA_MS

/** Milisegundos "en hora local": se leen con getUTC*. */
type Local = number
const aLocal = (d: Date | string): Local => new Date(d).getTime() + BOGOTA
const aReal = (l: Local) => new Date(l - BOGOTA)
const inicioDia = (l: Local) => Math.floor(l / DIA) * DIA
const minutosDelDia = (l: Local) => Math.floor((l - inicioDia(l)) / MIN)
const fechaIso = (l: Local) => new Date(l).toISOString().slice(0, 10)

// ---------- Entradas ----------

export type ImpresoraTaller = {
  id: number
  nombre: string
  multicolor: boolean
  /** Hora estimada en que termina lo que imprime; null = está libre. */
  libreEn: string | null
}

/** Un trabajo que ya está en la cola (en orden de llegada). */
export type TrabajoCola = {
  horas: number
  camas: number
  minPreparacion: number
  multicolor: boolean
}

export type EstadoTaller = {
  impresoras: ImpresoraTaller[]
  cola: TrabajoCola[]
}

export type LineaPromesa = {
  clave: string
  nombre: string
  cantidad: number
  /** Clave de existencias: "productoId:bobinaId" (bobina 0 = sin color). */
  claveExistencia: string
  horasPorUnidad: number
  unidadesPorCama: number
  /** Minutos por unidad. */
  minPreparacion: number
  minAcabado: number
  multicolor: boolean
  /** false en personalizados: siempre se imprime. */
  usaExistencias: boolean
  /** Minutos de ajustar el diseño (nombres), en total. */
  minDiseno: number
}

export type EntradaPromesa = {
  /** Cuándo confirma el cliente (o paga el anticipo). */
  desde: Date
  lineas: LineaPromesa[]
  modalidad: Modalidad
  agenda: Agenda
  taller: EstadoTaller
  /** Unidades listas por clave de existencia. */
  existencias: Record<string, number>
}

// ---------- Salida ----------

export type LineaResultado = {
  clave: string
  nombre: string
  deExistencia: number
  aImprimir: number
  impresora: string | null
  inicioImpresion: string | null
  finImpresion: string | null
  /** Hora límite para el taller: lista para alistar el pedido. */
  listaEn: string
}

export type Promesa =
  | {
      ok: true
      desde: string
      listoEn: string
      entregaEn: string
      /** "hoy antes de la 1:15 p. m." */
      frase: string
      /** La hora vale si se confirma antes de esto (null = no aplica). */
      validaHasta: string | null
      regla: ReglaEntrega
      pasos: string[]
      lineas: LineaResultado[]
      /** Cómo quedan las impresoras después de este pedido no se muestra: esto es antes. */
      impresoras: { nombre: string; libreEn: string | null }[]
      imprime: boolean
    }
  | { ok: false; mensaje: string }

// ---------- Horario ----------

function crearReloj(agenda: Agenda) {
  const cerrados = new Map<number, Set<string>>()
  const sinTaller = (l: Local) => {
    const anio = new Date(l).getUTCFullYear()
    if (!cerrados.has(anio)) {
      cerrados.set(anio, new Set(diasSinTaller(agenda, anio).map((f) => f.fecha)))
    }
    return cerrados.get(anio)!.has(fechaIso(l))
  }
  /** Horario de ese día en hora local, o null si no se abre. */
  const horarioDe = (dia: Local) => {
    const h = agenda.horario[new Date(dia).getUTCDay()]
    if (!h?.abierto || sinTaller(dia)) return null
    return { abre: dia + minutosDeHora(h.abre) * MIN, cierra: dia + minutosDeHora(h.cierra) * MIN }
  }
  const esHabil = (dia: Local) => horarioDe(inicioDia(dia)) !== null
  /** El primer momento, desde `l`, en que hay alguien en el taller. */
  const siguienteHabil = (l: Local): Local => {
    let t = l
    for (let i = 0; i < 400; i++) {
      const h = horarioDe(inicioDia(t))
      if (h && t < h.cierra) return Math.max(t, h.abre)
      t = inicioDia(t) + DIA
    }
    return l
  }
  /** Trabajo de una persona: solo avanza en horario del taller. */
  const sumarTrabajo = (l: Local, minutos: number): Local => {
    if (minutos <= 0) return l
    let t = siguienteHabil(l)
    let quedan = minutos * MIN
    for (let i = 0; i < 400; i++) {
      const h = horarioDe(inicioDia(t))!
      const hay = h.cierra - t
      if (quedan <= hay) return t + quedan
      quedan -= hay
      t = siguienteHabil(h.cierra)
    }
    return t
  }
  /** N días hábiles después del día de `l` (0 = ese mismo día). */
  const diasHabilesDespues = (l: Local, n: number): Local => {
    let dia = inicioDia(l)
    let quedan = n
    for (let i = 0; quedan > 0 && i < 400; i++) {
      dia += DIA
      if (esHabil(dia)) quedan--
    }
    return dia
  }
  return { siguienteHabil, sumarTrabajo, diasHabilesDespues }
}

// ---------- Frases ----------

const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** "hoy", "mañana jueves", "el lunes", "el lunes 16 de nov" */
export function nombreDelDia(cuando: Date | string, ahora: Date | string) {
  const l = aLocal(cuando)
  const dias = Math.round((inicioDia(l) - inicioDia(aLocal(ahora))) / DIA)
  const d = new Date(l)
  const nombre = NOMBRE_DIA[d.getUTCDay()]
  if (dias === 0) return 'hoy'
  if (dias === 1) return `mañana ${nombre}`
  if (dias > 1 && dias < 7) return `el ${nombre}`
  return `el ${nombre} ${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`
}

/** "1:15 p. m." */
export function horaDe(cuando: Date | string) {
  return horaLegible(minutosDelDia(aLocal(cuando)))
}

/** "hoy a las 4:20 p. m." */
export function momento(cuando: Date | string, ahora: Date | string) {
  const min = minutosDelDia(aLocal(cuando))
  const hh = Math.floor(min / 60)
  return `${nombreDelDia(cuando, ahora)} a ${hh === 1 || hh === 13 ? 'la' : 'las'} ${horaLegible(min)}`
}

/** "hoy de 10:40 a. m. a 12:16 p. m." o "desde hoy a las 4:10 p. m. hasta el lunes a las 8:00 a. m." */
function tramo(inicio: Date | string, fin: Date | string, ahora: Date | string) {
  const di = nombreDelDia(inicio, ahora)
  if (di === nombreDelDia(fin, ahora)) {
    return `${di} de ${horaDe(inicio)} a ${horaDe(fin)}`
  }
  return `desde ${momento(inicio, ahora)} hasta ${momento(fin, ahora)}`
}

/** Cierra la frase con punto sin repetirlo ("p. m."). */
export const conPunto = (t: string) => (t.endsWith('.') ? t : `${t}.`)

function duracion(minutos: number) {
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

// ---------- Cálculo ----------

export function calcularPromesa(e: EntradaPromesa): Promesa {
  const reloj = crearReloj(e.agenda)
  const desde = aLocal(e.desde)
  const ahoraIso = e.desde.toISOString()
  const pasos: string[] = []
  const lineasConCantidad = e.lineas.filter((l) => l.cantidad > 0)
  if (lineasConCantidad.length === 0) {
    return { ok: false, mensaje: 'Agrega al menos un producto para calcular la entrega.' }
  }

  // Impresoras: cuándo queda libre cada una (con lo que ya está en cola)
  const activas = e.taller.impresoras.map((i) => ({
    ...i,
    libre: Math.max(desde, i.libreEn ? aLocal(i.libreEn) : desde),
  }))

  /** Pone un trabajo en la impresora que lo termina antes. */
  const programar = (
    t: { horas: number; camas: number; minPreparacion: number; multicolor: boolean },
    noAntesDe: Local
  ) => {
    const sirven = activas.filter((i) => !t.multicolor || i.multicolor)
    let mejor: { imp: (typeof activas)[number]; inicio: Local; fin: Local } | null = null
    for (const imp of sirven) {
      let x = reloj.sumarTrabajo(reloj.siguienteHabil(Math.max(imp.libre, noAntesDe)), t.minPreparacion)
      const camas = Math.max(1, t.camas)
      const porCama = (t.horas * HORA_MS) / camas
      let inicio: Local | null = null
      for (let c = 0; c < camas; c++) {
        // Empezar cada cama necesita a alguien; imprimir sigue de noche
        const arranca = reloj.siguienteHabil(x)
        inicio ??= arranca
        x = arranca + porCama
      }
      if (!mejor || x < mejor.fin) mejor = { imp, inicio: inicio!, fin: x }
    }
    if (mejor) mejor.imp.libre = mejor.fin
    return mejor
  }

  for (const t of e.taller.cola) programar(t, desde)
  // Cuándo queda libre cada una con lo que ya estaba (antes de este pedido)
  const resumenImpresoras = activas.map((i) => ({
    nombre: i.nombre,
    libreEn: i.libre > desde ? aReal(i.libre).toISOString() : null,
  }))

  const existencias = { ...e.existencias }
  const resultado: LineaResultado[] = []
  let listoProduccion = desde
  let imprime = false

  for (const l of lineasConCantidad) {
    const hay = l.usaExistencias ? Math.max(0, existencias[l.claveExistencia] ?? 0) : 0
    const deExistencia = Math.min(hay, l.cantidad)
    existencias[l.claveExistencia] = hay - deExistencia
    const aImprimir = l.cantidad - deExistencia
    if (aImprimir === 0) {
      pasos.push(`${l.nombre}: ${l.cantidad} ${l.cantidad === 1 ? 'lista' : 'listas'} en existencia.`)
      resultado.push({
        clave: l.clave,
        nombre: l.nombre,
        deExistencia,
        aImprimir: 0,
        impresora: null,
        inicioImpresion: null,
        finImpresion: null,
        listaEn: aReal(desde).toISOString(),
      })
      continue
    }
    imprime = true
    const disenoListo = reloj.sumarTrabajo(desde, l.minDiseno)
    const horas = l.horasPorUnidad * aImprimir
    const t = programar(
      {
        horas,
        camas: Math.ceil(aImprimir / Math.max(1, l.unidadesPorCama)),
        minPreparacion: l.minPreparacion * aImprimir,
        multicolor: l.multicolor,
      },
      disenoListo
    )
    if (!t) {
      return {
        ok: false,
        mensaje: l.multicolor
          ? `${l.nombre} es multicolor y no hay una impresora multicolor activa. Revisa Taller → Impresoras.`
          : 'No hay impresoras activas. Revisa Taller → Impresoras.',
      }
    }
    const acabado = reloj.sumarTrabajo(t.fin, l.minAcabado * aImprimir)
    listoProduccion = Math.max(listoProduccion, acabado)
    const partes: string[] = []
    if (deExistencia) partes.push(`${deExistencia} en existencia`)
    if (l.minDiseno) partes.push(`ajustar el diseño ${duracion(l.minDiseno)}`)
    partes.push(
      `${deExistencia ? 'faltan' : 'se imprimen'} ${aImprimir} en la ${t.imp.nombre}: ${duracion(horas * 60)} de impresión, ${tramo(aReal(t.inicio), aReal(t.fin), ahoraIso)}`
    )
    if (l.minAcabado) partes.push(`acabado hasta ${momento(aReal(acabado), ahoraIso)}`)
    pasos.push(conPunto(`${l.nombre}: ${partes.join('; ')}`))
    resultado.push({
      clave: l.clave,
      nombre: l.nombre,
      deExistencia,
      aImprimir,
      impresora: t.imp.nombre,
      inicioImpresion: aReal(t.inicio).toISOString(),
      finImpresion: aReal(t.fin).toISOString(),
      listaEn: aReal(acabado).toISOString(),
    })
  }

  let listo = listoProduccion
  if (imprime && e.agenda.minMargen) {
    listo = reloj.sumarTrabajo(listo, e.agenda.minMargen)
    pasos.push(`Margen de seguridad por si una impresión falla: ${duracion(e.agenda.minMargen)}.`)
  }
  listo = reloj.sumarTrabajo(reloj.siguienteHabil(listo), e.agenda.minAlistar)
  pasos.push(conPunto(`Queda listo y empacado ${momento(aReal(listo), ahoraIso)}`))

  // Regla de entrega
  const minListo = minutosDelDia(listo)
  const regla = e.agenda.reglas.find(
    (r) =>
      r.activa &&
      r.modalidad === e.modalidad &&
      (r.listoAntesDe === null || minListo < minutosDeHora(r.listoAntesDe))
  )
  if (!regla) {
    return {
      ok: false,
      mensaje: 'No hay una regla de entrega para esta forma de entrega. Pide al administrador revisar Configuración → Horarios y entregas.',
    }
  }
  let entrega: Local
  let frase: string
  const real = (l: Local) => aReal(l).toISOString()
  if (regla.accion.tipo === 'horas') {
    entrega = listo + regla.accion.horas * HORA_MS
    frase = `${nombreDelDia(real(entrega), ahoraIso)} ${antesDeLa(minutosDelDia(entrega))}`
  } else if (regla.accion.tipo === 'listo') {
    entrega = listo
    frase = `desde ${momento(real(listo), ahoraIso)}`
  } else {
    entrega = reloj.diasHabilesDespues(listo, regla.accion.dias) + minutosDeHora(regla.accion.antesDe) * MIN
    frase = `${nombreDelDia(real(entrega), ahoraIso)} ${antesDeLa(minutosDelDia(entrega))}`
  }
  pasos.push(
    regla.listoAntesDe
      ? `Queda listo antes de las ${horaLegible(regla.listoAntesDe)}: se aplica la regla de ese horario.`
      : `Se aplica la regla de ${e.modalidad === 'nacional' ? 'envío por transportadora' : e.modalidad === 'recoge' ? 'recoger en el taller' : 'domicilio'}.`
  )

  // Hasta cuándo vale: mientras siga quedando listo antes de la hora de la regla
  let validaHasta: string | null = null
  if (regla.listoAntesDe && inicioDia(listo) === inicioDia(desde)) {
    const corte = inicioDia(listo) + minutosDeHora(regla.listoAntesDe) * MIN
    const limite = desde + (corte - listo)
    if (limite > desde) validaHasta = real(Math.floor(limite / (5 * MIN)) * 5 * MIN)
  }

  return {
    ok: true,
    desde: real(desde),
    listoEn: real(listo),
    entregaEn: real(entrega),
    frase,
    validaHasta,
    regla,
    pasos,
    lineas: resultado,
    impresoras: resumenImpresoras,
    imprime,
  }
}

/** Clave de existencias de una línea. */
export const claveExistencia = (productoId: number, bobinaId: number | null) =>
  `${productoId}:${bobinaId ?? 0}`

/**
 * La promesa guardada, dicha con fecha completa (para verla días después):
 * "el jueves 5 de nov antes de las 12:00 m." o "desde el jueves 5 de nov, 9:15 a. m.".
 */
export function fraseConFecha(p: { entregaEn: string; frase: string }) {
  const l = aLocal(p.entregaEn)
  const d = new Date(l)
  const fecha = `${NOMBRE_DIA[d.getUTCDay()]} ${d.getUTCDate()} de ${MES[d.getUTCMonth()]}`
  return p.frase.startsWith('desde')
    ? `desde el ${fecha}, ${horaLegible(minutosDelDia(l))}`
    : `el ${fecha} ${antesDeLa(minutosDelDia(l))}`
}

/** "Jueves 5 de nov, antes de las 12:00 m." (para fichas y seguimiento). */
export function fechaPrometida(entregaEn: string) {
  const s = fraseConFecha({ entregaEn, frase: '' }).replace(/^el /, '')
  return (s.charAt(0).toUpperCase() + s.slice(1)).replace(' antes', ', antes')
}
