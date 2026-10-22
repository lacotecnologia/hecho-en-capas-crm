import { type TipoArchivo } from '@shared/taller'
import { ApiError } from '@/lib/api'
import { registrarArchivo } from './api'

const ES_PRUEBA = import.meta.env.VITE_DEMO === '1'

export function tipoDeArchivo(
  nombre: string,
  mime: string
): TipoArchivo | null {
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  if (mime.startsWith('image/') && ['jpg', 'jpeg', 'png', 'webp'].includes(ext))
    return 'imagen'
  if (ext === '3mf') return '3mf'
  if (ext === 'stl') return 'stl'
  return null
}

/** Reduce una foto a un tamaño razonable antes de subirla (WebP). */
export async function reducirImagen(archivo: File, ladoMax: number, calidad: number) {
  const bitmap = await createImageBitmap(archivo)
  const escala = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise<Blob>((resolver, rechazar) =>
    canvas.toBlob(
      (b) =>
        b ? resolver(b) : rechazar(new Error('No se pudo leer la imagen')),
      'image/webp',
      calidad
    )
  )
}

export function comoDataUrl(blob: Blob) {
  return new Promise<string>((resolver) => {
    const lector = new FileReader()
    lector.onload = () => resolver(String(lector.result))
    lector.readAsDataURL(blob)
  })
}

/**
 * Sube un archivo del producto. En producción va a Vercel Blob y luego se
 * registra en la ficha. En la versión de prueba, las fotos se guardan en el
 * navegador y de los 3MF/STL solo se guarda el nombre.
 */
export async function subirArchivo(productoId: number, archivo: File) {
  const tipo = tipoDeArchivo(archivo.name, archivo.type)
  if (!tipo) {
    throw new ApiError(
      400,
      `"${archivo.name}" no es un tipo permitido. Sube fotos (JPG, PNG, WebP) o archivos 3MF / STL.`
    )
  }
  const nombreBase = archivo.name.replace(/\.[^.]+$/, '')

  if (ES_PRUEBA) {
    const url =
      tipo === 'imagen'
        ? await comoDataUrl(await reducirImagen(archivo, 700, 0.75))
        : ''
    return registrarArchivo(productoId, {
      url,
      nombre: tipo === 'imagen' ? `${nombreBase}.webp` : archivo.name,
      tipo,
      tamanoBytes: archivo.size,
    })
  }

  const contenido =
    tipo === 'imagen' ? await reducirImagen(archivo, 1600, 0.85) : archivo
  const nombre = tipo === 'imagen' ? `${nombreBase}.webp` : archivo.name
  const { upload } = await import('@vercel/blob/client')
  let url: string
  try {
    const resultado = await upload(
      `productos/${productoId}/${nombre}`,
      contenido,
      {
        access: 'public',
        handleUploadUrl: '/api/taller/subida',
        contentType:
          tipo === 'imagen' ? 'image/webp' : 'application/octet-stream',
      }
    )
    url = resultado.url
  } catch (error) {
    const texto = error instanceof Error ? error.message : ''
    throw new ApiError(
      400,
      texto.includes('almacenamiento')
        ? texto
        : `No se pudo subir "${archivo.name}". Revisa el internet e intenta de nuevo.`
    )
  }
  return registrarArchivo(productoId, {
    url,
    nombre,
    tipo,
    tamanoBytes: contenido.size,
  })
}
