// Animaciones con GSAP + ScrollTrigger. Si la persona prefiere menos movimiento, no se activa nada.
const gsap = window.gsap
const ScrollTrigger = window.ScrollTrigger
const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const hayAnimaciones = !!(gsap && ScrollTrigger) && !menosMovimiento

let disparadoresTarjetas = []

/** Aparición de las tarjetas del catálogo (se llama cada vez que se vuelve a dibujar la lista). */
export function revelarTarjetas() {
  if (!hayAnimaciones) return
  disparadoresTarjetas.forEach((t) => t.kill())
  const tarjetas = gsap.utils.toArray('.tarjeta')
  if (!tarjetas.length) return
  gsap.set(tarjetas, { opacity: 0, y: 46, scale: 0.96 })
  disparadoresTarjetas = ScrollTrigger.batch(tarjetas, {
    start: 'top 92%',
    once: true,
    onEnter: (lote) => gsap.to(lote, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'power3.out', stagger: 0.1, overwrite: true }),
  })
  ScrollTrigger.refresh()
}

/** `portada` es el control de la escena 3D (ver escena.js). */
export function iniciarAnimaciones(portada) {
  if (!hayAnimaciones) return
  gsap.registerPlugin(ScrollTrigger)

  /* 1. Entrada de la portada */
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
  intro
    .from('.barra', { yPercent: -100, duration: 0.6 })
    .from('.portada__texto > *', { y: 36, opacity: 0, duration: 0.7, stagger: 0.09 }, '-=0.3')
    .from('#escena-portada', { scale: 0.88, opacity: 0, duration: 1, ease: 'back.out(1.4)' }, '-=0.9')

  /* 2. El florero se imprime mientras bajas por la página */
  const base = { v: 0 }
  const pie = document.querySelector('.escena__pie')
  if (portada) {
    portada.manual = true
    portada.p = 0
    // primero empieza solo, hasta un 35 %
    gsap.to(base, {
      v: 0.35,
      duration: 2.4,
      ease: 'power2.inOut',
      delay: 0.5,
      onUpdate: () => (portada.p = base.v),
    })
    ScrollTrigger.create({
      trigger: '.portada',
      start: 'top 68px',
      end: '+=110%',
      pin: true,
      scrub: 0.7,
      onUpdate: (self) => {
        const sp = self.progress
        const p = base.v + sp * (1 - base.v)
        portada.p = p
        portada.giro = sp * Math.PI * 1.4
        portada.zoom = sp * 1.5
        portada.alto = -sp * 0.5
        if (pie) pie.textContent = p >= 0.995 ? '¡Listo! Así se hace cada producto' : `Imprimiendo… ${Math.round(p * 100)} %`
      },
    })
    gsap.to('.portada__texto', {
      opacity: 0.2,
      y: -24,
      ease: 'none',
      scrollTrigger: { trigger: '.portada', start: 'top 68px', end: '+=110%', scrub: true },
    })
  }

  /* 3. Secciones */
  const aparecer = (selector, opciones = {}) => {
    const els = gsap.utils.toArray(selector)
    if (!els.length) return
    gsap.set(els, { opacity: 0, y: 40 })
    ScrollTrigger.batch(els, {
      start: 'top 90%',
      once: true,
      onEnter: (lote) => gsap.to(lote, { opacity: 1, y: 0, x: 0, duration: 0.75, ease: 'power3.out', stagger: 0.12, ...opciones }),
    })
  }
  aparecer('.como .titulo, .tienda__cab, .preguntas .titulo')
  aparecer('.pasos li')
  gsap.utils.toArray('.paso__n').forEach((n) => {
    gsap.from(n, { scale: 0, rotate: -40, duration: 0.6, ease: 'back.out(2)', scrollTrigger: { trigger: n, start: 'top 90%', once: true } })
  })

  const medida = gsap.timeline({ scrollTrigger: { trigger: '.medida', start: 'top 75%', once: true } })
  medida
    .from('.medida .titulo', { y: 40, opacity: 0, duration: 0.7, ease: 'power3.out' })
    .from('.medida p', { y: 24, opacity: 0, duration: 0.6 }, '-=0.4')
    .from('.medida .portada__botones .btn', { y: 20, opacity: 0, duration: 0.5, stagger: 0.1 }, '-=0.3')
    .from('.medida__lista li', { x: 60, opacity: 0, duration: 0.7, stagger: 0.15, ease: 'power3.out' }, '-=0.8')

  aparecer('.preguntas details', { duration: 0.6, stagger: 0.08 })

  // las rayas de capas del fondo verde se mueven un poco más lento que el resto (profundidad)
  gsap.to('.medida', {
    backgroundPositionY: '40px',
    ease: 'none',
    scrollTrigger: { trigger: '.medida', start: 'top bottom', end: 'bottom top', scrub: true },
  })

  /* 4. Barra con sombra al bajar */
  ScrollTrigger.create({
    start: 80,
    end: 'max',
    onToggle: (s) => gsap.to('.barra', { boxShadow: s.isActive ? '0 6px 24px rgb(28 25 23 / 0.08)' : '0 0 0 rgb(0 0 0 / 0)', duration: 0.25 }),
  })

  // Las imágenes y letras terminan de cargar después: se recalculan las posiciones
  addEventListener('load', () => ScrollTrigger.refresh())
  document.fonts?.ready.then(() => ScrollTrigger.refresh())
}
