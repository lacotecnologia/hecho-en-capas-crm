import { useNavigate } from '@tanstack/react-router'
import {
  ClipboardList,
  FileText,
  GraduationCap,
  HandCoins,
  HelpCircle,
  Home,
  Send,
  Truck,
} from 'lucide-react'
import { tieneRol, useSesion } from '@/lib/sesion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Pagina } from '@/components/layout/pagina'

type Paso = {
  titulo: string
  texto: React.ReactNode
  foto?: string
  alt?: string
}

type Seccion = {
  id: string
  titulo: string
  icono: typeof Home
  intro: string
  pasos: Paso[]
}

const foto = (n: string) => `${import.meta.env.BASE_URL}manual/${n}.jpg`

const SECCIONES: Seccion[] = [
  {
    id: 'empezar',
    titulo: 'Antes de empezar',
    icono: Home,
    intro: 'Lo básico para moverte por el sistema.',
    pasos: [
      {
        titulo: 'Entra con tu usuario y tu PIN',
        texto:
          'El administrador te da tu usuario y un PIN de 4 a 6 números. Si te equivocas 5 veces, la cuenta se bloquea 15 minutos. Si olvidaste el PIN, pídele al administrador uno nuevo.',
      },
      {
        titulo: 'Tu Inicio',
        texto:
          'Es lo primero que ves. Arriba están tus pendientes del día: cotizaciones por vencer, anticipos por cobrar, pedidos que van tarde. Toca cualquiera para ir directo. Abajo están los accesos a todo.',
        foto: '01-inicio',
        alt: 'Pantalla de Inicio con los pendientes del día',
      },
      {
        titulo: 'El menú y el buscador',
        texto:
          'En el computador el menú está a la izquierda; en el celular, en el botón de arriba a la izquierda. Con “Buscar…” encuentras cualquier pantalla escribiendo su nombre.',
      },
    ],
  },
  {
    id: 'cotizar',
    titulo: '1. Hacer una cotización',
    icono: FileText,
    intro:
      'Todo lo que vendes empieza en Cotizar. El resumen con el total, tu ganancia y la hora de entrega se actualiza mientras escribes.',
    pasos: [
      {
        titulo: 'Toca “Nueva cotización”',
        texto:
          'En Cotizar ves todas tus cotizaciones con su estado. Arriba a la derecha está el botón para empezar una nueva.',
        foto: '02-cotizar',
        alt: 'Lista de cotizaciones con el botón Nueva cotización',
      },
      {
        titulo: 'Escoge el cliente',
        texto:
          'Búscalo por nombre, WhatsApp o documento. Si es nuevo, toca “Crear cliente nuevo” y llena sus datos ahí mismo.',
        foto: '03-cliente',
        alt: 'Buscador de clientes',
      },
      {
        titulo: 'Agrega los productos',
        texto:
          'Toca “Agregar producto”. Solo salen los productos que el taller dejó listos para vender. En cada uno ves cuántos hay listos de cada color, cuánto tarda en imprimirse cada unidad, si solo va en la impresora multicolor y si acepta nombre. ¿No está lo que pide el cliente? Usa “Pedir un personalizado” y el taller lo diseña y le pone precio.',
        foto: '04-buscador',
        alt: 'Buscador de productos con existencias por color y tiempo de impresión',
      },
      {
        titulo: 'Color, cantidad y precio',
        texto: (
          <>
            Escoge el color (debajo de cada uno dice cuántos hay listos).
            Escribe la cantidad: la etiqueta de arriba te dice si sale de lo que
            ya está impreso o si hay que imprimir, y cuándo queda listo. Si no
            alcanzan, se usan los que hay y se imprime solo lo que falta.
            <br />
            <br />
            El precio va desde el <strong>precio de fábrica</strong> hasta el{' '}
            <strong>máximo</strong> (25 % más), en valores redondos a mil. Lo
            que subas es <strong>tu ganancia</strong>: la ves en cada producto y
            en el resumen. Tu ganancia nunca sale en el PDF.
          </>
        ),
        foto: '05-producto',
        alt: 'Producto con color, cantidad, precio y ganancia',
      },
      {
        titulo: 'Con el nombre del cliente',
        texto:
          'Si el producto lo permite, prende “Lleva nombre o texto” y escribe un nombre por renglón: cada nombre es una unidad. Se suma el precio de personalizar, siempre se imprime (no sale de lo que hay listo) y pide anticipo. Revisa que no pase del máximo de letras.',
        foto: '06-nombres',
        alt: 'Campo de nombres, uno por renglón',
      },
      {
        titulo: 'Cargos y descuento',
        texto:
          'Agrega envío, diseño adicional o urgencia como cargos. El descuento sale de tu ganancia: nunca puede ser mayor que ella.',
      },
      {
        titulo: 'Escoge cómo se entrega',
        texto:
          'Domicilio, recoge en el taller o transportadora. Cada opción te muestra a qué hora se entregaría. Escoge la que pidió el cliente.',
        foto: '07-forma-entrega',
        alt: 'Formas de entrega con su hora',
      },
      {
        titulo: '“Cuándo se entrega”: la hora que puedes prometer',
        texto: (
          <>
            Sale del taller real: lo que hay listo, lo que se está imprimiendo,
            el horario y las reglas de entrega. Por ejemplo: un pedido con todo
            listo antes de las 11:35 a. m. sale el mismo día (máximo 4 horas
            después); si queda listo más tarde, sale al día siguiente.
            <br />
            <br />
            Fíjate en la línea naranja:{' '}
            <strong>“Vale si confirma antes de las…”</strong>. Si el cliente se
            demora, la hora cambia. Toca <strong>“¿Por qué esta hora?”</strong>{' '}
            para ver el detalle y explicárselo al cliente.
          </>
        ),
        foto: '08-cuando-se-entrega',
        alt: 'Tarjeta Cuándo se entrega con el detalle de la hora',
      },
    ],
  },
  {
    id: 'enviar',
    titulo: '2. Enviarla y que el cliente responda',
    icono: Send,
    intro: 'Cuando la cotización está lista, se la mandas al cliente.',
    pasos: [
      {
        titulo: 'Toca “Ver PDF y enviar”',
        texto:
          'Se guarda la cotización y se arma el PDF con tu nombre, los productos, el total, el anticipo y la fecha de entrega. Descárgalo o compártelo por WhatsApp.',
        foto: '09-pdf',
        alt: 'Vista del PDF de la cotización',
      },
      {
        titulo: 'Marca “Ya se la envié al cliente”',
        texto:
          'Desde ese momento corren los 10 días que dura la cotización y ya no se puede cambiar. Si hay que cambiar algo, usa “Hacer cambios”: se crea una versión nueva con los precios de hoy.',
      },
      {
        titulo: 'Anota lo que respondió',
        texto:
          'Cuando el cliente conteste, toca “El cliente aceptó” o “El cliente no aceptó”. Si no aceptó, escribe el motivo: ayuda a mejorar. Las cotizaciones por vencer te salen en Inicio para que llames al cliente.',
        foto: '10-respuesta',
        alt: 'Botones para marcar la respuesta del cliente',
      },
    ],
  },
  {
    id: 'pedido',
    titulo: '3. Pedido y anticipo',
    icono: ClipboardList,
    intro: 'Cuando el cliente dice que sí, la cotización se vuelve pedido.',
    pasos: [
      {
        titulo: 'Toca “Convertir en pedido”',
        texto:
          'Lo que ya está impreso se aparta para este cliente y lo demás pasa a la cola del taller. Si la cola cambió desde la cotización y la hora de entrega quedó más tarde, el sistema te avisa con la hora nueva: díselo al cliente antes de confirmar.',
        foto: '11-convertir',
        alt: 'Ventana para convertir la cotización en pedido',
      },
      {
        titulo: 'Cobra el anticipo',
        texto:
          'Lo personalizado no se empieza a imprimir hasta que llegue el anticipo (50 %). Cuando el cliente pague, toca “Cobrar anticipo”.',
        foto: '12-falta-anticipo',
        alt: 'Aviso de anticipo pendiente',
      },
      {
        titulo: 'Anota cada pago',
        texto:
          'Escribe cuánto pagó, escoge cómo (efectivo, Nequi, Daviplata, transferencia o datáfono) y, si quieres, la referencia o la foto del comprobante. En Cobros ves todo lo que falta por cobrar de tus pedidos, con un botón para recordarle al cliente por WhatsApp.',
        foto: '13-cobrar',
        alt: 'Formulario para registrar un pago',
      },
    ],
  },
  {
    id: 'seguimiento',
    titulo: '4. Seguimiento y entrega',
    icono: Truck,
    intro:
      'Después de crear el pedido, el taller lo fabrica y tú lo acompañas.',
    pasos: [
      {
        titulo: 'La fecha prometida',
        texto:
          'En el pedido queda la fecha y hora que le prometiste al cliente. Si el pedido va tarde, te sale un aviso en Inicio para que le avises a tiempo.',
        foto: '14-fecha',
        alt: 'Fecha prometida del pedido',
      },
      {
        titulo: 'Mándale el enlace al cliente',
        texto:
          'Con “Enviar por WhatsApp” el cliente recibe un enlace donde ve en qué va su pedido y cuánto le falta pagar, sin tener que preguntarte. No ve costos ni notas internas.',
        foto: '14-enlace',
        alt: 'Código y botones del enlace de seguimiento',
      },
      {
        titulo: 'La cola del taller',
        texto:
          'En Cola de impresión ves qué se está imprimiendo y qué sigue, con la hora en que cada cosa debe estar lista. Lo que va tarde sale en rojo. Tú solo la consultas: el taller es quien la mueve.',
        foto: '15-cola',
        alt: 'Cola de impresión del taller',
      },
      {
        titulo: 'La entrega',
        texto:
          'Cuando el pedido está listo, en Entregas se programa el domicilio, se deja para recoger o se manda por transportadora. Un pedido no sale si falta plata por cobrar, salvo que se marque “cobrar al entregar”.',
      },
    ],
  },
  {
    id: 'comisiones',
    titulo: '5. Tus comisiones',
    icono: HandCoins,
    intro:
      'Tu comisión es la ganancia de cada pedido (lo que subiste sobre el precio de fábrica, menos el descuento).',
    pasos: [
      {
        titulo: 'Por ganar, por cobrar y pagos',
        texto:
          '“Por ganar” es tu ganancia en pedidos que van en camino. Pasa a “Por cobrar” cuando el pedido queda Cerrado (entregado y pagado completo). El administrador te paga lo acumulado cuando decide, y cada pago queda en tu historial con su comprobante. Si después hay que devolverle plata al cliente, se descuenta de tus próximas comisiones.',
        foto: '16-comisiones',
        alt: 'Pantalla Mis comisiones',
      },
    ],
  },
]

const PREGUNTAS: { p: string; r: string }[] = [
  {
    p: '¿Puedo vender por debajo del precio de fábrica?',
    r: 'No. El precio de fábrica es lo mínimo; tu ganancia es lo que subas sobre él, hasta el máximo.',
  },
  {
    p: 'El cliente quiere un color que no aparece.',
    r: 'Solo se venden los colores que el taller aprobó para ese producto. Pregúntale al taller si se puede agregar.',
  },
  {
    p: '¿Por qué cambió la hora de entrega?',
    r: 'Porque la cola del taller cambia: entran otros pedidos o se termina algo. La hora vale si el cliente confirma pronto; al crear el pedido se vuelve a calcular.',
  },
  {
    p: 'Ya envié la cotización y me equivoqué.',
    r: 'Ábrela y toca “Hacer cambios”: se crea una versión nueva. Mándale la nueva al cliente.',
  },
  {
    p: 'El cliente pide algo que no está en el catálogo.',
    r: 'En la cotización toca “¿No está en el catálogo? Pedir un personalizado”. El taller lo diseña, le pone precio y te aparece para agregarlo.',
  },
  {
    p: 'Olvidé mi PIN o me bloqueé.',
    r: 'Pídele al administrador que te ponga un PIN nuevo o te desbloquee.',
  },
]

export function Manual() {
  const navigate = useNavigate()
  const usuario = useSesion()
  const comercial = tieneRol(usuario, ['comercial'])
  return (
    <Pagina
      titulo='Manual del comercial'
      descripcion='El proceso completo, paso a paso: de la cotización a tu comisión.'
    >
      <div className='grid gap-6 lg:grid-cols-[220px_1fr]'>
        <nav
          aria-label='Partes del manual'
          className='grid content-start gap-1 lg:sticky lg:top-20'
        >
          {SECCIONES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className='flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent'
            >
              <s.icono className='size-4 text-primary' />
              {s.titulo}
            </a>
          ))}
          <a
            href='#preguntas'
            className='flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent'
          >
            <HelpCircle className='size-4 text-primary' />
            Preguntas frecuentes
          </a>
          {comercial && (
            <Button
              variant='outline'
              className='mt-2 justify-start'
              onClick={() => navigate({ to: '/bienvenida' })}
            >
              <GraduationCap /> Repetir la práctica
            </Button>
          )}
        </nav>

        <div className='grid min-w-0 gap-8'>
          {SECCIONES.map((s) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-titulo`}
              className='grid scroll-mt-20 gap-4'
            >
              <div className='flex items-start gap-3'>
                <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  <s.icono className='size-5' />
                </span>
                <div>
                  <h2 id={`${s.id}-titulo`} className='text-xl font-bold'>
                    {s.titulo}
                  </h2>
                  <p className='text-muted-foreground'>{s.intro}</p>
                </div>
              </div>
              <ol className='grid gap-4'>
                {s.pasos.map((p, i) => (
                  <li key={p.titulo}>
                    <Card className='py-4'>
                      <CardContent className='grid gap-3 px-4 sm:px-6'>
                        <h3 className='flex items-start gap-3 text-base font-semibold'>
                          <span className='flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground'>
                            {i + 1}
                          </span>
                          <span className='pt-0.5'>{p.titulo}</span>
                        </h3>
                        <p className='text-sm leading-relaxed sm:ps-10'>
                          {p.texto}
                        </p>
                        {p.foto && (
                          <img
                            src={foto(p.foto)}
                            alt={p.alt ?? ''}
                            loading='lazy'
                            className='max-h-[480px] justify-self-start rounded-lg border object-contain object-left sm:ms-10'
                          />
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          ))}

          <section id='preguntas' className='grid scroll-mt-20 gap-4'>
            <div className='flex items-start gap-3'>
              <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                <HelpCircle className='size-5' />
              </span>
              <h2 className='pt-1.5 text-xl font-bold'>Preguntas frecuentes</h2>
            </div>
            <Card className='py-2'>
              <CardContent className='divide-y px-4 sm:px-6'>
                {PREGUNTAS.map((q) => (
                  <details key={q.p} className='group py-3'>
                    <summary className='cursor-pointer font-medium'>
                      {q.p}
                    </summary>
                    <p className='mt-2 text-sm text-muted-foreground'>{q.r}</p>
                  </details>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </Pagina>
  )
}
