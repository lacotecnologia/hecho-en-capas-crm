import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

/**
 * Personas que usan el sistema. Se ingresa con usuario + PIN.
 * Una persona puede tener varios roles (por ejemplo admin + fabricacion).
 */
export const usuarios = pgTable('usuarios', {
  id: serial('id').primaryKey(),
  nombre: text('nombre').notNull(),
  usuario: text('usuario').notNull().unique(),
  pinHash: text('pin_hash').notNull(),
  roles: text('roles').array().notNull().default([]),
  activo: boolean('activo').notNull().default(true),
  intentosFallidos: integer('intentos_fallidos').notNull().default(0),
  bloqueadoHasta: timestamp('bloqueado_hasta', { withTimezone: true }),
  creadoEn: timestamp('creado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Valores del negocio que el Admin puede cambiar (tarifas, márgenes,
 * anticipo, vigencia...). Una fila por valor.
 */
export const configuracion = pgTable('configuracion', {
  clave: text('clave').primaryKey(),
  valor: jsonb('valor').notNull(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true })
    .notNull()
    .defaultNow(),
  actualizadoPor: integer('actualizado_por').references(() => usuarios.id),
})

export type Usuario = typeof usuarios.$inferSelect
