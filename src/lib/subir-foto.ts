import { ApiError } from '@/lib/api'
import { comoDataUrl, reducirImagen } from '@/features/taller/subir-archivo'

const ES_PRUEBA = import.meta.env.VITE_DEMO === '1'

/**
 * Sube una foto (comprobante, evidencia de entrega) y devuelve su dirección.
 * La foto se achica antes de subirla para que suba rápido desde el celular.
 */
export async function subirFoto(
  archivo: File,
  destino: {
    permiso: '/api/pedidos/subida' | '/api/entregas/subida'
    carpeta: string
  }
) {
  if (!archivo.type.startsWith('image/')) {
    throw new ApiError(
      400,
      `"${archivo.name}" no es una foto. Sube JPG, PNG o WebP.`
    )
  }
  if (ES_PRUEBA) return comoDataUrl(await reducirImagen(archivo, 900, 0.75))
  const contenido = await reducirImagen(archivo, 1600, 0.82)
  const { upload } = await import('@vercel/blob/client')
  try {
    const r = await upload(`${destino.carpeta}/${Date.now()}.webp`, contenido, {
      access: 'public',
      handleUploadUrl: destino.permiso,
      contentType: 'image/webp',
    })
    return r.url
  } catch (error) {
    const texto = error instanceof Error ? error.message : ''
    throw new ApiError(
      400,
      texto.includes('almacenamiento')
        ? texto
        : 'No se pudo subir la foto. Revisa el internet e intenta de nuevo.'
    )
  }
}
