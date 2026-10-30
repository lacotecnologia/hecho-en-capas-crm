// Productos de ejemplo. Los precios son de muestra: se reemplazan por los del CRM (precio de venta al público).
export const COLORES = {
  verde: { nombre: 'Verde', hex: '#007a52' },
  lima: { nombre: 'Verde lima', hex: '#a8cc40' },
  ambar: { nombre: 'Ámbar', hex: '#f9ae12' },
  naranja: { nombre: 'Naranja', hex: '#fa9a05' },
  rojo: { nombre: 'Rojo', hex: '#bb3d43' },
  azul: { nombre: 'Azul', hex: '#2f6fc0' },
  negro: { nombre: 'Negro', hex: '#1f1f1f' },
  blanco: { nombre: 'Blanco', hex: '#f2f0ea' },
}

export const PRODUCTOS = [
  {
    id: 'arbol-navidad',
    nombre: 'Árbol de Navidad 15 cm',
    categoria: 'decoracion',
    modelo: 'arbol',
    precio: 29000,
    personalizado: false,
    dias: 3,
    corto: 'Un arbolito para la mesa o el escritorio, armado por pisos.',
    detalle:
      'Se arma en 5 piezas que encajan entre sí, con una estrella arriba. Lo hacemos en el color que prefieras y llega listo para decorar.',
    colores: ['verde', 'lima', 'blanco', 'rojo'],
    etiqueta: 'De temporada',
  },
  {
    id: 'soporte-celular',
    nombre: 'Soporte plegable para celular',
    categoria: 'oficina',
    modelo: 'soporte',
    precio: 18000,
    personalizado: false,
    dias: 2,
    corto: 'Se pliega, cabe en el bolsillo y sostiene tu celular donde lo necesites.',
    detalle:
      'Sirve para celulares de hasta 11,5 mm de grosor. Se abre y se cierra con la mano, sin tornillos ni piezas sueltas.',
    colores: ['verde', 'negro', 'azul', 'rojo', 'blanco'],
    etiqueta: 'Más pedido',
  },
  {
    id: 'llavero-nombre',
    nombre: 'Llavero con tu nombre',
    categoria: 'personalizado',
    modelo: 'llavero',
    precio: 12000,
    personalizado: true,
    dias: 4,
    corto: 'Un llavero hecho a tu medida: tú nos dices el nombre o el logo.',
    detalle:
      'Después de pagar el 50 % para empezar, te enviamos una imagen de cómo va a quedar. Tú la apruebas y lo fabricamos.',
    colores: ['verde', 'ambar', 'azul', 'negro', 'rojo'],
    etiqueta: 'A tu medida',
  },
  {
    id: 'sello-personalizado',
    nombre: 'Sello personalizado',
    categoria: 'personalizado',
    modelo: 'sello',
    precio: 24000,
    personalizado: true,
    dias: 5,
    corto: 'Tu logo o tu texto en un sello con mango cómodo.',
    detalle:
      'Ideal para tu negocio, tus empaques o tus manualidades. Nos envías el diseño y te mostramos una prueba antes de fabricarlo.',
    colores: ['negro', 'azul', 'rojo', 'verde'],
    etiqueta: 'A tu medida',
  },
  {
    id: 'tarjeta-3d',
    nombre: 'Tarjeta de presentación 3D',
    categoria: 'personalizado',
    modelo: 'tarjeta',
    precio: 9000,
    personalizado: true,
    dias: 5,
    corto: 'Una tarjeta con relieve que la gente no se olvida de tocar.',
    detalle:
      'Tamaño de tarjeta normal (80 × 50 mm), con tu logo en relieve y hasta 3 colores. Se vende desde 1 unidad.',
    colores: ['negro', 'blanco', 'verde'],
    etiqueta: 'Para tu negocio',
  },
]

export const CATEGORIAS = [
  { id: 'todo', nombre: 'Todo' },
  { id: 'personalizado', nombre: 'A tu medida' },
  { id: 'oficina', nombre: 'Para el día a día' },
  { id: 'decoracion', nombre: 'Decoración' },
]

export const pesos = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
