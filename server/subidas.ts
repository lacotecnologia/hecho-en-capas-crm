import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
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

/**
 * Entrega al navegador un permiso temporal para subir un archivo directo
 * a Vercel Blob (así no pasa por la función y no hay límite de tamaño).
 */
export async function permisoDeSubida(c: Context, tipos = TIPOS_ARCHIVOS) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return c.json(
      {
        mensaje:
          'Falta configurar el almacenamiento de archivos. El administrador debe crear un Blob Store en Vercel y conectarlo al proyecto.',
      },
      503
    )
  }
  const cuerpo = (await c.req.json()) as HandleUploadBody
  try {
    const respuesta = await handleUpload({
      body: cuerpo,
      request: c.req.raw,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: tipos,
        maximumSizeInBytes: 100 * 1024 * 1024,
        addRandomSuffix: true,
      }),
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
