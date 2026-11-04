/**
 * Pruebas de la calculadora de entrega con los ejemplos del plan.
 * Correr con: pnpm probar:promesa
 */
import { agendaPorDefecto, festivosColombia } from '../shared/agenda.js'
import { calcularPromesa, type EntradaPromesa, type LineaPromesa } from '../shared/promesa.js'

let bien = 0
let mal = 0
function igual(nombre: string, real: unknown, esperado: unknown) {
  if (real === esperado) {
    bien++
    console.log(`✓ ${nombre}`)
  } else {
    mal++
    console.log(`✗ ${nombre}\n    esperado: ${String(esperado)}\n    salió:    ${String(real)}`)
  }
}

/** Hora de Bogotá → Date. */
const bog = (s: string) => new Date(`${s}:00-05:00`)
const hora = (iso: string) =>
  new Date(new Date(iso).getTime() - 5 * 3_600_000).toISOString().slice(0, 16).replace('T', ' ')

const llavero = (cantidad: number, color = 'azul'): LineaPromesa => ({
  clave: 'l1',
  nombre: 'Llavero',
  cantidad,
  claveExistencia: `1:${color}`,
  horasPorUnidad: 0.8,
  unidadesPorCama: 4,
  minPreparacion: 5,
  minAcabado: 10,
  multicolor: false,
  usaExistencias: true,
  minDiseno: 0,
})

const bambu = { id: 1, nombre: 'Bambu', multicolor: true }
const kobra = { id: 2, nombre: 'Kobra', multicolor: false }

function base(desde: string, lineas: LineaPromesa[], extra: Partial<EntradaPromesa> = {}): EntradaPromesa {
  return {
    desde: bog(desde),
    lineas,
    modalidad: 'local',
    agenda: agendaPorDefecto(),
    taller: { impresoras: [{ ...bambu, libreEn: null }, { ...kobra, libreEn: null }], cola: [] },
    existencias: { '1:azul': 6, '1:negro': 0 },
    ...extra,
  }
}

// 1. Miércoles 9:00, hay listos
let r = calcularPromesa(base('2026-11-04T09:00', [llavero(2)]))
if (!r.ok) throw new Error(r.mensaje)
igual('1 · listo con existencias', hora(r.listoEn), '2026-11-04 09:15')
igual('1 · entrega hoy máx 4 h', hora(r.entregaEn), '2026-11-04 13:15')
igual('1 · frase', r.frase, 'hoy antes de la 1:15 p. m.')
igual('1 · vale hasta', r.validaHasta && hora(r.validaHasta), '2026-11-04 11:20')

// 2. Miércoles 9:00, no hay; Bambu termina 10:30, Kobra 11:00
r = calcularPromesa(
  base('2026-11-04T09:00', [llavero(2, 'negro')], {
    taller: {
      impresoras: [
        { ...bambu, libreEn: bog('2026-11-04T10:30').toISOString() },
        { ...kobra, libreEn: bog('2026-11-04T11:00').toISOString() },
      ],
      cola: [],
    },
  })
)
if (!r.ok) throw new Error(r.mensaje)
igual('2 · imprime en la Bambu', r.lineas[0].impresora, 'Bambu')
igual('2 · termina de imprimir', hora(r.lineas[0].finImpresion!), '2026-11-04 12:16')
igual('2 · listo', hora(r.listoEn), '2026-11-04 13:21')
igual('2 · entrega mañana antes de 12', hora(r.entregaEn), '2026-11-05 12:00')
igual('2 · frase', r.frase, 'mañana jueves antes de las 12:00 m.')

// 3. Miércoles 2:00 p. m., hay listos
r = calcularPromesa(base('2026-11-04T14:00', [llavero(2)]))
if (!r.ok) throw new Error(r.mensaje)
igual('3 · después del corte: mañana', hora(r.entregaEn), '2026-11-05 12:00')
igual('3 · sin "vale hasta"', r.validaHasta, null)

// 4. Sábado 4:00 p. m., multicolor de 6 h; domingo cerrado
const multi: LineaPromesa = {
  ...llavero(1),
  nombre: 'Figura',
  claveExistencia: '2:0',
  horasPorUnidad: 6,
  unidadesPorCama: 1,
  minPreparacion: 10,
  minAcabado: 20,
  multicolor: true,
}
r = calcularPromesa(base('2026-11-07T16:00', [multi]))
if (!r.ok) throw new Error(r.mensaje)
igual('4 · imprime de noche', hora(r.lineas[0].finImpresion!), '2026-11-07 22:10')
igual('4 · listo el lunes', hora(r.listoEn), '2026-11-09 09:05')
igual('4 · entrega el lunes', hora(r.entregaEn), '2026-11-09 13:05')
igual('4 · frase', r.frase, 'el lunes antes de la 1:05 p. m.')

// 5. Jueves 10:00, 3 esferas con nombre (siempre se imprimen)
const esfera: LineaPromesa = {
  ...llavero(3),
  nombre: 'Esfera con nombre',
  claveExistencia: '3:0',
  horasPorUnidad: 1.5,
  unidadesPorCama: 3,
  minPreparacion: 5,
  minAcabado: 10,
  usaExistencias: false,
  minDiseno: 30,
}
r = calcularPromesa(base('2026-11-05T10:00', [esfera], { existencias: { '3:0': 50 } }))
if (!r.ok) throw new Error(r.mensaje)
igual('5 · personalizado no usa existencias', r.lineas[0].aImprimir, 3)
igual('5 · empieza a imprimir', hora(r.lineas[0].inicioImpresion!), '2026-11-05 10:45')
igual('5 · listo', hora(r.listoEn), '2026-11-05 16:30')
igual('5 · entrega viernes', r.frase, 'mañana viernes antes de las 12:00 m.')

// Extras
r = calcularPromesa(base('2026-11-04T09:00', [llavero(8)]))
if (!r.ok) throw new Error(r.mensaje)
igual('parcial · usa 6 listos e imprime 2', `${r.lineas[0].deExistencia}+${r.lineas[0].aImprimir}`, '6+2')

r = calcularPromesa(base('2026-11-04T21:00', [llavero(1)]))
if (!r.ok) throw new Error(r.mensaje)
igual('de noche · alista al abrir', hora(r.listoEn), '2026-11-05 08:15')

r = calcularPromesa(base('2026-11-04T09:00', [llavero(1)], { modalidad: 'recoge' }))
if (!r.ok) throw new Error(r.mensaje)
igual('recoge · desde que está listo', r.frase, 'desde hoy a las 9:15 a. m.')

r = calcularPromesa(base('2026-11-13T16:00', [llavero(1)], { modalidad: 'nacional' }))
if (!r.ok) throw new Error(r.mensaje)
// Viernes 13 tarde: listo 4:15 (después de las 3) → 6 días hábiles; el lunes 16 es festivo
igual('nacional · salta el festivo', hora(r.entregaEn), '2026-11-21 18:00')

r = calcularPromesa(
  base('2026-11-04T09:00', [multi], { taller: { impresoras: [{ ...kobra, libreEn: null }], cola: [] } })
)
igual('sin multicolor · avisa', r.ok ? 'ok' : r.mensaje.includes('multicolor'), true)

// Cola: un trabajo de 3 h en cola ocupa la impresora antes
r = calcularPromesa(
  base('2026-11-04T09:00', [llavero(1, 'negro')], {
    taller: {
      impresoras: [{ ...kobra, libreEn: null }],
      cola: [{ horas: 3, camas: 1, minPreparacion: 0, multicolor: false }],
    },
  })
)
if (!r.ok) throw new Error(r.mensaje)
igual('cola · espera lo que va antes', hora(r.lineas[0].inicioImpresion!), '2026-11-04 12:05')

const f2026 = festivosColombia(2026).map((f) => f.fecha)
igual('festivos 2026 · 18 días', f2026.length, 18)
igual('festivos 2026 · Todos los Santos el lunes 2 nov', f2026.includes('2026-11-02'), true)
igual('festivos 2026 · Viernes Santo', f2026.includes('2026-04-03'), true)

console.log(`\n${bien} bien, ${mal} mal`)
process.exit(mal ? 1 : 0)
