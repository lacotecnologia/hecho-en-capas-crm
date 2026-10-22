import { Hono } from 'hono'
import {
  CAMPOS_CONFIG,
  TEXTOS_CONFIG,
  textosPorDefecto,
  valoresPorDefecto,
  type TextosConfig,
  type ValoresConfig,
} from '../../shared/configuracion.js'
import { getDb } from '../db/index.js'
import { configuracion } from '../db/schema.js'
import { conSesion, soloRoles, type Variables } from '../sesion.js'

export const rutasConfiguracion = new Hono<{ Variables: Variables }>()

rutasConfiguracion.use('*', conSesion)

/** Valores guardados, completados con los de por defecto. */
export async function leerConfiguracion(): Promise<ValoresConfig> {
  const filas = await getDb().select().from(configuracion)
  const valores = valoresPorDefecto()
  for (const fila of filas) {
    if (typeof fila.valor === 'number') valores[fila.clave] = fila.valor
  }
  return valores
}

/** Textos del negocio (WhatsApp, datos de pago, condiciones...). */
export async function leerTextos(): Promise<TextosConfig> {
  const filas = await getDb().select().from(configuracion)
  const textos = textosPorDefecto()
  for (const fila of filas) {
    if (typeof fila.valor === 'string' && fila.clave in textos) {
      textos[fila.clave] = fila.valor
    }
  }
  return textos
}

async function todo() {
  return { valores: await leerConfiguracion(), textos: await leerTextos() }
}

// Todas las personas pueden leer los valores (el comercial necesita el tope,
// el taller las tarifas...). Solo el Admin puede cambiarlos.
rutasConfiguracion.get('/', async (c) => c.json(await todo()))

rutasConfiguracion.put('/', soloRoles('admin'), async (c) => {
  const cuerpo = await c.req.json().catch(() => ({}))
  const entrada = (cuerpo.valores ?? {}) as Record<string, unknown>
  const yo = c.get('usuario')

  const filas: (typeof configuracion.$inferInsert)[] = []
  for (const campo of CAMPOS_CONFIG) {
    if (!(campo.clave in entrada)) continue
    const valor = Number(entrada[campo.clave])
    if (!Number.isFinite(valor) || valor < campo.min || valor > campo.max) {
      return c.json(
        {
          mensaje: `"${campo.etiqueta}" debe estar entre ${campo.min} y ${campo.max}.`,
          campo: campo.clave,
        },
        400
      )
    }
    filas.push({
      clave: campo.clave,
      valor,
      actualizadoEn: new Date(),
      actualizadoPor: yo.id,
    })
  }

  const textos = (cuerpo.textos ?? {}) as Record<string, unknown>
  for (const campo of TEXTOS_CONFIG) {
    if (!(campo.clave in textos)) continue
    const valor = String(textos[campo.clave] ?? '').trim()
    if (valor.length > campo.max) {
      return c.json(
        {
          mensaje: `"${campo.etiqueta}" es muy largo: máximo ${campo.max} letras.`,
          campo: campo.clave,
        },
        400
      )
    }
    filas.push({
      clave: campo.clave,
      valor,
      actualizadoEn: new Date(),
      actualizadoPor: yo.id,
    })
  }

  if (filas.length === 0) {
    return c.json({ mensaje: 'No hay cambios para guardar.' }, 400)
  }

  const db = getDb()
  await db.transaction(async (tx) => {
    for (const fila of filas) {
      await tx
        .insert(configuracion)
        .values(fila)
        .onConflictDoUpdate({
          target: configuracion.clave,
          set: {
            valor: fila.valor,
            actualizadoEn: fila.actualizadoEn,
            actualizadoPor: fila.actualizadoPor,
          },
        })
    }
  })

  return c.json(await todo())
})
