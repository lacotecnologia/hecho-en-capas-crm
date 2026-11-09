// Carrusel de destacados: fotos grandes de los productos, con "Edición limitada"
// y "Más vendido" de primeros (las tarjetas ya llegan ordenadas).
// Se desliza con el dedo, con flechas o con los puntos; avanza solo cada 5 s
// (se detiene al pasar el mouse, al tocarlo o si la persona pidió menos movimiento).

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function pintarCarrusel(cont, tarjetas, { precio, foto, onVer, max = 10 }) {
  const lista = tarjetas.filter((t) => foto(t)).slice(0, max)
  cont.hidden = lista.length < 2
  if (cont.hidden) return
  cont.innerHTML = `
    <div class="carrusel__pista" tabindex="0" aria-label="Productos destacados. Usa las flechas para moverte.">
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
    <div class="carrusel__puntos" role="group" aria-label="Escoger diapositiva">
      ${lista.map((t, i) => `<button type="button" aria-label="Ir a ${esc(t.nombre)}" data-i="${i}"></button>`).join('')}
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
  const ir = (i) => {
    const n = (i + slides.length) % slides.length
    pista.scrollTo({ left: slides[n].offsetLeft - pista.offsetLeft, behavior: 'smooth' })
  }
  const marcar = () => {
    const i = actual()
    puntos.forEach((p, j) => p.setAttribute('aria-current', String(i === j)))
  }
  let espera
  pista.addEventListener('scroll', () => { clearTimeout(espera); espera = setTimeout(marcar, 80) }, { passive: true })
  marcar()

  cont.querySelector('.carrusel__flecha--ant').addEventListener('click', () => ir(actual() - 1))
  cont.querySelector('.carrusel__flecha--sig').addEventListener('click', () => ir(actual() + 1))
  puntos.forEach((p) => p.addEventListener('click', () => ir(Number(p.dataset.i))))
  pista.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); ir(actual() + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); ir(actual() - 1) }
  })
  cont.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => onVer(b.dataset.ver)))
  slides.forEach((s, i) => s.querySelector('.carrusel__foto').addEventListener('click', () => onVer(lista[i].id)))

  // Avance automático (respeta "reducir movimiento" y se pausa con el mouse, el dedo o el teclado).
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (quieto) return
  let pausa = false
  const pausar = () => (pausa = true)
  const seguir = () => (pausa = false)
  cont.addEventListener('mouseenter', pausar)
  cont.addEventListener('mouseleave', seguir)
  cont.addEventListener('focusin', pausar)
  cont.addEventListener('focusout', seguir)
  pista.addEventListener('touchstart', pausar, { passive: true })
  clearInterval(cont._reloj)
  cont._reloj = setInterval(() => {
    if (pausa || document.hidden) return
    const r = cont.getBoundingClientRect()
    if (r.bottom < 0 || r.top > innerHeight) return
    ir(actual() + 1)
  }, 5000)
}
