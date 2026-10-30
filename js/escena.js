import * as THREE from 'three'
import { OrbitControls } from 'three/addons/OrbitControls.js'
import { crearFlorero, crearModelo } from './models.js'

const menosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function hayWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function luces(scene) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c7, 1.05))
  const sol = new THREE.DirectionalLight(0xffffff, 2.2)
  sol.position.set(2.5, 6, 3.5)
  sol.castShadow = true
  sol.shadow.mapSize.set(1024, 1024)
  sol.shadow.camera.left = -4
  sol.shadow.camera.right = 4
  sol.shadow.camera.top = 4
  sol.shadow.camera.bottom = -4
  sol.shadow.bias = -0.0008
  scene.add(sol)
  const relleno = new THREE.DirectionalLight(0xffe2b0, 0.7)
  relleno.position.set(-4, 2, -2)
  scene.add(relleno)
}

function suelo(scene, y) {
  const s = new THREE.Mesh(new THREE.CircleGeometry(2.8, 64), new THREE.ShadowMaterial({ opacity: 0.16 }))
  s.rotation.x = -Math.PI / 2
  s.position.y = y
  s.receiveShadow = true
  scene.add(s)
  return s
}

function ajustar(renderer, camera, el) {
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}

/* ---------- Portada: florero que se imprime ---------- */
export function iniciarPortada(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.localClippingEnabled = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.8

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  camera.position.set(0, 2.1, 9.6)
  luces(scene)

  const { mesh, material, altura } = crearFlorero()
  const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)
  material.clippingPlanes = [plano]
  material.clipShadows = true
  const grupo = new THREE.Group()
  grupo.add(mesh)
  grupo.position.y = -1.55
  scene.add(grupo)
  suelo(scene, -1.56)

  // boquilla de la impresora
  const boquilla = new THREE.Group()
  const cuerpo = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.34, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.4 })
  )
  const punta = new THREE.Mesh(
    new THREE.ConeGeometry(0.1, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xf9ae12, emissive: 0x7a4b00, roughness: 0.3 })
  )
  punta.rotation.x = Math.PI
  punta.position.y = -0.27
  boquilla.add(cuerpo, punta)
  scene.add(boquilla)

  // chispitas de colores flotando (capas sueltas)
  const trozos = []
  const cols = [0x007a52, 0xa8cc40, 0xf9ae12]
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.07, 0.34),
      new THREE.MeshStandardMaterial({ color: cols[i % 3], roughness: 0.55 })
    )
    const a = (i / 14) * Math.PI * 2
    const r = 1.95 + (i % 3) * 0.28
    m.userData = { a, r, y: -0.6 + ((i * 37) % 100) / 30, v: 0.15 + (i % 4) * 0.05 }
    m.position.set(Math.cos(a) * r, m.userData.y, Math.sin(a) * r * 0.55)
    scene.add(m)
    trozos.push(m)
  }

  let mx = 0
  let my = 0
  addEventListener('pointermove', (e) => {
    mx = (e.clientX / innerWidth) * 2 - 1
    my = (e.clientY / innerHeight) * 2 - 1
  })

  // Valores que mueve GSAP desde fuera (main.js)
  const control = { manual: false, p: 0, giro: 0, zoom: 0, alto: 0 }

  const t0 = performance.now()
  let visible = true
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas)
  const ro = new ResizeObserver(() => ajustar(renderer, camera, canvas))
  ro.observe(canvas)
  ajustar(renderer, camera, canvas)

  function cuadro() {
    requestAnimationFrame(cuadro)
    if (!visible) return
    const t = (performance.now() - t0) / 1000
    // Modo automático: sube durante 7 s, se queda 2.5 s mostrando el florero terminado, y vuelve a empezar.
    // Modo manual (scroll): el progreso lo manda GSAP ScrollTrigger.
    const ciclo = 9.5
    const p = menosMovimiento ? 1 : control.manual ? control.p : (t % ciclo) / 7
    const prog = Math.min(1, p)
    const y = prog * (altura + 0.02)
    plano.constant = grupo.position.y + y
    boquilla.visible = prog < 1
    const rad = 0.9 + 0.3
    boquilla.position.set(Math.sin(t * 9) * rad * 0.35, grupo.position.y + y + 0.3, Math.cos(t * 9) * rad * 0.35)
    grupo.rotation.y = menosMovimiento ? 0.5 : t * 0.45 + mx * 0.35 + control.giro
    camera.position.x = mx * 0.6
    camera.position.y = 2.1 - my * 0.4 + control.alto
    camera.position.z = 9.6 - control.zoom
    camera.lookAt(0, 0.35, 0)
    trozos.forEach((m, i) => {
      const d = m.userData
      d.a += d.v * 0.004 * (menosMovimiento ? 0 : 1)
      m.position.set(Math.cos(d.a) * d.r, d.y + Math.sin(t * 0.8 + i) * 0.12, Math.sin(d.a) * d.r * 0.55)
      m.rotation.y = d.a * 2
    })
    renderer.render(scene, camera)
  }
  cuadro()
  return control
}

/* ---------- Vistas previas en las tarjetas (un solo motor 3D para todas) ---------- */
let motor
function obtenerMotor() {
  if (motor) return motor
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 50)
  camera.position.set(0, 1.2, 8)
  camera.lookAt(0, 0.1, 0)
  luces(scene)
  suelo(scene, -1.45)
  motor = { renderer, scene, camera, actual: null }
  return motor
}

export function dibujarTarjeta(canvas2d, tipo, colorHex, giro = -0.5) {
  const m = obtenerMotor()
  const w = canvas2d.width
  const h = canvas2d.height
  if (m.renderer.domElement.width !== w || m.renderer.domElement.height !== h) {
    m.renderer.setSize(w, h, false)
    m.camera.aspect = w / h
    m.camera.updateProjectionMatrix()
  }
  if (!m.modelos) m.modelos = {}
  if (!m.modelos[tipo]) {
    m.modelos[tipo] = crearModelo(tipo)
    m.modelos[tipo].grupo.visible = false
    m.modelos[tipo].base = m.modelos[tipo].grupo.rotation.y
    m.scene.add(m.modelos[tipo].grupo)
  }
  Object.values(m.modelos).forEach((x) => (x.grupo.visible = false))
  const mod = m.modelos[tipo]
  mod.grupo.visible = true
  mod.pintar(colorHex)
  mod.grupo.rotation.y = mod.base + giro + 0.5
  m.renderer.render(m.scene, m.camera)
  const ctx = canvas2d.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(m.renderer.domElement, 0, 0, w, h)
}

/* ---------- Visor grande con giro libre ---------- */
export function crearVisor(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  camera.position.set(0, 1.4, 7.5)
  luces(scene)
  suelo(scene, -1.45)
  const controles = new OrbitControls(camera, canvas)
  controles.enableDamping = true
  controles.enablePan = false
  controles.minDistance = 4
  controles.maxDistance = 11
  controles.maxPolarAngle = Math.PI * 0.55
  controles.autoRotate = !menosMovimiento
  controles.autoRotateSpeed = 1.6
  controles.target.set(0, 0.1, 0)
  canvas.addEventListener('pointerdown', () => (controles.autoRotate = false))

  let modelo = null
  let activo = false
  function cargar(tipo, colorHex) {
    if (modelo) scene.remove(modelo.grupo)
    modelo = crearModelo(tipo)
    modelo.pintar(colorHex)
    scene.add(modelo.grupo)
    camera.position.set(0, 1.4, 7.5)
    controles.autoRotate = !menosMovimiento
    controles.update()
  }
  function pintar(hex) {
    modelo?.pintar(hex)
  }
  const ro = new ResizeObserver(() => ajustar(renderer, camera, canvas))
  ro.observe(canvas)
  function cuadro() {
    if (!activo) return
    requestAnimationFrame(cuadro)
    controles.update()
    renderer.render(scene, camera)
  }
  return {
    cargar,
    pintar,
    iniciar() {
      activo = true
      ajustar(renderer, camera, canvas)
      cuadro()
    },
    detener() {
      activo = false
    },
  }
}
