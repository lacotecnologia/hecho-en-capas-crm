import { CONFIG } from './config.js'
import { PRODUCTOS, CATEGORIAS, COLORES, pesos } from './data.js'
import { hayWebGL, iniciarPortada, dibujarTarjeta, crearVisor } from './escena.js'
import { iniciarAnimaciones, revelarTarjetas } from './animaciones.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def } catch { return def } }

const WEBGL = hayWebGL()
const estado = {
  filtro: 'todo',
  carrito: leer('hec_tienda_carrito', []).filter((l) => PRODUCTOS.some((p) => p.id === l.id)),
  usuario: leer('hec_tienda_usuario', null),
  pedidos: leer('hec_tienda_pedidos', []),
}
const producto = (id) => PRODUCTOS.find((p) => p.id === id)

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
  CATEGORIAS.forEach((c) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = c.nombre
    b.setAttribute('aria-pressed', String(estado.filtro === c.id))
    b.addEventListener('click', () => { estado.filtro = c.id; pintarFiltros(); pintarCatalogo() })
    cont.append(b)
  })
}

function colorHex(id) { return COLORES[id].hex }

function pintarCatalogo() {
  const rej = $('#rejilla')
  rej.innerHTML = ''
  PRODUCTOS.filter((p) => estado.filtro === 'todo' || p.categoria === estado.filtro).forEach((p) => {
    const art = document.createElement('article')
    art.className = 'tarjeta'
    art.innerHTML = `
      <button class="tarjeta__img" type="button" aria-label="Ver ${esc(p.nombre)} en 3D">
        <canvas width="520" height="390"></canvas>
        <span class="etiqueta">${esc(p.etiqueta)}</span>
        <span class="tarjeta__ver">Ver en 3D</span>
      </button>
      <div class="tarjeta__cuerpo">
        <h3>${esc(p.nombre)}</h3>
        <p class="tarjeta__corto">${esc(p.corto)}</p>
        <div class="tarjeta__pie">
          <span class="precio">${p.personalizado ? '<small class="chico" style="font-weight:500">desde </small>' : ''}${pesos(p.precio)}</span>
          <span class="mini-colores" aria-label="Colores disponibles">${p.colores.map((c) => `<i style="background:${colorHex(c)}" title="${COLORES[c].nombre}"></i>`).join('')}</span>
        </div>
        <button class="btn btn--ancho" type="button" style="margin-top:10px">Escoger y agregar</button>
      </div>`
    const cv = $('canvas', art)
    const hex = colorHex(p.colores[0])
    if (WEBGL) {
      dibujarTarjeta(cv, p.modelo, hex)
      let raf, t0
      const girar = (t) => {
        t0 ??= t
        dibujarTarjeta(cv, p.modelo, hex, -0.5 + (t - t0) / 1200)
        raf = requestAnimationFrame(girar)
      }
      const img = $('.tarjeta__img', art)
      img.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { t0 = undefined; raf = requestAnimationFrame(girar) } })
      img.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); dibujarTarjeta(cv, p.modelo, hex) })
    } else {
      cv.replaceWith(Object.assign(new Image(), { src: 'images/icono.png', alt: '', style: 'width:45%;margin:auto;padding:18% 0' }))
    }
    $('.tarjeta__img', art).addEventListener('click', () => abrirProducto(p.id))
    $('.btn', art).addEventListener('click', () => abrirProducto(p.id))
    rej.append(art)
  })
  revelarTarjetas()
}

/* ---------- Producto (visor 3D) ---------- */
let visor
let actual = { id: null, color: null, cant: 1 }
const dlgProducto = $('#dlg-producto')

function abrirProducto(id) {
  const p = producto(id)
  actual = { id, color: p.colores[0], cant: 1 }
  $('#p-etiqueta').textContent = p.etiqueta
  $('#p-nombre').textContent = p.nombre
  $('#p-precio').textContent = (p.personalizado ? 'Desde ' : '') + pesos(p.precio)
  $('#p-detalle').textContent = p.detalle
  $('#p-dias').textContent = `Lo fabricamos en unos ${p.dias} días.`
  const nota = $('#p-nota')
  nota.hidden = !p.personalizado
  nota.textContent = p.personalizado ? 'Este producto es a tu medida: pagas el 50 % para empezar y el resto cuando esté listo.' : ''
  pintarColores(p)
  $('#p-cant').textContent = '1'
  abrir(dlgProducto)
  if (WEBGL) {
    visor ??= crearVisor($('#canvas-visor'))
    visor.cargar(p.modelo, colorHex(actual.color))
    visor.iniciar()
  }
}
function pintarColores(p) {
  const cont = $('#p-colores')
  cont.innerHTML = ''
  p.colores.forEach((c) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.setAttribute('aria-checked', String(c === actual.color))
    b.setAttribute('aria-label', COLORES[c].nombre)
    b.title = COLORES[c].nombre
    b.style.background = colorHex(c)
    b.addEventListener('click', () => {
      actual.color = c
      visor?.pintar(colorHex(c))
      $$('button', cont).forEach((x) => x.setAttribute('aria-checked', String(x === b)))
      $('#p-color-nombre').textContent = COLORES[c].nombre
    })
    cont.append(b)
  })
  $('#p-color-nombre').textContent = COLORES[actual.color].nombre
}
dlgProducto.addEventListener('close', () => visor?.detener())
$('#p-menos').addEventListener('click', () => { actual.cant = Math.max(1, actual.cant - 1); $('#p-cant').textContent = actual.cant })
$('#p-mas').addEventListener('click', () => { actual.cant = Math.min(20, actual.cant + 1); $('#p-cant').textContent = actual.cant })
$('#p-agregar').addEventListener('click', () => {
  agregar(actual.id, actual.color, actual.cant)
  dlgProducto.close()
  const p = producto(actual.id)
  aviso(`Agregamos ${actual.cant} × ${p.nombre} a tu carrito`)
})

/* ---------- Carrito ---------- */
function agregar(id, color, cant) {
  const l = estado.carrito.find((x) => x.id === id && x.color === color)
  if (l) l.qty = Math.min(50, l.qty + cant)
  else estado.carrito.push({ id, color, qty: cant })
  persistirCarrito()
  const b = $('#btn-carrito')
  b.classList.remove('salto'); void b.offsetWidth; b.classList.add('salto')
}
function persistirCarrito() { guardar('hec_tienda_carrito', estado.carrito); pintarContador(); if ($('#dlg-carrito').open) pintarCarrito() }
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
  estado.carrito.forEach((l) => {
    const p = producto(l.id)
    const v = p.precio * l.qty
    total += v
    if (p.personalizado) anticipo += Math.ceil(v / 2 / 1000) * 1000
    else resto += v
  })
  const hayPers = estado.carrito.some((l) => producto(l.id).personalizado)
  return { total, hayPers, pagoAhora: hayPers ? resto + anticipo : total, falta: hayPers ? total - (resto + anticipo) : 0 }
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
    const p = producto(l.id)
    const fila = document.createElement('div')
    fila.className = 'linea'
    fila.innerHTML = `
      <canvas width="152" height="114"></canvas>
      <div>
        <h4>${esc(p.nombre)}</h4>
        <small><i style="background:${colorHex(l.color)}"></i>${COLORES[l.color].nombre}</small>
        <div class="mini-cant"><button type="button" aria-label="Quitar una">−</button><output>${l.qty}</output><button type="button" aria-label="Agregar una">+</button></div>
      </div>
      <div class="linea__der"><b>${pesos(p.precio * l.qty)}</b><button class="linea__quitar" type="button">Quitar</button></div>`
    if (WEBGL) dibujarTarjeta($('canvas', fila), p.modelo, colorHex(l.color))
    const [menos, mas] = $$('.mini-cant button', fila)
    menos.addEventListener('click', () => { l.qty = Math.max(1, l.qty - 1); persistirCarrito() })
    mas.addEventListener('click', () => { l.qty = Math.min(50, l.qty + 1); persistirCarrito() })
    $('.linea__quitar', fila).addEventListener('click', () => { estado.carrito.splice(i, 1); persistirCarrito() })
    lista.append(fila)
  })
  const t = totales()
  pie.innerHTML = `
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
        <div class="suma suma--total" style="margin:0 0 4px"><span>Total</span><span>${pesos(t.total)}</span></div>
        ${t.hayPers ? `<div class="suma suma--anticipo"><span>Pagas ahora</span><span>${pesos(t.pagoAhora)}</span></div>` : ''}
        <p class="chico">Al tocar el botón se abre WhatsApp con tu pedido escrito. Solo tienes que enviarlo y te confirmamos cómo pagar.</p>
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
  const dias = Math.max(...estado.carrito.map((l) => producto(l.id).dias))
  const fecha = new Date(Date.now() + dias * 86400000)
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
    items: estado.carrito.map((l) => ({ id: l.id, nombre: producto(l.id).nombre, color: COLORES[l.color].nombre, qty: l.qty, precio: producto(l.id).precio, personalizado: producto(l.id).personalizado })),
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
  const fechaTxt = fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const wa = CONFIG.WHATSAPP ? `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(mensajePedido(pedido, fechaTxt))}` : ''
  if (wa) window.open(wa, '_blank', 'noopener')
  $('#ped-contenido').innerHTML = `
    <div class="listo">
      <div class="listo__marca"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10"/></svg></div>
      <h3 id="ped-titulo">${CONFIG.API_PEDIDOS ? '¡Recibimos tu pedido!' : 'Ya casi: envíalo en WhatsApp'}</h3>
      <span class="codigo">${esc(pedido.codigo)}</span>
      <p>${CONFIG.API_PEDIDOS ? '' : 'Se abrió WhatsApp con tu pedido escrito. <b>Toca enviar</b> para que nos llegue. '}Te confirmamos cómo pagar y lo tendríamos listo hacia el <b>${fechaTxt}</b>.</p>
      <div class="portada__botones" style="justify-content:center">
        ${wa ? `<a class="btn" href="${wa}" target="_blank" rel="noopener">${CONFIG.API_PEDIDOS ? 'Avisar por WhatsApp' : 'Abrir WhatsApp otra vez'}</a>` : ''}
        <button class="btn btn--borde" type="button" id="ped-seguir">Seguir mirando</button>
      </div>
    </div>`
  $('#ped-seguir').addEventListener('click', () => $('#dlg-pedido').close())
}

function mensajePedido(p, fechaTxt) {
  const lineas = p.items.map((i) => `• ${i.qty} × ${i.nombre} (${i.color}) — ${pesos(i.precio * i.qty)}`)
  const entrega = p.entrega === 'Domicilio' ? `Domicilio: ${p.direccion}, ${p.cliente.ciudad}` : `Lo recojo yo (${p.cliente.ciudad})`
  return [
    `Hola, quiero hacer este pedido en Hecho en Capas (${p.codigo}):`,
    '',
    ...lineas,
    '',
    `Total: ${pesos(p.total)}`,
    ...(p.pagoAhora < p.total ? [`Anticipo para empezar: ${pesos(p.pagoAhora)}`] : []),
    '',
    `Nombre: ${p.cliente.nombre}`,
    `Celular: ${p.cliente.celular}`,
    entrega,
    ...(p.nota ? [`Nota: ${p.nota}`] : []),
    `Fecha aproximada: ${fechaTxt}`,
  ].join('\n')
}

/* ---------- Arranque ---------- */
$$('[data-filtro]').forEach((a) => a.addEventListener('click', () => { estado.filtro = a.dataset.filtro; pintarFiltros(); pintarCatalogo() }))
if (CONFIG.WHATSAPP) {
  const a = $('#medida-wa')
  a.hidden = false
  a.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent('Hola, quiero cotizar algo a mi medida.')}`
  a.target = '_blank'
  a.rel = 'noopener'
}
pintarFiltros()
pintarCatalogo()
pintarContador()
pintarUsuario()
iniciarAnimaciones(controlPortada)
