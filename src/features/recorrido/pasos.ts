/**
 * Pasos del recorrido de práctica del comercial. Cada paso señala un
 * elemento de la pantalla (data-tour) y, si pide hacer algo, espera a que
 * la pantalla muestre que ya se hizo.
 */

export type Paso = {
  /** Parte del proceso (1 a 4). */
  parte: number
  titulo: string
  texto: string
  /** Lo que tiene que hacer la persona; sin esto, avanza con "Siguiente". */
  hazlo?: string
  /** Elemento a resaltar: valor de data-tour. */
  objetivo?: string
  /** Pantalla a la que se lleva al empezar el paso. */
  ir?: '/' | '/cotizar' | '/cola' | '/comisiones'
  /** Pantalla donde vive el paso (si se sale, se le ofrece volver). */
  donde?: RegExp
  /** La pantalla ya muestra que lo hizo. */
  listo?: () => boolean
}

export const PARTES = [
  'Hacer una cotización',
  'Enviarla y que el cliente acepte',
  'Pedido y anticipo',
  'Seguimiento y comisiones',
]

const hay = (selector: string) => document.querySelector(selector) !== null
const texto = (selector: string) =>
  document.querySelector(selector)?.textContent ?? ''
const ruta = () => window.location.pathname
const EDITOR = /^\/cotizar\/(nueva|\d+)$/
const PEDIDO = /^\/pedidos\/\d+$/

export const PASOS: Paso[] = [
  {
    parte: 1,
    titulo: 'Este es tu Inicio',
    texto:
      'Cada día empieza aquí: arriba ves tus pendientes (cotizaciones por vencer, anticipos por cobrar, pedidos que van tarde) y abajo los accesos a todo. Ahora vamos a hacer una cotización de práctica.',
    ir: '/',
  },
  {
    parte: 1,
    titulo: 'Empieza una cotización',
    texto: 'Todo lo que vendes empieza en Cotizar.',
    hazlo: 'Toca “Nueva cotización”.',
    ir: '/cotizar',
    objetivo: 'nueva-cotizacion',
    listo: () => EDITOR.test(ruta()),
  },
  {
    parte: 1,
    titulo: '¿Para quién es?',
    texto:
      'Busca al cliente por nombre o WhatsApp. Si es nuevo, lo creas aquí mismo con “Crear cliente nuevo”.',
    hazlo: 'Toca uno de los clientes de la lista.',
    objetivo: 'cliente',
    donde: EDITOR,
    listo: () => hay('[data-tour=cliente-elegido]'),
  },
  {
    parte: 1,
    titulo: 'Agrega un producto',
    texto:
      'El buscador muestra solo lo que el taller dejó listo para vender, con cuántos hay listos de cada color y cuánto tarda en imprimirse.',
    hazlo: 'Toca “Agregar producto” y escoge el “Llavero con logo”.',
    objetivo: 'agregar-producto',
    donde: EDITOR,
    listo: () => hay('[data-tour=linea]'),
  },
  {
    parte: 1,
    titulo: 'Escoge el color',
    texto:
      'Debajo de cada color ves cuántos hay listos. Si dice “Se imprime”, no hay y toca fabricarlos. El precio es el mismo en cualquier color.',
    hazlo: 'Toca un color.',
    objetivo: 'linea',
    donde: EDITOR,
    listo: () => hay('[data-tour=linea]') && !hay('[data-tour=falta-color]'),
  },
  {
    parte: 1,
    titulo: '¿Hay listos?',
    texto:
      'Esta etiqueta te dice si sale de lo que ya está impreso o si hay que imprimir, y cuándo queda listo. La calcula con la cola real del taller.',
    objetivo: 'disponibilidad',
    donde: EDITOR,
  },
  {
    parte: 1,
    titulo: 'Prueba con muchos',
    texto:
      'Cuando no alcanzan, se usan los que hay y se imprime solo lo que falta. Mira cómo cambia la etiqueta y la hora de entrega.',
    hazlo: 'Escribe 20 en “Cantidad”.',
    objetivo: 'linea',
    donde: EDITOR,
    listo: () => /faltan|se imprim/.test(texto('[data-tour=disponibilidad]')),
  },
  {
    parte: 1,
    titulo: 'Precio y tu ganancia',
    texto:
      'Puedes cobrar desde el precio de fábrica hasta el máximo, en valores redondos a mil. Lo que subas es tu ganancia: la ves en cada producto y en el resumen. Esa ganancia no sale en el PDF.',
    objetivo: 'linea',
    donde: EDITOR,
  },
  {
    parte: 1,
    titulo: 'Con el nombre del cliente',
    texto:
      'Algunos productos se pueden pedir con un nombre o texto. Cada nombre es una unidad, se suma el precio de personalizar, siempre se imprime y pide anticipo.',
    hazlo:
      'Prende “Lleva nombre o texto” y escribe dos nombres, uno por renglón.',
    objetivo: 'nombres',
    donde: EDITOR,
    listo: () => {
      const t = document.querySelector<HTMLTextAreaElement>(
        '[data-tour=nombres] textarea'
      )
      return (t?.value.split('\n').filter((x) => x.trim()).length ?? 0) >= 2
    },
  },
  {
    parte: 1,
    titulo: '¿Cómo se entrega?',
    texto:
      'Domicilio, recoge en el taller o transportadora. Cada opción te muestra a qué hora se entregaría. Escoge la que pidió el cliente.',
    objetivo: 'entrega',
    donde: EDITOR,
  },
  {
    parte: 1,
    titulo: 'Cuándo se entrega',
    texto:
      'Esta es la hora que le puedes prometer al cliente si confirma ahora. Sale del taller real: lo que hay listo, lo que se está imprimiendo, el horario y las reglas de entrega.',
    hazlo: 'Toca “¿Por qué esta hora?” para ver de dónde sale.',
    objetivo: 'cuando',
    donde: EDITOR,
    listo: () => hay('[data-tour=cuando] ol'),
  },
  {
    parte: 2,
    titulo: 'Mira el PDF',
    texto:
      'Con un solo botón se guarda la cotización y se arma el PDF con tu nombre, los precios, el anticipo y la fecha de entrega.',
    hazlo: 'Toca “Ver PDF y enviar”.',
    objetivo: 'ver-pdf',
    donde: EDITOR,
    listo: () => hay('[data-tour=ya-envie]'),
  },
  {
    parte: 2,
    titulo: 'Mándaselo al cliente',
    texto:
      'Descárgalo o compártelo por WhatsApp. Cuando ya se lo mandaste, márcalo: desde ahí corren los 10 días que dura la cotización y no se puede cambiar (si hay que cambiar algo, se hace una versión nueva).',
    hazlo: 'Toca “Ya se la envié al cliente”.',
    objetivo: 'ya-envie',
    listo: () => hay('[data-tour=aprobar]'),
  },
  {
    parte: 2,
    titulo: 'El cliente dijo que sí',
    texto:
      'Cuando el cliente responda, marca si aceptó o no. Si no aceptó, te pide el motivo: eso ayuda a mejorar. Imagina que este cliente aceptó.',
    hazlo: 'Toca “El cliente aceptó”.',
    objetivo: 'aprobar',
    listo: () => hay('[data-tour=convertir]'),
  },
  {
    parte: 3,
    titulo: 'Vuélvela pedido',
    texto:
      'Al convertirla, lo que ya está impreso se aparta para este cliente y lo demás pasa a la cola del taller. Si la cola cambió y la hora de entrega quedó más tarde, el sistema te avisa para que le cuentes al cliente.',
    hazlo: 'Toca “Convertir en pedido” y confirma.',
    objetivo: 'convertir',
    listo: () => PEDIDO.test(ruta()),
  },
  {
    parte: 3,
    titulo: 'Cobra el anticipo',
    texto:
      'Lo personalizado no se empieza a imprimir hasta que llegue el anticipo. Cuando el cliente pague, lo anotas aquí con la forma de pago y, si quieres, la foto del comprobante.',
    hazlo: 'Toca “Cobrar anticipo”, escoge cómo pagó y guarda.',
    objetivo: 'cobrar',
    donde: PEDIDO,
    // Al llegar el anticipo, el pedido ya tiene fecha prometida
    listo: () =>
      PEDIDO.test(ruta()) &&
      hay('[data-tour=fecha-prometida]') &&
      !/cuando llegue el anticipo/.test(texto('[data-tour=fecha-prometida]')),
  },
  {
    parte: 4,
    titulo: 'La fecha prometida',
    texto:
      'Aquí queda la fecha y hora que le prometiste al cliente. Si el pedido va tarde, te sale un aviso en Inicio para que le avises a tiempo.',
    objetivo: 'fecha-prometida',
    donde: PEDIDO,
  },
  {
    parte: 4,
    titulo: 'El enlace para el cliente',
    texto:
      'Con “Enviar por WhatsApp” le mandas al cliente este enlace: ve en qué va su pedido y cuánto le falta pagar, sin tener que preguntarte. No ve costos ni notas internas.',
    objetivo: 'seguimiento',
    donde: PEDIDO,
  },
  {
    parte: 4,
    titulo: 'La cola del taller',
    texto:
      'Aquí ves qué se está imprimiendo y qué sigue. Lo primero de la cola es lo que hay que entregar antes. Si algo va tarde para la hora prometida, sale en rojo.',
    ir: '/cola',
    objetivo: 'tablero',
  },
  {
    parte: 4,
    titulo: 'Tus comisiones',
    texto:
      '“Por ganar” es tu ganancia en pedidos que van en camino. Pasa a “Por cobrar” cuando el pedido queda Cerrado (entregado y pagado), y el administrador te la paga. Aquí también ves cada pago que recibes.',
    ir: '/comisiones',
    objetivo: 'mis-cifras',
  },
  {
    parte: 4,
    titulo: '¡Lo lograste!',
    texto:
      'Ya conoces el proceso completo. Si se te olvida algo, el Manual está en el menú, con cada paso explicado. Al terminar, todo lo de la práctica se borra y entras al sistema real.',
  },
]
