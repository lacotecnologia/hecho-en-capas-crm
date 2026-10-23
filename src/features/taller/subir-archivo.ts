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
export async function reducirImagen(
  archivo: File,
  ladoMax: number,
  calidad: number
) {
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

/**
 * Nombre de archivo seguro para guardarlo: sin tildes, eñes ni espacios.
 * (El Mac escribe la "ñ" como "n" + tilde aparte y el almacenamiento la
 * rechaza.) Ej.: "Esferas Navideñas 3D.png" → "esferas-navidenas-3d".
 */
export function nombreSeguro(nombre: string) {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return limpio || 'archivo'
}

/** Mensaje cuando una subida falla: distingue si es el internet o el almacenamiento. */
export function falloDeSubida(que: string) {
  return navigator.onLine === false
    ? `No se pudo subir ${que}: no hay internet. Conéctate e intenta de nuevo.`
    : `No se pudo subir ${que}. Intenta de nuevo; si sigue pasando, avísale al administrador.`
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
  const nombreBase = archivo.name.normalize('NFC').replace(/\.[^.]+$/, '')

  if (ES_PRUEBA) {
    const url =
      tipo === 'imagen'
        ? await comoDataUrl(await reducirImagen(archivo, 700, 0.75))
        : ''
    return registrarArchivo(productoId, {
      url,
      nombre:
        tipo === 'imagen'
          ? `${nombreBase}.webp`
          : archivo.name.normalize('NFC'),
      tipo,
      tamanoBytes: archivo.size,
    })
  }

  const contenido =
    tipo === 'imagen' ? await reducirImagen(archivo, 1600, 0.85) : archivo
  const nombre =
    tipo === 'imagen' ? `${nombreBase}.webp` : archivo.name.normalize('NFC')
  const { uploadPresigned } = await import('@vercel/blob/client')
  let url: string
  try {
    const resultado = await uploadPresigned(
      `productos/${productoId}/${nombreSeguro(nombreBase)}.${tipo === 'imagen' ? 'webp' : tipo}`,
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
        : falloDeSubida(`"${archivo.name}"`)
    )
  }
  return registrarArchivo(productoId, {
    url,
    nombre,
    tipo,
    tamanoBytes: contenido.size,
  })
}
