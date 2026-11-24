/** Dibuja cada página del PDF en un canvas (se ve igual en celular y computador). */
export async function dibujarPaginas(blob: Blob, contenedor: HTMLDivElement) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: worker } =
    await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker
  const doc = await pdfjs.getDocument({ data: await blob.arrayBuffer() })
    .promise
  contenedor.replaceChildren()
  const ancho = contenedor.clientWidth || 600
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n)
    const base = pagina.getViewport({ scale: 1 })
    const escala =
      (ancho / base.width) * Math.min(2, window.devicePixelRatio || 1)
    const vista = pagina.getViewport({ scale: escala })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(vista.width)
    canvas.height = Math.floor(vista.height)
    canvas.style.width = '100%'
    canvas.className = 'rounded-md border bg-white shadow-sm'
    canvas.setAttribute('aria-label', `Página ${n} del PDF`)
    contenedor.appendChild(canvas)
    await pagina.render({
      canvas,
      canvasContext: canvas.getContext('2d')!,
      viewport: vista,
    }).promise
  }
}
