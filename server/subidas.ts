import { issueSignedToken } from '@vercel/blob'
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from '@vercel/blob/client'
import { type Context } from 'hono'

const TIPOS_ARCHIVOS = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'model/3mf',
  'model/stl',
  'application/vnd.ms-pki.stl',
  'application/sla',
  'application/octet-stream',
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
]

export const SOLO_IMAGENES = ['image/jpeg', 'image/png', 'image/webp']

const TAMANO_MAXIMO = 100 * 1024 * 1024 // 100 MB

/** Hay almacenamiento conectado: el nuevo de Vercel (BLOB_STORE_ID) o una llave fija. */
export function hayAlmacenamiento() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN)
}

/**
 * Entrega al navegador una dirección firmada y temporal para subir un archivo
 * directo a Vercel Blob (así no pasa por la función y no hay límite de tamaño).
 * Funciona con la conexión nueva de Vercel (sin llave fija) y con la antigua.
 * Las rutas que la usan ya exigen sesión y rol antes de llegar aquí.
 */
export async function permisoDeSubida(c: Context, tipos = TIPOS_ARCHIVOS) {
  if (!hayAlmacenamiento()) {
    return c.json(
      {
        mensaje:
          'Falta configurar el almacenamiento de archivos. El administrador debe crear un Blob Store en Vercel y conectarlo al proyecto.',
      },
      503
    )
  }
  const cuerpo = (await c.req.json()) as HandleUploadPresignedBody
  try {
    const respuesta = await handleUploadPresigned({
      body: cuerpo,
      request: c.req.raw,
      getSignedToken: async (pathname) => {
        const validoHasta = Date.now() + 10 * 60 * 1000
        return {
          token: await issueSignedToken({
            pathname,
            operations: ['put'],
            allowedContentTypes: tipos,
            maximumSizeInBytes: TAMANO_MAXIMO,
            validUntil: validoHasta,
          }),
          urlOptions: {
            allowedContentTypes: tipos,
            maximumSizeInBytes: TAMANO_MAXIMO,
            validUntil: validoHasta,
            addRandomSuffix: true,
            allowOverwrite: false,
          },
        }
      },
    })
    return c.json(respuesta)
  } catch (error) {
    console.error('[subida]', error)
    return c.json(
      { mensaje: 'No se pudo preparar la subida del archivo. Intenta de nuevo.' },
      400
    )
  }
}

/** Solo se aceptan direcciones de nuestro almacenamiento de Vercel Blob. */
export function urlDeBlobValida(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}
