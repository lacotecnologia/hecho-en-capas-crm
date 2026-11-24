/**
 * Pruebas del valor en letras de la cuenta de cobro.
 * Correr con: pnpm probar:letras
 */
import { enLetras } from '../shared/cuenta-cobro.js'

const casos: [number, string][] = [
  [0, 'Cero pesos m/cte.'],
  [1, 'Un peso m/cte.'],
  [21, 'Veintiún pesos m/cte.'],
  [100, 'Cien pesos m/cte.'],
  [101, 'Ciento un pesos m/cte.'],
  [115, 'Ciento quince pesos m/cte.'],
  [1000, 'Mil pesos m/cte.'],
  [5000, 'Cinco mil pesos m/cte.'],
  [21000, 'Veintiún mil pesos m/cte.'],
  [31000, 'Treinta y un mil pesos m/cte.'],
  [45500, 'Cuarenta y cinco mil quinientos pesos m/cte.'],
  [100000, 'Cien mil pesos m/cte.'],
  [150000, 'Ciento cincuenta mil pesos m/cte.'],
  [201000, 'Doscientos un mil pesos m/cte.'],
  [999999, 'Novecientos noventa y nueve mil novecientos noventa y nueve pesos m/cte.'],
  [1000000, 'Un millón de pesos m/cte.'],
  [1250000, 'Un millón doscientos cincuenta mil pesos m/cte.'],
  [2000000, 'Dos millones de pesos m/cte.'],
  [21000000, 'Veintiún millones de pesos m/cte.'],
  [3200000, 'Tres millones doscientos mil pesos m/cte.'],
  [101101101, 'Ciento un millones ciento un mil ciento un pesos m/cte.'],
  [1000000000, 'Mil millones de pesos m/cte.'],
  [1001000, 'Un millón mil pesos m/cte.'],
]

let mal = 0
for (const [n, esperado] of casos) {
  const real = enLetras(n)
  if (real === esperado) console.log(`✓ ${n}`)
  else {
    mal++
    console.log(`✗ ${n}\n    esperado: ${esperado}\n    salió:    ${real}`)
  }
}
console.log(`\n${casos.length - mal} de ${casos.length} bien`)
process.exit(mal ? 1 : 0)
