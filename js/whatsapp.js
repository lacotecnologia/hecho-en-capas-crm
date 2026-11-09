// Burbuja de WhatsApp con preguntas rápidas. Se usa en la tienda y en la Academia.
import { CONFIG } from './config.js'

const PREGUNTAS = [
  { texto: 'Quiero cotizar algo a mi medida', mensaje: 'Hola, quiero cotizar algo a mi medida.' },
  { texto: '¿Cuánto se demora mi pedido?', mensaje: 'Hola, ¿cuánto se demora un pedido en estar listo?' },
  { texto: '¿Hacen envíos? ¿A dónde?', mensaje: 'Hola, ¿hacen envíos? ¿A qué ciudades y cuánto cuesta?' },
  { texto: '¿Cómo puedo pagar?', mensaje: 'Hola, ¿qué formas de pago tienen?' },
  { texto: 'Quiero información de los cursos', mensaje: 'Hola, quiero información de los cursos de impresión 3D de la Academia.' },
]

const ICONO = `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M16.04 3C9.41 3 4.02 8.38 4.02 15c0 2.12.55 4.18 1.6 6L4 28l7.17-1.88A12 12 0 0 0 16.04 27C22.66 27 28.05 21.62 28.05 15S22.66 3 16.04 3Zm0 21.8a9.8 9.8 0 0 1-5-1.37l-.36-.21-4.25 1.12 1.13-4.14-.23-.38a9.77 9.77 0 1 1 8.71 5Zm5.37-7.32c-.29-.15-1.74-.86-2.01-.96-.27-.1-.47-.15-.66.15-.2.29-.76.95-.93 1.15-.17.2-.34.22-.64.07-.29-.15-1.24-.46-2.36-1.46a8.86 8.86 0 0 1-1.63-2.03c-.17-.29-.02-.45.13-.6.13-.13.29-.34.44-.51.15-.17.2-.29.29-.49.1-.2.05-.37-.02-.51-.07-.15-.66-1.6-.91-2.19-.24-.57-.48-.5-.66-.5h-.56c-.2 0-.51.07-.78.37-.27.29-1.02 1-1.02 2.44 0 1.44 1.05 2.83 1.2 3.03.15.2 2.06 3.15 5 4.42.7.3 1.24.48 1.67.62.7.22 1.34.19 1.85.12.56-.08 1.74-.71 1.98-1.4.24-.69.24-1.28.17-1.4-.07-.12-.27-.2-.56-.34Z"/></svg>`

const wa = (mensaje) => `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensaje)}`

function iniciar() {
  if (!CONFIG.WHATSAPP || document.querySelector('.wa-burbuja')) return
  const raiz = document.createElement('div')
  raiz.className = 'wa-burbuja'
  raiz.innerHTML = `
    <div class="wa-panel" id="wa-panel" role="dialog" aria-modal="false" aria-labelledby="wa-titulo" hidden>
      <div class="wa-panel__cab">
        <img src="images/icono.png" alt="" width="40" height="40" />
        <div>
          <p class="wa-panel__titulo" id="wa-titulo">Hecho en Capas</p>
          <p class="wa-panel__sub">Te respondemos por WhatsApp</p>
        </div>
        <button class="wa-panel__cerrar" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="wa-panel__cuerpo">
        <p class="wa-globo">¡Hola! ¿En qué te ayudamos? Toca una pregunta o escribe la tuya.</p>
        <div class="wa-preguntas">
          ${PREGUNTAS.map((p, i) => `<a href="${wa(p.mensaje)}" target="_blank" rel="noopener" data-i="${i}">${p.texto}</a>`).join('')}
        </div>
      </div>
      <form class="wa-escribir">
        <label class="visualmente-oculto" for="wa-texto">Escribe tu pregunta</label>
        <input id="wa-texto" name="texto" placeholder="Escribe tu pregunta…" autocomplete="off" maxlength="500" />
        <button type="submit" aria-label="Enviar por WhatsApp">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
      </form>
    </div>
    <button class="wa-boton" type="button" aria-expanded="false" aria-controls="wa-panel" aria-label="Escríbenos por WhatsApp">
      ${ICONO}
      <span class="wa-boton__aviso" aria-hidden="true">1</span>
    </button>`
  document.body.append(raiz)

  const boton = raiz.querySelector('.wa-boton')
  const panel = raiz.querySelector('.wa-panel')
  const abrir = (si) => {
    panel.hidden = !si
    boton.setAttribute('aria-expanded', String(si))
    raiz.classList.toggle('wa-burbuja--abierta', si)
    if (si) {
      raiz.querySelector('.wa-boton__aviso')?.remove()
      try { sessionStorage.setItem('hec_wa_visto', '1') } catch { /* sin almacenamiento */ }
      setTimeout(() => raiz.querySelector('.wa-preguntas a')?.focus(), 50)
    }
  }
  try { if (sessionStorage.getItem('hec_wa_visto')) raiz.querySelector('.wa-boton__aviso')?.remove() } catch { /* nada */ }
  boton.addEventListener('click', () => abrir(panel.hidden))
  raiz.querySelector('.wa-panel__cerrar').addEventListener('click', () => { abrir(false); boton.focus() })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) { abrir(false); boton.focus() }
  })
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !raiz.contains(e.target)) abrir(false)
  })
  raiz.querySelector('.wa-escribir').addEventListener('submit', (e) => {
    e.preventDefault()
    const t = e.target.texto.value.trim()
    window.open(wa(t ? `Hola, ${t}` : 'Hola, tengo una pregunta.'), '_blank', 'noopener')
    e.target.reset()
  })
  // Mientras haya una ventana abierta (producto, carrito…), la burbuja se esconde.
  const vigilar = () => raiz.classList.toggle('wa-burbuja--oculta', !!document.querySelector('dialog[open]'))
  new MutationObserver(vigilar).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] })
}

iniciar()
