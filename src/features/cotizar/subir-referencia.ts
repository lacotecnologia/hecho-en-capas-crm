import { ApiError } from '@/lib/api'
import { comoDataUrl, reducirImagen } from '@/features/taller/subir-archivo'
import { agregarImagen } from './api'

const ES_PRUEBA = import.meta.env.VITE_DEMO === '1'

/** Sube una imagen de referencia del cliente y la adjunta a la cotización. */
export async function subirReferencia(cotizacionId: number, archivo: File) {
  if (!archivo.type.startsWith('image/')) {
    throw new ApiError(
      400,
      `"${archivo.name}" no es una imagen. Sube JPG, PNG o WebP.`
    )
  }
  const nombre = `${archivo.name.replace(/\.[^.]+$/, '')}.webp`
  if (ES_PRUEBA) {
    const url = await comoDataUrl(await reducirImagen(archivo, 700, 0.75))
    return agregarImagen(cotizacionId, { url, nombre })
  }
  const contenido = await reducirImagen(archivo, 1600, 0.85)
  const { uploadPresigned } = await import('@vercel/blob/client')
  try {
    const r = await uploadPresigned(
      `cotizaciones/${cotizacionId}/${nombre}`,
      contenido,
      {
        access: 'public',
        handleUploadUrl: '/api/cotizaciones/subida',
        contentType: 'image/webp',
      }
    )
    return agregarImagen(cotizacionId, { url: r.url, nombre })
  } catch (error) {
    const texto = error instanceof Error ? error.message : ''
    throw new ApiError(
      400,
      texto.includes('almacenamiento')
        ? texto
        : texto.includes('client token')
          ? `No se pudo subir "${archivo.name}": el almacenamiento de archivos no respondió. Si sigue pasando, avísale al administrador.`
          : `No se pudo subir "${archivo.name}". Revisa el internet e intenta de nuevo.`
    )
  }
}
