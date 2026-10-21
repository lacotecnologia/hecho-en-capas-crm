import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema.js'

/**
 * Conexión a Postgres (VPS propio).
 *
 * Cada función de Vercel abre sus propias conexiones, por eso el pool es
 * pequeño. En el VPS se recomienda PgBouncer delante de Postgres.
 *
 * DATABASE_URL de ejemplo:
 *   postgres://hec_app:CLAVE@mi-vps.com:5432/hecho_en_capas?sslmode=require
 */
let pool: pg.Pool | undefined

function crearPool() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL. Agrégala en el archivo .env (local) o en Vercel.'
    )
  }
  return new pg.Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  })
}

export function getPool() {
  pool ??= crearPool()
  return pool
}

export function getDb() {
  return drizzle(getPool(), { schema })
}

export type Db = ReturnType<typeof getDb>
