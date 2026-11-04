import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  ClipboardList,
  FileText,
  HandCoins,
  Loader2,
  LogOut,
  Play,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { Logo } from '@/assets/logo'
import { api } from '@/lib/api'
import { empezarPractica } from '@/lib/practica'
import { consultaSesion } from '@/lib/sesion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const PARTES = [
  {
    icono: FileText,
    titulo: 'Hacer una cotización',
    texto:
      'Escoger el cliente, los productos, el color, el precio y ver cuándo se entrega.',
  },
  {
    icono: ClipboardList,
    titulo: 'Enviarla y que el cliente acepte',
    texto: 'Ver el PDF, mandárselo y marcar cuando dice que sí.',
  },
  {
    icono: Wallet,
    titulo: 'Pedido y anticipo',
    texto: 'Volverla pedido y cobrar el anticipo de lo personalizado.',
  },
  {
    icono: HandCoins,
    titulo: 'Seguimiento y comisiones',
    texto: 'El enlace para el cliente, la cola del taller y tu ganancia.',
  },
]

/** Primera vez del comercial: explica la práctica y la arranca. */
export function Bienvenida() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data } = useQuery(consultaSesion)
  const [empezando, setEmpezando] = useState(false)
  const usuario = data?.usuario
  if (!usuario) return null
  const pendiente = !!usuario.recorridoPendiente
  const nombre = usuario.nombre.split(' ')[0]

  const empezar = async () => {
    setEmpezando(true)
    await empezarPractica(usuario, !pendiente)
    // Lo que había en pantalla era del sistema real: se olvida
    queryClient.removeQueries({
      predicate: (q) => q.queryKey[0] !== 'sesion',
    })
    navigate({ to: '/', replace: true })
  }

  const salir = async () => {
    await api('/auth/salir', { method: 'POST' }).catch(() => undefined)
    queryClient.clear()
    navigate({ to: '/ingresar', replace: true })
  }

  return (
    <div className='flex min-h-svh items-start justify-center bg-muted/40 px-4 py-10 sm:items-center'>
      <div className='grid w-full max-w-xl gap-6'>
        <div className='flex justify-center'>
          <Logo tamano='lg' />
        </div>
        <Card>
          <CardContent className='grid gap-5'>
            <div className='grid gap-2'>
              <h1 className='text-2xl font-bold tracking-tight'>
                ¡Hola, {nombre}!
              </h1>
              <p className='text-muted-foreground'>
                {pendiente
                  ? 'Antes de empezar a vender, vamos a practicar juntos el proceso completo, paso a paso. Toma unos 10 minutos.'
                  : 'Puedes repetir la práctica cuando quieras. Es el mismo recorrido de la primera vez.'}
              </p>
            </div>
            <ul className='grid gap-3'>
              {PARTES.map((p, i) => (
                <li key={p.titulo} className='flex gap-3'>
                  <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'>
                    <p.icono className='size-5' />
                  </span>
                  <span>
                    <span className='block font-medium'>
                      {i + 1}. {p.titulo}
                    </span>
                    <span className='text-sm text-muted-foreground'>
                      {p.texto}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className='flex gap-2 rounded-lg bg-marca-amarillo/20 p-3 text-sm'>
              <ShieldCheck className='mt-0.5 size-4 shrink-0 text-marca-naranja' />
              <span>
                <strong>Nada de lo que hagas en la práctica es real:</strong>{' '}
                los clientes y productos son de ejemplo, y no le llega nada al
                taller ni a ningún cliente. Equivócate tranquilo.
              </span>
            </p>
            <Button
              size='lg'
              className='h-12 text-base'
              disabled={empezando}
              onClick={empezar}
            >
              {empezando ? <Loader2 className='animate-spin' /> : <Play />}
              Empezar la práctica
            </Button>
            {pendiente ? (
              <Button
                variant='ghost'
                className='justify-self-center text-muted-foreground'
                onClick={salir}
              >
                <LogOut /> Ahora no: salir del sistema
              </Button>
            ) : (
              <Button
                variant='ghost'
                className='justify-self-center text-muted-foreground'
                onClick={() => navigate({ to: '/' })}
              >
                Volver a Inicio
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
