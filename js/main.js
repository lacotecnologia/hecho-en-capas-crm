import { CONFIG } from './config.js'
import { pesos } from './data.js'
import { cargarCatalogo, filtrosDe } from './catalogo.js'
import { pintarCarrusel } from './carrusel.js'
import { hayWebGL, iniciarPortada } from './escena.js'
import { iniciarAnimaciones, revelarTarjetas } from './animaciones.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def } catch { return def } }

const WEBGL = hayWebGL()
const estado = {
  filtro: 'todo',
  tarjetas: [],
  // Líneas: { tid, vid, color, qty } (tarjeta, variante = producto del CRM, nombre del color)
  carrito: leer('hec_tienda_carrito2', []),
  usuario: leer('hec_tienda_usuario', null),
  pedidos: leer('hec_tienda_pedidos', []),
}
const tarjeta = (tid) => estado.tarjetas.find((t) => t.id === tid)
function lineaDe(l) {
  const t = tarjeta(l.tid)
  const v = t?.variantes.find((x) => x.id === l.vid)
  return t && v ? { t, v } : null
}
const nombreLinea = (t, v) => (v.tamano ? `${t.nombre} · ${v.tamano}` : t.nombre)

/* ---------- Avisos y ventanas ---------- */
let tAviso
function aviso(texto) {
  const el = $('#aviso')
  el.textContent = texto
  el.hidden = false
  clearTimeout(tAviso)
  tAviso = setTimeout(() => (el.hidden = true), 3000)
}
function abrir(dlg) { if (!dlg.open) dlg.showModal() }
$$('dialog').forEach((d) => {
  $$('[data-cerrar]', d).forEach((b) => b.addEventListener('click', () => d.close()))
  d.addEventListener('click', (e) => {
    if (e.target !== d) return
    const r = d.getBoundingClientRect()
    const fuera = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
    if (fuera) d.close()
  })
})

/* ---------- Portada 3D ---------- */
const controlPortada = WEBGL ? iniciarPortada($('#canvas-portada')) : null
if (!WEBGL) $('#escena-portada').innerHTML = '<img src="images/icono.png" alt="Hecho en Capas" style="margin:auto;width:60%;max-width:280px" />'

/* ---------- Catálogo ---------- */
function pintarFiltros() {
  const cont = $('#filtros')
  cont.innerHTML = ''
  filtrosDe(estado.tarjetas).forEach((c) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = c.nombre
    b.setAttribute('aria-pressed', String(estado.filtro === c.id))
    b.addEventListener('click', () => { estado.filtro = c.id; pintarFiltros(); pintarCatalogo() })
    cont.append(b)
  })
}

const conPrecio = (v) => typeof v.precio === 'number'
const esMedida = (t) => t.variantes.some((v) => v.personalizado)
function precioTarjeta(t) {
  const precios = t.variantes.filter(conPrecio).map((v) => v.precio)
  if (!precios.length) return '<span class="precio--consulta">Consulta el precio</span>'
  const min = Math.min(...precios)
  const desde = esMedida(t) || precios.length < t.variantes.length || new Set(precios).size > 1
  return (desde ? '<small class="chico" style="font-weight:500">desde </small>' : '') + pesos(min)
}
function precioVariante(v) {
  return conPrecio(v) ? (v.personalizado ? 'Desde ' : '') + pesos(v.precio) : 'Consulta el precio'
}
function fotoDe(t) {
  return t.variantes.find((v) => v.fotos.length)?.fotos[0] ?? null
}
function coloresTarjeta(t) {
  const vistos = new Map()
  t.variantes.forEach((v) => v.colores.forEach((c) => vistos.set(c.nombre, c)))
  return [...vistos.values()]
}
function waProducto(t, v, color, cant) {
  const extra = [color ? `color ${color}` : '', v.tamano ? `tamaño ${v.tamano}` : '', cant > 1 ? `${cant} unidades` : ''].filter(Boolean).join(', ')
  const texto = `Hola, me interesa: ${t.nombre}${extra ? ' (' + extra + ')' : ''}. ¿Me das el precio y el tiempo de entrega?`
  return `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(texto)}`
}

function pintarCatalogo() {
  const rej = $('#rejilla')
  rej.innerHTML = ''
  const lista = estado.tarjetas.filter((t) => estado.filtro === 'todo' || t.categoria === estado.filtro || (estado.filtro === 'medida' && esMedida(t)))
  if (!lista.length) {
    rej.innerHTML = `<p class="subtitulo" style="grid-column:1/-1">Pronto tendremos productos aquí. Mientras tanto, ${CONFIG.WHATSAPP ? `<a href="https://wa.me/${CONFIG.WHATSAPP}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>` : 'escríbenos'} y te contamos qué podemos hacer.</p>`
    return
  }
  lista.forEach((t) => {
    const foto = fotoDe(t)
    const nFotos = new Set(t.variantes.flatMap((v) => v.fotos)).size
    const colores = coloresTarjeta(t)
    const art = document.createElement('article')
    art.className = 'tarjeta'
    art.innerHTML = `
      <button class="tarjeta__img" type="button" aria-label="Ver ${esc(t.nombre)}">
        ${foto ? `<img src="${esc(foto)}" alt="${esc(t.nombre)}" loading="lazy" />` : '<img src="images/icono.png" alt="" style="position:static;width:40%;height:auto;margin:auto;padding:16% 0;object-fit:contain" />'}
        ${t.etiqueta ? `<span class="etiqueta">${esc(t.etiqueta)}</span>` : ''}
        ${foto ? `<span class="tarjeta__ver">${nFotos > 1 ? `Ver ${nFotos} fotos` : 'Ver foto'}</span>` : ''}
      </button>
      <div class="tarjeta__cuerpo">
        <h3>${esc(t.nombre)}</h3>
        <p class="tarjeta__corto">${esc(t.corto)}</p>
        ${t.variantes.length > 1 || hayStock(t) ? `<p class="tarjeta__extra">${[t.variantes.length > 1 ? `${t.variantes.length} tamaños` : '', hayStock(t) ? '<span class="disponible">Disponible ya</span>' : ''].filter(Boolean).join(' · ')}</p>` : ''}
        <div class="tarjeta__pie">
          <span class="precio">${precioTarjeta(t)}</span>
          <span class="mini-colores" aria-label="Colores disponibles">${colores.map((c) => `<i style="background:${esc(c.hex)}" title="${esc(c.nombre)}"></i>`).join('')}</span>
        </div>
        <button class="btn btn--ancho" type="button" style="margin-top:10px">Ver y pedir</button>
      </div>`
    $('.tarjeta__img', art).addEventListener('click', () => abrirProducto(t.id))
    $('.btn', art).addEventListener('click', () => abrirProducto(t.id))
    rej.append(art)
  })
  revelarTarjetas()
}

/* ---------- Producto ---------- */
let actual = { tid: null, vi: 0, color: null, cant: 1 }
const dlgProducto = $('#dlg-producto')
const varianteActual = () => tarjeta(actual.tid).variantes[actual.vi]

function abrirProducto(tid) {
  const t = tarjeta(tid)
  actual = { tid, vi: 0, color: null, cant: 1 }
  $('#p-etiqueta').textContent = t.etiqueta
  $('#p-etiqueta').hidden = !t.etiqueta
  $('#p-nombre').textContent = t.nombre
  $('#p-detalle').textContent = t.descripcion
  $('#p-cant').textContent = '1'
  // Siempre fotos (el visor 3D ya no se usa para productos).
  $('#canvas-visor').hidden = true
  $('.visor__ayuda').hidden = true
  pintarTamanos(t)
  pintarVariante()
  abrir(dlgProducto)
}
/** Lo que cambia al escoger otro tamaño: precio, fotos, colores, días y nota. */
function pintarVariante() {
  const t = tarjeta(actual.tid)
  const v = varianteActual()
  // Si el color escogido no existe en este tamaño, empieza por uno que esté listo para entregar.
  if (!v.colores.some((c) => c.nombre === actual.color)) actual.color = (v.colores.find((c) => c.stock > 0) ?? v.colores[0])?.nombre ?? null
  $('#p-precio').textContent = precioVariante(v)
  const nota = $('#p-nota')
  nota.hidden = !v.personalizado
  nota.textContent = v.personalizado ? 'Es a tu medida: te mostramos cómo va a quedar antes de fabricarlo y pagas el 50 % para empezar.' : ''
  const fotos = v.fotos.length ? v.fotos : t.variantes.find((x) => x.fotos.length)?.fotos ?? []
  $('#p-galeria').hidden = !fotos.length
  if (fotos.length) pintarGaleria(t, fotos, 0)
  pintarColores(v)
  pintarDisponible()
  actualizarWa()
}
/** Existencias del tamaño y color escogidos (si escoge color, cada color tiene las suyas). */
function disponibles(v, color) {
  if (v.colores.length) return v.colores.find((c) => c.nombre === color)?.stock ?? 0
  return v.stock || 0
}
const hayStock = (t) => t.variantes.some((v) => v.stock > 0 || v.colores.some((c) => c.stock > 0))
/** "Tenemos 3 listos…" si hay existencias; si no, los días de fabricación. */
function pintarDisponible() {
  const v = varianteActual()
  const n = disponibles(v, actual.color)
  const el = $('#p-dias')
  const enColor = v.colores.length && actual.color ? ` en ${actual.color}` : ''
  const cuando = v.dias ? `en unos ${v.dias} días` : 'y te confirmamos la fecha'
  const listos = `Tenemos ${n} ${n === 1 ? 'listo' : 'listos'}${enColor}`
  el.classList.toggle('visor__dias--listo', n > 0)
  if (n > 0 && actual.cant <= n) {
    el.textContent = `${listos} para entregar.`
  } else if (n > 0) {
    const faltan = actual.cant - n
    el.textContent = faltan === 1
      ? `${listos}; el otro lo fabricamos ${cuando}.`
      : `${listos}; los otros ${faltan} los fabricamos ${cuando}.`
  } else {
    const otros = v.colores.filter((c) => c.stock > 0).map((c) => c.nombre)
    const fabrica = v.dias ? `Lo fabricamos en unos ${v.dias} días.` : ''
    el.textContent = otros.length
      ? `${actual.color ? `En ${actual.color} lo fabricamos ${cuando}. ` : ''}Hay listos para entregar en ${otros.length > 1 ? otros.slice(0, -1).join(', ') + ' y ' + otros.at(-1) : otros[0]}.`
      : fabrica
  }
  el.hidden = !el.textContent
}
let galeria = { t: null, fotos: [], i: 0 }
function pintarGaleria(t, fotos, i) {
  galeria = { t, fotos, i }
  const img = $('#p-foto')
  img.src = fotos[i]
  img.alt = `${t.nombre}, foto ${i + 1} de ${fotos.length}`
  const varias = fotos.length > 1
  $('#p-foto-ant').hidden = !varias
  $('#p-foto-sig').hidden = !varias
  $('#p-foto-n').hidden = !varias
  $('#p-foto-n').textContent = `${i + 1} / ${fotos.length}`
  const mini = $('#p-miniaturas')
  mini.innerHTML = ''
  mini.hidden = !varias
  fotos.forEach((f, j) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('aria-label', `Ver foto ${j + 1}`)
    b.setAttribute('aria-current', String(i === j))
    b.innerHTML = `<img src="${esc(f)}" alt="" />`
    b.addEventListener('click', () => pintarGaleria(t, fotos, j))
    mini.append(b)
  })
}
const moverFoto = (d) => {
  if (galeria.fotos.length < 2) return
  pintarGaleria(galeria.t, galeria.fotos, (galeria.i + d + galeria.fotos.length) % galeria.fotos.length)
}
$('#p-foto-ant').addEventListener('click', () => moverFoto(-1))
$('#p-foto-sig').addEventListener('click', () => moverFoto(1))
dlgProducto.addEventListener('keydown', (e) => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
  if (e.key === 'ArrowRight') moverFoto(1)
  if (e.key === 'ArrowLeft') moverFoto(-1)
})
// Deslizar con el dedo sobre la foto.
let toque = null
$('#p-foto').addEventListener('touchstart', (e) => { toque = e.touches[0].clientX }, { passive: true })
$('#p-foto').addEventListener('touchend', (e) => {
  if (toque === null) return
  const dx = e.changedTouches[0].clientX - toque
  toque = null
  if (Math.abs(dx) > 40) moverFoto(dx < 0 ? 1 : -1)
})

function actualizarWa() {
  $('#p-wa').href = waProducto(tarjeta(actual.tid), varianteActual(), actual.color, actual.cant)
}
function pintarTamanos(t) {
  const cont = $('#p-tamanos')
  cont.innerHTML = ''
  $('#p-bloque-tam').hidden = t.variantes.length < 2
  if (t.variantes.length < 2) return
  t.variantes.forEach((v, i) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(i === actual.vi))
    b.textContent = v.tamano || `Opción ${i + 1}`
    b.addEventListener('click', () => {
      actual.vi = i
      $$('button', cont).forEach((x) => x.setAttribute('aria-checked', String(x === b)))
      pintarVariante()
    })
    cont.append(b)
  })
}
function pintarColores(v) {
  const cont = $('#p-colores')
  cont.innerHTML = ''
  $('#p-bloque-color').hidden = !v.colores.length
  if (!v.colores.length) return
  v.colores.forEach((c) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(c.nombre === actual.color))
    b.setAttribute('aria-label', c.nombre)
    b.title = c.nombre
    b.style.background = c.hex
    b.addEventListener('click', () => {
      actual.color = c.nombre
      $$('button', cont).forEach((x) => x.setAttribute('aria-checked', String(x === b)))
      $('#p-color-nombre').textContent = c.nombre
      pintarDisponible()
      actualizarWa()
    })
    cont.append(b)
  })
  $('#p-color-nombre').textContent = actual.color
}
$('#p-menos').addEventListener('click', () => { actual.cant = Math.max(1, actual.cant - 1); $('#p-cant').textContent = actual.cant; pintarDisponible(); actualizarWa() })
$('#p-mas').addEventListener('click', () => { actual.cant = Math.min(20, actual.cant + 1); $('#p-cant').textContent = actual.cant; pintarDisponible(); actualizarWa() })
$('#p-agregar').addEventListener('click', () => {
  const t = tarjeta(actual.tid)
  const v = varianteActual()
  agregar(t.id, v.id, actual.color, actual.cant)
  dlgProducto.close()
  aviso(`Agregamos ${actual.cant} × ${nombreLinea(t, v)} a tu pedido`)
})

/* ---------- Carrito ---------- */
function agregar(tid, vid, color, cant) {
  const l = estado.carrito.find((x) => x.tid === tid && x.vid === vid && x.color === color)
  if (l) l.qty = Math.min(50, l.qty + cant)
  else estado.carrito.push({ tid, vid, color, qty: cant })
  persistirCarrito()
  const b = $('#btn-carrito')
  b.classList.remove('salto'); void b.offsetWidth; b.classList.add('salto')
}
function persistirCarrito() { guardar('hec_tienda_carrito2', estado.carrito); pintarContador(); if ($('#dlg-carrito').open) pintarCarrito() }
function pintarContador() {
  const n = estado.carrito.reduce((a, l) => a + l.qty, 0)
  const el = $('#carrito-n')
  el.textContent = n
  el.hidden = n === 0
}
function totales() {
  let total = 0
  let anticipo = 0
  let resto = 0
  const lineas = estado.carrito.map(lineaDe).filter(Boolean)
  const porCotizar = lineas.some(({ v }) => !conPrecio(v))
  estado.carrito.forEach((l) => {
    const x = lineaDe(l)
    if (!x || !conPrecio(x.v)) return
    const valor = x.v.precio * l.qty
    total += valor
    if (x.v.personalizado) anticipo += Math.ceil(valor / 2 / 1000) * 1000
    else resto += valor
  })
  const hayPers = lineas.some(({ v }) => v.personalizado)
  return { total, hayPers, porCotizar, pagoAhora: hayPers ? resto + anticipo : total, falta: hayPers ? total - (resto + anticipo) : 0 }
}
function pintarCarrito() {
  const lista = $('#c-lista')
  const pie = $('#c-pie')
  if (!estado.carrito.length) {
    lista.innerHTML = '<div class="vacio"><p><b>Tu carrito está vacío.</b></p><p>Escoge un producto y lo verás aquí.</p><button class="btn" type="button" id="c-ir">Ver la tienda</button></div>'
    pie.hidden = true
    $('#c-ir').addEventListener('click', () => { $('#dlg-carrito').close(); location.hash = '#tienda' })
    return
  }
  pie.hidden = false
  lista.innerHTML = ''
  estado.carrito.forEach((l, i) => {
    const { t, v } = lineaDe(l)
    const foto = v.fotos[0] || fotoDe(t)
    const color = v.colores.find((c) => c.nombre === l.color)
    const fila = document.createElement('div')
    fila.className = 'linea'
    fila.innerHTML = `
      <img src="${esc(foto || 'images/icono.png')}" alt="" />
      <div>
        <h4>${esc(t.nombre)}</h4>
        <small>${color ? `<i style="background:${esc(color.hex)}"></i>` : ''}${esc([l.color, v.tamano].filter(Boolean).join(' · '))}</small>
        <div class="mini-cant"><button type="button" aria-label="Quitar una">−</button><output>${l.qty}</output><button type="button" aria-label="Agregar una">+</button></div>
      </div>
      <div class="linea__der"><b>${conPrecio(v) ? pesos(v.precio * l.qty) : '<span class="chico">Por cotizar</span>'}</b><button class="linea__quitar" type="button">Quitar</button></div>`
    const [menos, mas] = $$('.mini-cant button', fila)
    menos.addEventListener('click', () => { l.qty = Math.max(1, l.qty - 1); persistirCarrito() })
    mas.addEventListener('click', () => { l.qty = Math.min(50, l.qty + 1); persistirCarrito() })
    $('.linea__quitar', fila).addEventListener('click', () => { estado.carrito.splice(i, 1); persistirCarrito() })
    lista.append(fila)
  })
  const t = totales()
  pie.innerHTML = t.porCotizar
    ? `<p class="chico">Te confirmamos el precio por WhatsApp antes de cobrar. Lo que es a tu medida se paga 50 % para empezar. Sin IVA.</p>
    <button class="btn btn--grande btn--ancho" type="button" id="c-pedir">Enviar mi pedido</button>`
    : `
    <div class="suma suma--total"><span>Total</span><span>${pesos(t.total)}</span></div>
    ${t.hayPers ? `<div class="suma suma--anticipo"><span>Pagas ahora</span><span>${pesos(t.pagoAhora)}</span></div><p class="chico">Lo que es a tu medida se paga 50 % para empezar. El resto (${pesos(t.falta)}) cuando esté listo.</p>` : '<p class="chico">Sin IVA. El domicilio se confirma al hacer el pedido.</p>'}
    <button class="btn btn--grande btn--ancho" type="button" id="c-pedir">Hacer mi pedido</button>`
  $('#c-pedir').addEventListener('click', empezarPedido)
}
$('#btn-carrito').addEventListener('click', () => { pintarCarrito(); abrir($('#dlg-carrito')) })

/* ---------- Cuenta (Google) ---------- */
let despuesDeEntrar = null
function pintarUsuario() {
  const u = estado.usuario
  const conCuentas = !!CONFIG.GOOGLE_CLIENT_ID
  $('#btn-entrar').hidden = !conCuentas || !!u
  $('#usuario').hidden = !conCuentas || !u
  if (u) {
    $('#avatar').textContent = (u.nombre || '?').trim().charAt(0).toUpperCase()
    $('#usuario-nombre').textContent = u.nombre.split(' ')[0]
  }
}
function iniciarSesion(u) {
  estado.usuario = u
  guardar('hec_tienda_usuario', u)
  pintarUsuario()
  $('#dlg-entrar').close()
  aviso(`¡Hola, ${u.nombre.split(' ')[0]}!`)
  if (despuesDeEntrar) { const f = despuesDeEntrar; despuesDeEntrar = null; f() }
}
function decodificarJwt(token) {
  const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const bytes = Uint8Array.from(atob(b), (c) => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}
let gisListo = false
function prepararGoogle() {
  const cont = $('#google-boton')
  const prueba = $('#form-prueba')
  if (!CONFIG.GOOGLE_CLIENT_ID) {
    cont.hidden = true
    prueba.hidden = false
    return
  }
  const montar = () => {
    if (gisListo) return
    gisListo = true
    window.google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: (r) => {
        const d = decodificarJwt(r.credential)
        iniciarSesion({ nombre: d.name || d.email, correo: d.email, foto: d.picture, google: true, credencial: r.credential })
      },
    })
    window.google.accounts.id.renderButton(cont, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', locale: 'es', width: 300 })
  }
  if (window.google?.accounts) return montar()
  const s = document.createElement('script')
  s.src = 'https://accounts.google.com/gsi/client'
  s.async = true
  s.onload = montar
  s.onerror = () => { cont.hidden = true; prueba.hidden = false }
  document.head.append(s)
}
function pedirEntrar(luego) {
  despuesDeEntrar = luego || null
  prepararGoogle()
  abrir($('#dlg-entrar'))
}
$('#btn-entrar').addEventListener('click', () => pedirEntrar())
$('#form-prueba').addEventListener('submit', (e) => {
  e.preventDefault()
  const f = new FormData(e.target)
  iniciarSesion({ nombre: String(f.get('nombre')).trim(), correo: String(f.get('correo')).trim(), google: false })
})
const menuU = $('#usuario-menu')
$('#usuario-btn').addEventListener('click', () => {
  menuU.hidden = !menuU.hidden
  $('#usuario-btn').setAttribute('aria-expanded', String(!menuU.hidden))
})
document.addEventListener('click', (e) => { if (!e.target.closest('#usuario')) { menuU.hidden = true } })
$('#salir').addEventListener('click', () => {
  window.google?.accounts?.id?.disableAutoSelect()
  estado.usuario = null
  localStorage.removeItem('hec_tienda_usuario')
  menuU.hidden = true
  pintarUsuario()
  aviso('Cerraste tu sesión')
})
$('#ver-pedidos').addEventListener('click', () => {
  menuU.hidden = true
  const cont = $('#mp-lista')
  const mios = estado.pedidos.filter((p) => p.cliente.correo === estado.usuario?.correo)
  cont.innerHTML = mios.length
    ? mios.map((p) => `<div class="pedido-item"><header><span>${esc(p.codigo)}</span><span>${pesos(p.total)}</span></header><div class="chico">${esc(p.fecha)} · ${esc(p.estado)}</div><div>${p.items.map((i) => `${i.qty} × ${esc(i.nombre)} (${esc(i.color)})`).join('<br>')}</div></div>`).join('')
    : '<p class="subtitulo">Todavía no has hecho pedidos.</p>'
  abrir($('#dlg-mis-pedidos'))
})

/* ---------- Hacer el pedido ---------- */
function empezarPedido() {
  if (CONFIG.GOOGLE_CLIENT_ID && !estado.usuario) return pedirEntrar(empezarPedido)
  $('#dlg-carrito').close()
  const u = (CONFIG.GOOGLE_CLIENT_ID && estado.usuario) || { nombre: '' }
  const t = totales()
  $('#ped-contenido').innerHTML = `
    <h3 id="ped-titulo">Casi listo${u.nombre ? ', ' + esc(u.nombre.split(' ')[0]) : ''}</h3>
    <p class="subtitulo">Necesitamos unos datos para llevarte tu pedido.</p>
    <form class="form" id="form-pedido">
      <label class="campo">Tu nombre<input name="nombre" required value="${esc(u.nombre)}" autocomplete="name" /></label>
      <div class="dos">
        <label class="campo">Tu celular<small>Te escribimos por aquí cuando esté listo</small><input name="celular" required inputmode="tel" autocomplete="tel" placeholder="300 123 4567" /></label>
        <label class="campo">Tu ciudad<input name="ciudad" required autocomplete="address-level2" placeholder="Ej. Pereira" /></label>
      </div>
      <div class="opciones" role="radiogroup" aria-label="Cómo lo quieres recibir">
        <label class="opcion"><input type="radio" name="entrega" value="Domicilio" checked /><span>Que me lo lleven<small>Te confirmamos el valor del envío antes de cobrarlo</small></span></label>
        <label class="opcion"><input type="radio" name="entrega" value="Recoger" /><span>Lo recojo yo<small>Te decimos dónde y a qué hora</small></span></label>
      </div>
      <label class="campo" id="campo-dir">Dirección de entrega<input name="direccion" autocomplete="street-address" placeholder="Calle, número, barrio" /></label>
      <label class="campo">¿Algo más que debamos saber? <small>Opcional. Si es a tu medida, cuéntanos el nombre o el logo.</small><textarea name="nota" rows="3"></textarea></label>
      <div>
        ${t.porCotizar ? '' : `<div class="suma suma--total" style="margin:0 0 4px"><span>Total</span><span>${pesos(t.total)}</span></div>
        ${t.hayPers ? `<div class="suma suma--anticipo"><span>Pagas ahora</span><span>${pesos(t.pagoAhora)}</span></div>` : ''}`}
        <p class="chico">Al tocar el botón se abre WhatsApp con tu pedido escrito. Solo tienes que enviarlo y te confirmamos ${t.porCotizar ? 'el precio y ' : ''}cómo pagar.</p>
      </div>
      <p class="aviso" id="ped-error" hidden></p>
      <button class="btn btn--grande btn--ancho" type="submit" id="ped-enviar">Enviar mi pedido por WhatsApp</button>
    </form>`
  const form = $('#form-pedido')
  const dir = $('input[name=direccion]', form)
  const alternar = () => {
    const dom = form.entrega.value === 'Domicilio'
    $('#campo-dir').hidden = !dom
    dir.required = dom
  }
  $$('input[name=entrega]', form).forEach((r) => r.addEventListener('change', alternar))
  alternar()
  form.addEventListener('submit', enviarPedido)
  abrir($('#dlg-pedido'))
}

async function enviarPedido(e) {
  e.preventDefault()
  const form = e.target
  const f = new FormData(form)
  const t = totales()
  const lineas = estado.carrito.map((l) => ({ l, ...lineaDe(l) })).filter((x) => x.t)
  const dias = Math.max(0, ...lineas.map(({ v }) => v.dias || 0))
  const fecha = dias ? new Date(Date.now() + dias * 86400000) : null
  const pedido = {
    codigo: 'HEC-' + Date.now().toString(36).slice(-5).toUpperCase(),
    fecha: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    estado: 'Recibido',
    cliente: {
      nombre: String(f.get('nombre')).trim(),
      correo: estado.usuario?.correo || '',
      celular: String(f.get('celular')).trim(),
      ciudad: String(f.get('ciudad')).trim(),
    },
    entrega: String(f.get('entrega')),
    direccion: String(f.get('direccion') || '').trim(),
    nota: String(f.get('nota') || '').trim(),
    items: lineas.map(({ l, t, v }) => ({ id: v.id, nombre: t.nombre, color: [l.color, v.tamano].filter(Boolean).join(' · '), qty: l.qty, precio: v.precio, personalizado: v.personalizado })),
    porCotizar: t.porCotizar,
    total: t.total,
    pagoAhora: t.pagoAhora,
  }
  const btn = $('#ped-enviar')
  const err = $('#ped-error')
  err.hidden = true
  btn.disabled = true
  btn.textContent = 'Enviando…'
  try {
    if (CONFIG.API_PEDIDOS) {
      const r = await fetch(CONFIG.API_PEDIDOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pedido, credencialGoogle: estado.usuario?.credencial }),
      })
      if (!r.ok) throw new Error('fallo')
    }
  } catch {
    btn.disabled = false
    btn.textContent = 'Enviar mi pedido por WhatsApp'
    err.hidden = false
    err.textContent = 'No pudimos enviar tu pedido. Revisa tu internet y vuelve a intentarlo; tu carrito sigue guardado.'
    return
  }
  estado.pedidos.unshift(pedido)
  guardar('hec_tienda_pedidos', estado.pedidos)
  estado.carrito = []
  persistirCarrito()
  const fechaTxt = fecha ? fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
  const wa = CONFIG.WHATSAPP ? `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensajePedido(pedido, fechaTxt))}` : ''
  if (wa) window.open(wa, '_blank', 'noopener')
  $('#ped-contenido').innerHTML = `
    <div class="listo">
      <div class="listo__marca"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg></div>
      <h3 id="ped-titulo">${CONFIG.API_PEDIDOS ? '¡Recibimos tu pedido!' : 'Ya casi: envíalo en WhatsApp'}</h3>
      <span class="codigo">${esc(pedido.codigo)}</span>
      <p>${CONFIG.API_PEDIDOS ? '' : 'Se abrió WhatsApp con tu pedido escrito. <b>Toca enviar</b> para que nos llegue. '}Te confirmamos ${pedido.porCotizar ? 'el precio, ' : ''}cómo pagar${fechaTxt ? ` y lo tendríamos listo hacia el <b>${fechaTxt}</b>` : ' y la fecha de entrega'}.</p>
      <div class="portada__botones" style="justify-content:center">
        ${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener">${CONFIG.API_PEDIDOS ? 'Avisar por WhatsApp' : 'Abrir WhatsApp otra vez'}</a>` : ''}
        <button class="btn btn--borde" type="button" id="ped-seguir">Seguir mirando</button>
      </div>
    </div>`
  $('#ped-seguir').addEventListener('click', () => $('#dlg-pedido').close())
}

function mensajePedido(p, fechaTxt) {
  const lineas = p.items.map((i) => `• ${i.qty} × ${i.nombre}${i.color ? ` (${i.color})` : ''}${typeof i.precio === 'number' ? ` — ${pesos(i.precio * i.qty)}` : ''}`)
  const entrega = p.entrega === 'Domicilio' ? `Domicilio: ${p.direccion}, ${p.cliente.ciudad}` : `Lo recojo yo (${p.cliente.ciudad})`
  return [
    `Hola, quiero hacer este pedido en Hecho en Capas (${p.codigo}):`,
    '',
    ...lineas,
    '',
    ...(p.porCotizar ? ['Por favor confírmame el precio.'] : [`Total: ${pesos(p.total)}`, ...(p.pagoAhora < p.total ? [`Anticipo para empezar: ${pesos(p.pagoAhora)}`] : [])]),
    '',
    `Nombre: ${p.cliente.nombre}`,
    `Celular: ${p.cliente.celular}`,
    entrega,
    ...(p.nota ? [`Nota: ${p.nota}`] : []),
    ...(fechaTxt ? [`Fecha aproximada: ${fechaTxt}`] : []),
  ].join('\n')
}

/* ---------- Arranque ---------- */
$$('[data-filtro]').forEach((a) => a.addEventListener('click', () => {
  estado.filtro = a.dataset.filtro === 'personalizado' ? 'medida' : a.dataset.filtro
  pintarFiltros()
  pintarCatalogo()
}))
if (CONFIG.WHATSAPP) {
  const a = $('#medida-wa')
  a.hidden = false
  a.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent('Hola, quiero cotizar algo a mi medida.')}`
  a.target = '_blank'
  a.rel = 'noopener'
}
$('#rejilla').innerHTML = '<p class="subtitulo" style="grid-column:1/-1">Cargando productos…</p>'
pintarContador()
pintarUsuario()
iniciarAnimaciones(controlPortada)
cargarCatalogo().then(({ tarjetas }) => {
  estado.tarjetas = tarjetas
  // Quita del carrito lo que ya no está en la tienda.
  const antes = estado.carrito.length
  estado.carrito = estado.carrito.filter((l) => lineaDe(l))
  if (estado.carrito.length !== antes) persistirCarrito()
  pintarFiltros()
  pintarCatalogo()
  pintarContador()
  pintarCarrusel($('#destacados'), estado.tarjetas, { precio: precioTarjeta, foto: fotoDe, onVer: abrirProducto })
})
