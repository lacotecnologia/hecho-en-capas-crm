import * as THREE from 'three'

const VERDE = 0x007a52
const AMBAR = 0xf9ae12
const LIMA = 0xa8cc40

/** Material con "líneas de capa" como las de una impresión 3D (se ven en el eje Y del objeto). */
export function materialCapas(color, alturaCapa = 0.045, extra = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...extra })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCapa = { value: alturaCapa }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLy = position.y;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLy;\nuniform float uCapa;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float f = fract(vLy / uCapa);
        float surco = smoothstep(0.0, 0.18, f) * (1.0 - smoothstep(0.82, 1.0, f));
        diffuseColor.rgb *= 0.86 + 0.14 * surco;`
      )
  }
  m.customProgramCacheKey = () => 'capas' + alturaCapa
  return m
}

function malla(geo, color, capa) {
  const m = new THREE.Mesh(geo, materialCapas(color, capa))
  m.castShadow = true
  m.receiveShadow = true
  return m
}

/** Cada constructor devuelve { grupo, pintar(hex) } — pintar cambia el color principal. */
const constructores = {
  arbol() {
    const g = new THREE.Group()
    const principales = []
    const pisos = [
      { r: 1.1, h: 0.78, y: 0.55 },
      { r: 0.88, h: 0.72, y: 1.1 },
      { r: 0.66, h: 0.66, y: 1.62 },
      { r: 0.44, h: 0.6, y: 2.1 },
    ]
    pisos.forEach((p) => {
      const c = malla(new THREE.ConeGeometry(p.r, p.h, 6, 1), VERDE, 0.04)
      c.position.y = p.y
      c.rotation.y = Math.PI / 6
      g.add(c)
      principales.push(c)
    })
    const tronco = malla(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 20), 0x7a4b2a, 0.04)
    tronco.position.y = 0.05
    g.add(tronco)
    // estrella
    const s = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.3 : 0.13
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2
      const x = Math.cos(a) * r
      const y = Math.sin(a) * r
      i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)
    }
    s.closePath()
    const estrella = new THREE.Mesh(
      new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: AMBAR, roughness: 0.4, emissive: 0x3a2400 })
    )
    estrella.position.set(0, 2.62, -0.05)
    estrella.castShadow = true
    g.add(estrella)
    g.position.y = -1.3
    return { grupo: g, pintar: (hex) => principales.forEach((m) => m.material.color.set(hex)) }
  },

  soporte() {
    const g = new THREE.Group()
    const partes = []
    const base = malla(new THREE.BoxGeometry(2.3, 0.14, 1.5), 0x1f1f1f, 0.035)
    base.position.y = -0.9
    const respaldo = malla(new THREE.BoxGeometry(1.9, 0.14, 2.1), 0x1f1f1f, 0.035)
    respaldo.position.set(0, 0.0, -0.42)
    respaldo.rotation.x = -1.18
    const labio = malla(new THREE.BoxGeometry(1.9, 0.3, 0.14), 0x1f1f1f, 0.035)
    labio.position.set(0, -0.76, 0.55)
    const pata = malla(new THREE.BoxGeometry(1.5, 0.14, 1.05), 0x1f1f1f, 0.035)
    pata.position.set(0, -0.15, -0.88)
    pata.rotation.x = 0.55
    ;[base, respaldo, labio, pata].forEach((m) => {
      g.add(m)
      partes.push(m)
    })
    // celular de adorno
    const cel = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 1.9, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.25, metalness: 0.4 })
    )
    cel.position.set(0, 0.0, 0.03)
    cel.rotation.x = -1.18
    cel.translateZ(0.14)
    g.add(cel)
    g.rotation.y = -0.5
    return { grupo: g, pintar: (hex) => partes.forEach((m) => m.material.color.set(hex)) }
  },

  llavero() {
    const g = new THREE.Group()
    const forma = new THREE.Shape()
    const w = 1.6
    const h = 1.0
    const r = 0.28
    forma.moveTo(-w + r, -h)
    forma.lineTo(w - r, -h)
    forma.quadraticCurveTo(w, -h, w, -h + r)
    forma.lineTo(w, h - r)
    forma.quadraticCurveTo(w, h, w - r, h)
    forma.lineTo(-w + r, h)
    forma.quadraticCurveTo(-w, h, -w, h - r)
    forma.lineTo(-w, -h + r)
    forma.quadraticCurveTo(-w, -h, -w + r, -h)
    const hueco = new THREE.Path()
    hueco.absarc(-w + 0.45, 0, 0.17, 0, Math.PI * 2, true)
    forma.holes.push(hueco)
    const placa = malla(new THREE.ExtrudeGeometry(forma, { depth: 0.16, bevelEnabled: false, curveSegments: 24 }), VERDE, 0.04)
    placa.rotation.x = -Math.PI / 2
    placa.rotation.z = 0
    // se deja de pie, mirando a la cámara
    const frente = new THREE.Group()
    const placaV = new THREE.Mesh(placa.geometry, placa.material)
    placaV.castShadow = true
    frente.add(placaV)
    // tres capas del logo en relieve
    const colores = [LIMA, AMBAR, 0xffffff]
    colores.forEach((c, i) => {
      const barra = new THREE.Mesh(
        new THREE.BoxGeometry(1.45 - i * 0.2, 0.17, 0.1),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })
      )
      barra.position.set(0.2, 0.42 - i * 0.42, 0.2)
      barra.castShadow = true
      frente.add(barra)
    })
    // argolla
    const argolla = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.04, 14, 40),
      new THREE.MeshStandardMaterial({ color: 0xb9bcc2, metalness: 0.85, roughness: 0.28 })
    )
    argolla.position.set(-w + 0.45, 0, 0.08)
    argolla.rotation.y = 0.5
    frente.add(argolla)
    frente.rotation.x = 0
    g.add(frente)
    g.rotation.set(0.15, -0.4, 0.1)
    return { grupo: g, pintar: (hex) => placaV.material.color.set(hex) }
  },

  sello() {
    const g = new THREE.Group()
    const pts = [
      [0.0, 0],
      [0.95, 0],
      [0.95, 0.16],
      [0.4, 0.22],
      [0.32, 0.5],
      [0.34, 1.35],
      [0.46, 1.5],
      [0.46, 1.78],
      [0.34, 1.9],
      [0.0, 1.92],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    const cuerpo = malla(new THREE.LatheGeometry(pts, 40), 0x1f1f1f, 0.04)
    g.add(cuerpo)
    // cara del sello (abajo): relieve en capas
    const anillo = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.05, 12, 40),
      new THREE.MeshStandardMaterial({ color: AMBAR, roughness: 0.5 })
    )
    anillo.rotation.x = Math.PI / 2
    anillo.position.y = -0.03
    g.add(anillo)
    const estrella = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.06, 6),
      new THREE.MeshStandardMaterial({ color: LIMA, roughness: 0.5 })
    )
    estrella.position.y = -0.03
    g.add(estrella)
    g.position.y = -0.95
    g.rotation.z = 0.0
    return { grupo: g, pintar: (hex) => cuerpo.material.color.set(hex) }
  },

  tarjeta() {
    const g = new THREE.Group()
    const w = 1.6
    const h = 1.0
    const r = 0.1
    const f = new THREE.Shape()
    f.moveTo(-w + r, -h)
    f.lineTo(w - r, -h)
    f.quadraticCurveTo(w, -h, w, -h + r)
    f.lineTo(w, h - r)
    f.quadraticCurveTo(w, h, w - r, h)
    f.lineTo(-w + r, h)
    f.quadraticCurveTo(-w, h, -w, h - r)
    f.lineTo(-w, -h + r)
    f.quadraticCurveTo(-w, -h, -w + r, -h)
    const placa = new THREE.Mesh(
      new THREE.ExtrudeGeometry(f, { depth: 0.07, bevelEnabled: false }),
      new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 })
    )
    placa.castShadow = true
    g.add(placa)
    const barras = [
      [LIMA, 1.1, 0.42],
      [AMBAR, 0.8, 0.12],
      [VERDE, 1.1, -0.18],
    ]
    barras.forEach(([c, ancho, y], i) => {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(ancho, 0.13, 0.05 + i * 0.0),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 })
      )
      b.position.set(-0.2, y, 0.095)
      b.castShadow = true
      g.add(b)
    })
    const linea = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.05, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 })
    )
    linea.position.set(-0.55, -0.62, 0.09)
    g.add(linea)
    g.rotation.set(-0.5, -0.45, 0.05)
    return { grupo: g, pintar: (hex) => placa.material.color.set(hex) }
  },
}

export function crearModelo(tipo) {
  return constructores[tipo]()
}

/** Florero que "se imprime" capa por capa — para la portada. */
export function crearFlorero() {
  const pts = []
  const altura = 3.2
  for (let i = 0; i <= 80; i++) {
    const t = i / 80
    const r = 0.78 + 0.42 * Math.sin(t * Math.PI * 1.05) - 0.18 * Math.sin(t * Math.PI * 3.1) * (1 - t * 0.5) + 0.12 * t
    pts.push(new THREE.Vector2(Math.max(0.35, r), t * altura))
  }
  const geo = new THREE.LatheGeometry(pts, 96)
  const capa = 0.05
  const mat = new THREE.MeshStandardMaterial({ color: VERDE, roughness: 0.82, side: THREE.DoubleSide })
  const uniforms = { uCapa: { value: capa }, uAlto: { value: altura } }
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLy;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLy = position.y;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vLy;\nuniform float uCapa;\nuniform float uAlto;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float t = clamp(vLy / uAlto, 0.0, 1.0);
        vec3 cVerde = vec3(0.0, 0.478, 0.322);
        vec3 cLima = vec3(0.659, 0.8, 0.251);
        vec3 cAmbar = vec3(0.976, 0.682, 0.071);
        vec3 grad = mix(mix(cVerde, cLima, smoothstep(0.0, 0.62, t)), cAmbar, smoothstep(0.7, 1.0, t));
        float f = fract(vLy / uCapa);
        float surco = smoothstep(0.0, 0.2, f) * (1.0 - smoothstep(0.8, 1.0, f));
        diffuseColor.rgb = grad * (0.82 + 0.18 * surco);`
      )
  }
  const mesh = new THREE.Mesh(geo, mat)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return { mesh, material: mat, altura }
}
