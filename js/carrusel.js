// Carrusel de la portada: fotos grandes de todos los productos, con "Edición limitada"
// y "Más vendido" de primeros (las tarjetas ya llegan ordenadas).
// Se desliza con el dedo, con flechas o con los puntos; avanza solo cada 5 s.
// Si la persona lo mueve a mano, espera un rato y sigue solo. El botón de pausa lo detiene del todo.

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function pintarCarrusel(cont, tarjetas, { precio, foto, onVer, max = 10 }) {
  const lista = tarjetas.filter((t) => foto(t)).slice(0, max)
  cont.hidden = lista.length < 2
  if (cont.hidden) return
  cont.innerHTML = `
    <div class="carrusel__pista" tabindex="0" aria-label="Nuestros productos. Usa las flechas para moverte.">
      ${lista
        .map(
          (t, i) => `
        <article class="carrusel__slide" aria-roledescription="diapositiva" aria-label="${i + 1} de ${lista.length}: ${esc(t.nombre)}">
          <img class="carrusel__fondo" src="${esc(foto(t))}" alt="" aria-hidden="true" ${i > 1 ? 'loading="lazy"' : ''} />
          <img class="carrusel__foto" src="${esc(foto(t))}" alt="${esc(t.nombre)}" ${i > 1 ? 'loading="lazy"' : ''} />
          <div class="carrusel__texto">
            ${t.etiqueta ? `<span class="etiqueta">${esc(t.etiqueta)}</span>` : ''}
            <h3>${esc(t.nombre)}</h3>
            <p>${esc(t.corto)}</p>
            <div class="carrusel__pie">
              <span class="carrusel__precio">${precio(t)}</span>
              <button class="btn btn--ambar" type="button" data-ver="${esc(t.id)}">Ver producto</button>
            </div>
          </div>
        </article>`
        )
        .join('')}
    </div>
    <button class="carrusel__flecha carrusel__flecha--ant" type="button" aria-label="Anterior">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <button class="carrusel__flecha carrusel__flecha--sig" type="button" aria-label="Siguiente">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
    </button>
    <div class="carrusel__abajo">
    <button class="carrusel__pausa" type="button" aria-pressed="false" aria-label="Pausar el carrusel">
      <svg class="ico-pausa" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
      <svg class="ico-seguir" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z"/></svg>
    </button>
    ${
      lista.length > 8
        ? `<div class="carrusel__avance" aria-live="polite"><span class="carrusel__barra"><i></i></span><span class="carrusel__n"></span></div>`
        : `<div class="carrusel__puntos" role="group" aria-label="Escoger diapositiva">
      ${lista.map((t, i) => `<button type="button" aria-label="Ir a ${esc(t.nombre)}" data-i="${i}"></button>`).join('')}
    </div>`
    }
    </div>`

  const pista = cont.querySelector('.carrusel__pista')
  const slides = [...cont.querySelectorAll('.carrusel__slide')]
  const puntos = [...cont.querySelectorAll('.carrusel__puntos button')]
  const actual = () => {
    const x = pista.scrollLeft + pista.clientWidth * 0.3
    let i = 0
    slides.forEach((s, j) => { if (s.offsetLeft - pista.offsetLeft <= x) i = j })
    return i
  }
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const ir = (i) => {
    const n = (i + slides.length) % slides.length
    // Con "reducir movimiento" cambia de foto sin deslizar.
    pista.scrollTo({ left: slides[n].offsetLeft - pista.offsetLeft, behavior: quieto ? 'instant' : 'smooth' })
  }
  const marcar = () => {
    const i = actual()
    cont.dataset.actual = String(i)
    puntos.forEach((p, j) => p.setAttribute('aria-current', String(i === j)))
    const n = cont.querySelector('.carrusel__n')
    if (n) {
      n.textContent = `${i + 1} / ${slides.length}`
      cont.querySelector('.carrusel__barra i').style.width = `${((i + 1) / slides.length) * 100}%`
    }
  }
  let espera
  pista.addEventListener('scroll', () => { clearTimeout(espera); espera = setTimeout(marcar, 80) }, { passive: true })
  marcar()

  // Cuando la persona lo mueve a mano, el avance solo espera 10 s antes de seguir.
  let quietoHasta = 0
  const esperar = () => (quietoHasta = Date.now() + 10000)
  cont.querySelector('.carrusel__flecha--ant').addEventListener('click', () => { esperar(); ir(actual() - 1) })
  cont.querySelector('.carrusel__flecha--sig').addEventListener('click', () => { esperar(); ir(actual() + 1) })
  puntos.forEach((p) => p.addEventListener('click', () => { esperar(); ir(Number(p.dataset.i)) }))
  pista.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); esperar(); ir(actual() + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); esperar(); ir(actual() - 1) }
  })
  pista.addEventListener('touchstart', esperar, { passive: true })
  pista.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) esperar() }, { passive: true })
  cont.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => onVer(b.dataset.ver)))
  slides.forEach((s, i) => s.querySelector('.carrusel__foto').addEventListener('click', () => onVer(lista[i].id)))

  // Avance automático: siempre sigue solo, salvo que lo pausen con el botón.
  const botonPausa = cont.querySelector('.carrusel__pausa')
  let pausado = false
  botonPausa.addEventListener('click', () => {
    pausado = !pausado
    botonPausa.setAttribute('aria-pressed', String(pausado))
    botonPausa.setAttribute('aria-label', pausado ? 'Seguir pasando las fotos' : 'Pausar el carrusel')
    cont.classList.toggle('carrusel--pausado', pausado)
  })
  clearInterval(cont._reloj)
  cont._reloj = setInterval(() => {
    if (pausado || document.hidden || Date.now() < quietoHasta) return
    // Mientras está abierto un producto o el carrito, no se mueve por detrás.
    if (document.querySelector('dialog[open]')) return
    const r = cont.getBoundingClientRect()
    if (r.bottom < 0 || r.top > innerHeight) return
    ir(actual() + 1)
  }, 5000)
}
