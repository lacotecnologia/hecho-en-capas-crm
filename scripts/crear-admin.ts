/**
 * Crea la primera persona administradora (o le cambia el PIN si ya existe).
 *
 * Uso:
 *   pnpm crear-admin luis "Luis" 1234
 */
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { hashPin, pinValido } from '../server/auth.js'
import { getDb, getPool } from '../server/db/index.js'
import { usuarios } from '../server/db/schema.js'

async function main() {
  const [usuarioArg, nombreArg, pin] = process.argv.slice(2)
  const usuario = (usuarioArg ?? '').trim().toLowerCase()
  const nombre = (nombreArg ?? '').trim()

  if (!usuario || !nombre || !pinValido(pin)) {
    console.log('Uso: pnpm crear-admin <usuario> "<Nombre>" <PIN de 4 a 6 números>')
    console.log('Ejemplo: pnpm crear-admin luis "Luis" 1234')
    process.exitCode = 1
    return
  }

  const db = getDb()
  const pinHash = await hashPin(pin)
  const [existe] = await db
    .select({ id: usuarios.id, roles: usuarios.roles })
    .from(usuarios)
    .where(eq(usuarios.usuario, usuario))

  if (existe) {
    const roles = existe.roles.includes('admin')
      ? existe.roles
      : [...existe.roles, 'admin']
    await db
      .update(usuarios)
      .set({
        nombre,
        pinHash,
        roles,
        activo: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        actualizadoEn: new Date(),
      })
      .where(eq(usuarios.id, existe.id))
    console.log(`Listo: "${usuario}" actualizado como administrador con el PIN nuevo.`)
  } else {
    await db.insert(usuarios).values({ nombre, usuario, pinHash, roles: ['admin'] })
    console.log(`Listo: "${usuario}" creado como administrador.`)
  }
}

main()
  .catch((error) => {
    console.error('No se pudo crear el administrador:', error.message)
    process.exitCode = 1
  })
  .finally(() => getPool().end())
