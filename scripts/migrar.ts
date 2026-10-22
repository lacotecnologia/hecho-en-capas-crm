/**
 * Aplica a la base de datos las migraciones que falten
 * (las que están en server/db/migraciones).
 *
 * - En tu Mac:   pnpm db:migrar   (usa DATABASE_URL del archivo .env)
 * - En Vercel:   corre solo antes de cada publicación de producción.
 *   Las vistas previas no tocan la base de datos real.
 *
 * Si una migración ya se aplicó, no se repite.
 */
import 'dotenv/config'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getDb, getPool } from '../server/db/index.js'

const enVercel = Boolean(process.env.VERCEL)
const entorno = process.env.VERCEL_ENV

/** Traduce los errores de conexión más comunes a algo que se pueda arreglar. */
function explicar(error: unknown): string {
  // Drizzle envuelve el error real de Postgres en `cause`.
  let e = error as { code?: string; message?: string; cause?: unknown }
  while (e?.cause && !e.code) e = e.cause as typeof e
  const mensaje = e?.message ?? String(error)
  const codigo = e?.code ?? ''

  if (codigo === 'DEPTH_ZERO_SELF_SIGNED_CERT' || codigo === 'SELF_SIGNED_CERT_IN_CHAIN') {
    return 'El VPS usa un certificado propio. Termina DATABASE_URL con ?sslmode=no-verify (en vez de sslmode=require).'
  }
  if (/does not support SSL/i.test(mensaje)) {
    return 'El VPS no tiene SSL activado. Quita el ?sslmode=... del final de DATABASE_URL o activa ssl = on en Postgres.'
  }
  if (codigo === 'ECONNREFUSED' || codigo === 'ETIMEDOUT' || /timeout/i.test(mensaje)) {
    return 'No hubo respuesta del VPS. Revisa que Postgres escuche conexiones de afuera (listen_addresses = \'*\') y que el puerto 5432 esté abierto en el firewall.'
  }
  if (codigo === 'ENOTFOUND') {
    return 'No se encontró la dirección del VPS. Revisa el nombre o la IP en DATABASE_URL.'
  }
  if (codigo === '28P01') {
    return 'La clave de la base de datos no coincide. Revisa el usuario y la clave en DATABASE_URL.'
  }
  if (codigo === '28000' || /pg_hba/i.test(mensaje)) {
    return 'Postgres rechazó la conexión. Agrega en pg_hba.conf una línea "hostssl hecho_en_capas hec_app 0.0.0.0/0 scram-sha-256" y reinicia Postgres.'
  }
  if (codigo === '3D000') {
    return 'La base de datos no existe. Revisa el nombre al final de DATABASE_URL (antes del ?).'
  }
  if (codigo === '42501') {
    return 'El usuario de la base de datos no tiene permiso para crear tablas. Hazlo dueño de la base: ALTER DATABASE hecho_en_capas OWNER TO hec_app;'
  }
  return mensaje
}

async function main() {
  if (enVercel && entorno !== 'production') {
    console.log(
      `Vista previa (${entorno ?? 'sin entorno'}): no se toca la base de datos real.`
    )
    return
  }

  if (!process.env.DATABASE_URL) {
    const donde = enVercel
      ? 'en Vercel (Settings → Environment Variables)'
      : 'en el archivo .env'
    console.error(`Falta DATABASE_URL ${donde}.`)
    process.exitCode = 1
    return
  }

  console.log('Aplicando migraciones pendientes…')
  await migrate(getDb(), { migrationsFolder: 'server/db/migraciones' })
  console.log('Base de datos al día.')
}

main()
  .catch((error) => {
    console.error('No se pudo actualizar la base de datos:', explicar(error))
    process.exitCode = 1
  })
  .finally(async () => {
    if (!process.env.DATABASE_URL) return
    await getPool()
      .end()
      .catch(() => {})
  })
