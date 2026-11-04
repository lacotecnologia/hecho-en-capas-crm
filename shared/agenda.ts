/**
 * Horario del taller, festivos y reglas de entrega. El administrador los
 * cambia en Configuración → Horarios y entregas; la calculadora de entrega
 * (promesa.ts) los usa. Se guardan como un solo valor en `configuracion`.
 */
import { type Modalidad } from './cotizacion.js'

export const CLAVE_AGENDA = 'agenda_entregas'

/** "08:00" */
export type Hora = string

export type DiaHorario = { abierto: boolean; abre: Hora; cierra: Hora }

export type AccionRegla =
  /** El mismo día, máximo N horas después de quedar listo. */
  | { tipo: 'horas'; horas: number }
  /** N días hábiles después del día en que queda listo, antes de una hora. */
  | { tipo: 'dia_habil'; dias: number; antesDe: Hora }
  /** En cuanto queda listo y empacado (recoge en el taller). */
  | { tipo: 'listo' }

export type ReglaEntrega = {
  id: string
  modalidad: Modalidad
  /** Si queda listo antes de esta hora; null = a cualquier hora. */
  listoAntesDe: Hora | null
  accion: AccionRegla
  activa: boolean
}

export type Agenda = {
  /** 0 = domingo … 6 = sábado */
  horario: DiaHorario[]
  /** Festivos de Colombia que el taller sí trabaja (AAAA-MM-DD). */
  festivosQuitados: string[]
  /** Días extra sin taller (vacaciones, inventario…). */
  festivosExtra: { fecha: string; nombre: string }[]
  minAlistar: number
  minMargen: number
  reglas: ReglaEntrega[]
}

export const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const

export const MODALIDADES_REGLA: Record<Modalidad, string> = {
  local: 'Domicilio',
  recoge: 'Recoge en el taller',
  nacional: 'Transportadora',
}

export function agendaPorDefecto(): Agenda {
  const dia = (abierto: boolean): DiaHorario => ({ abierto, abre: '08:00', cierra: '18:00' })
  return {
    horario: [dia(false), dia(true), dia(true), dia(true), dia(true), dia(true), dia(true)],
    festivosQuitados: [],
    festivosExtra: [],
    minAlistar: 15,
    minMargen: 30,
    reglas: [
      { id: 'r1', modalidad: 'local', listoAntesDe: '11:35', accion: { tipo: 'horas', horas: 4 }, activa: true },
      { id: 'r2', modalidad: 'local', listoAntesDe: null, accion: { tipo: 'dia_habil', dias: 1, antesDe: '12:00' }, activa: true },
      { id: 'r3', modalidad: 'recoge', listoAntesDe: null, accion: { tipo: 'listo' }, activa: true },
      { id: 'r4', modalidad: 'nacional', listoAntesDe: '15:00', accion: { tipo: 'dia_habil', dias: 5, antesDe: '18:00' }, activa: true },
      { id: 'r5', modalidad: 'nacional', listoAntesDe: null, accion: { tipo: 'dia_habil', dias: 6, antesDe: '18:00' }, activa: true },
    ],
  }
}

// ---------- Festivos de Colombia ----------

const iso = (anio: number, mes: number, dia: number) =>
  new Date(Date.UTC(anio, mes - 1, dia)).toISOString().slice(0, 10)

/** Domingo de Pascua (algoritmo de Gauss/Meeus). */
function pascua(anio: number) {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return Date.UTC(anio, mes - 1, dia)
}

const DIA = 86_400_000

/** Pasa la fecha al lunes siguiente si no cae en lunes (Ley Emiliani). */
function alLunes(ms: number) {
  const dow = new Date(ms).getUTCDay()
  return dow === 1 ? ms : ms + ((8 - dow) % 7) * DIA
}

/** Festivos de Colombia de un año: [AAAA-MM-DD, nombre]. */
export function festivosColombia(anio: number): { fecha: string; nombre: string }[] {
  const f = (ms: number, nombre: string) => ({ fecha: new Date(ms).toISOString().slice(0, 10), nombre })
  const fijo = (mes: number, dia: number) => Date.UTC(anio, mes - 1, dia)
  const p = pascua(anio)
  return [
    { fecha: iso(anio, 1, 1), nombre: 'Año Nuevo' },
    f(alLunes(fijo(1, 6)), 'Reyes Magos'),
    f(alLunes(fijo(3, 19)), 'San José'),
    f(p - 3 * DIA, 'Jueves Santo'),
    f(p - 2 * DIA, 'Viernes Santo'),
    { fecha: iso(anio, 5, 1), nombre: 'Día del Trabajo' },
    f(alLunes(p + 39 * DIA), 'Ascensión del Señor'),
    f(alLunes(p + 60 * DIA), 'Corpus Christi'),
    f(alLunes(p + 68 * DIA), 'Sagrado Corazón'),
    f(alLunes(fijo(6, 29)), 'San Pedro y San Pablo'),
    { fecha: iso(anio, 7, 20), nombre: 'Día de la Independencia' },
    { fecha: iso(anio, 8, 7), nombre: 'Batalla de Boyacá' },
    f(alLunes(fijo(8, 15)), 'Asunción de la Virgen'),
    f(alLunes(fijo(10, 12)), 'Día de la Raza'),
    f(alLunes(fijo(11, 1)), 'Todos los Santos'),
    f(alLunes(fijo(11, 11)), 'Independencia de Cartagena'),
    { fecha: iso(anio, 12, 8), nombre: 'Inmaculada Concepción' },
    { fecha: iso(anio, 12, 25), nombre: 'Navidad' },
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Días sin taller de un año: festivos de Colombia − quitados + extra. */
export function diasSinTaller(agenda: Agenda, anio: number) {
  const quitados = new Set(agenda.festivosQuitados)
  return [
    ...festivosColombia(anio).filter((f) => !quitados.has(f.fecha)),
    ...agenda.festivosExtra.filter((f) => f.fecha.startsWith(String(anio))),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// ---------- Horas ----------

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/

export function minutosDeHora(h: Hora) {
  const m = HORA.exec(h)
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** "13:15" → "1:15 p. m."; "12:00" → "12:00 m." */
export function horaLegible(h: Hora | number) {
  const total = typeof h === 'number' ? h : minutosDeHora(h)
  const hh = Math.floor(total / 60) % 24
  const mm = String(total % 60).padStart(2, '0')
  if (hh === 12 && mm === '00') return '12:00 m.'
  const h12 = hh % 12 === 0 ? 12 : hh % 12
  return `${h12}:${mm} ${hh < 12 ? 'a. m.' : 'p. m.'}`
}

/** "antes de la 1:15 p. m." / "antes de las 3:00 p. m." */
export function antesDeLa(minutos: number) {
  const hh = Math.floor(minutos / 60) % 24
  const articulo = hh === 1 || hh === 13 ? 'la' : 'las'
  return `antes de ${articulo} ${horaLegible(minutos)}`
}

/** Frase de una regla, para la lista de Configuración. */
export function describirRegla(r: ReglaEntrega) {
  const cuando = r.listoAntesDe
    ? `Si queda listo antes de las ${horaLegible(r.listoAntesDe)}`
    : 'Si queda listo a cualquier otra hora'
  const que =
    r.accion.tipo === 'horas'
      ? `se entrega el mismo día, máximo ${r.accion.horas} ${r.accion.horas === 1 ? 'hora' : 'horas'} después`
      : r.accion.tipo === 'listo'
        ? 'se entrega en cuanto esté listo y empacado'
        : r.accion.dias === 0
          ? `se entrega ese mismo día, ${antesDeLa(minutosDeHora(r.accion.antesDe))}`
          : `se entrega ${r.accion.dias === 1 ? 'el siguiente día hábil' : `a los ${r.accion.dias} días hábiles`}, ${antesDeLa(minutosDeHora(r.accion.antesDe))}`
  const frase = `${cuando}, ${que}`
  return frase.endsWith('.') ? frase : `${frase}.`
}

// ---------- Validación (la usa el servidor al guardar) ----------

type Malo = { ok: false; mensaje: string; campo?: string }
const malo = (mensaje: string, campo?: string): Malo => ({ ok: false, mensaje, campo })
const FECHA = /^\d{4}-\d{2}-\d{2}$/
const MODALIDADES = ['local', 'recoge', 'nacional'] as const

export function validarAgenda(c: unknown): { ok: true; datos: Agenda } | Malo {
  const a = (c ?? {}) as Record<string, unknown>
  const horarioIn = Array.isArray(a.horario) ? a.horario : []
  if (horarioIn.length !== 7) return malo('Falta el horario de algún día.', 'horario')
  const horario: DiaHorario[] = []
  for (let i = 0; i < 7; i++) {
    const d = (horarioIn[i] ?? {}) as Record<string, unknown>
    const abierto = d.abierto === true
    const abre = String(d.abre ?? '08:00')
    const cierra = String(d.cierra ?? '18:00')
    if (abierto) {
      if (!HORA.test(abre) || !HORA.test(cierra)) {
        return malo(`Escribe bien la hora de ${DIAS_SEMANA[i]} (por ejemplo 08:00).`, 'horario')
      }
      if (minutosDeHora(cierra) - minutosDeHora(abre) < 60) {
        return malo(`${DIAS_SEMANA[i]}: la hora de cierre debe ser al menos una hora después de abrir.`, 'horario')
      }
    }
    horario.push({ abierto, abre: HORA.test(abre) ? abre : '08:00', cierra: HORA.test(cierra) ? cierra : '18:00' })
  }
  if (!horario.some((d) => d.abierto)) return malo('El taller debe abrir al menos un día.', 'horario')

  const festivosQuitados = (Array.isArray(a.festivosQuitados) ? a.festivosQuitados : [])
    .map(String)
    .filter((f) => FECHA.test(f))
    .slice(0, 100)
  const extraIn = Array.isArray(a.festivosExtra) ? a.festivosExtra : []
  const festivosExtra: Agenda['festivosExtra'] = []
  for (const x of extraIn.slice(0, 100)) {
    const f = (x ?? {}) as Record<string, unknown>
    const fecha = String(f.fecha ?? '')
    if (!FECHA.test(fecha)) return malo('Escoge la fecha del día sin taller.', 'festivos')
    festivosExtra.push({ fecha, nombre: String(f.nombre ?? '').trim().slice(0, 60) || 'Día sin taller' })
  }

  const minAlistar = Math.round(Number(a.minAlistar))
  if (!Number.isFinite(minAlistar) || minAlistar < 0 || minAlistar > 240) {
    return malo('Los minutos para alistar y empacar deben estar entre 0 y 240.', 'minAlistar')
  }
  const minMargen = Math.round(Number(a.minMargen))
  if (!Number.isFinite(minMargen) || minMargen < 0 || minMargen > 600) {
    return malo('El margen de seguridad debe estar entre 0 y 600 minutos.', 'minMargen')
  }

  const reglasIn = Array.isArray(a.reglas) ? a.reglas : []
  if (reglasIn.length > 40) return malo('Son demasiadas reglas: máximo 40.', 'reglas')
  const reglas: ReglaEntrega[] = []
  for (const [i, x] of reglasIn.entries()) {
    const r = (x ?? {}) as Record<string, unknown>
    const n = i + 1
    const modalidad = String(r.modalidad ?? '') as Modalidad
    if (!(MODALIDADES as readonly string[]).includes(modalidad)) {
      return malo(`Regla ${n}: escoge la forma de entrega.`, 'reglas')
    }
    const listoAntesDe = r.listoAntesDe ? String(r.listoAntesDe) : null
    if (listoAntesDe && !HORA.test(listoAntesDe)) {
      return malo(`Regla ${n}: escribe bien la hora (por ejemplo 11:35).`, 'reglas')
    }
    const ac = (r.accion ?? {}) as Record<string, unknown>
    let accion: AccionRegla
    if (ac.tipo === 'horas') {
      const horas = Number(ac.horas)
      if (!Number.isFinite(horas) || horas <= 0 || horas > 48) {
        return malo(`Regla ${n}: las horas deben estar entre 1 y 48.`, 'reglas')
      }
      accion = { tipo: 'horas', horas: Math.round(horas * 2) / 2 }
    } else if (ac.tipo === 'dia_habil') {
      const dias = Math.round(Number(ac.dias))
      const antesDe = String(ac.antesDe ?? '')
      if (!Number.isFinite(dias) || dias < 0 || dias > 30) {
        return malo(`Regla ${n}: los días deben estar entre 0 y 30.`, 'reglas')
      }
      if (!HORA.test(antesDe)) return malo(`Regla ${n}: escribe bien la hora de entrega.`, 'reglas')
      accion = { tipo: 'dia_habil', dias, antesDe }
    } else if (ac.tipo === 'listo') {
      accion = { tipo: 'listo' }
    } else {
      return malo(`Regla ${n}: escoge qué pasa con la entrega.`, 'reglas')
    }
    reglas.push({
      id: String(r.id ?? `r${n}`).slice(0, 20),
      modalidad,
      listoAntesDe,
      accion,
      activa: r.activa !== false,
    })
  }
  for (const m of MODALIDADES) {
    const activas = reglas.filter((r) => r.activa && r.modalidad === m)
    if (activas.length && !activas.some((r) => r.listoAntesDe === null)) {
      return malo(
        `${MODALIDADES_REGLA[m]}: falta una regla "a cualquier otra hora" para cuando no aplica ninguna de las de antes.`,
        'reglas'
      )
    }
  }
  return { ok: true, datos: { horario, festivosQuitados, festivosExtra, minAlistar, minMargen, reglas } }
}

/** Lo guardado, completado con lo de por defecto si falta o está dañado. */
export function leerAgenda(valor: unknown): Agenda {
  if (!valor) return agendaPorDefecto()
  const v = validarAgenda(valor)
  return v.ok ? v.datos : agendaPorDefecto()
}
