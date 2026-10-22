import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { AvisoPruebaIngreso } from '@/demo/aviso-prueba'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { api, mensajeDeError } from '@/lib/api'
import { consultaSesion, type UsuarioSesion } from '@/lib/sesion'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { AuthLayout } from './auth-layout'

const esquema = z.object({
  usuario: z.string().trim().min(1, 'Escribe tu usuario.'),
  pin: z
    .string()
    .regex(
      /^\d{4,6}$/,
      'El PIN tiene de 4 a 6 números, sin letras ni espacios.'
    ),
})

type Datos = z.infer<typeof esquema>

export function Ingresar() {
  const { redirect } = useSearch({ from: '/(auth)/ingresar' })
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [verPin, setVerPin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: { usuario: '', pin: '' },
  })

  const enviar = async (datos: Datos) => {
    setError(null)
    try {
      const respuesta = await api<{ usuario: UsuarioSesion }>(
        '/auth/ingresar',
        {
          method: 'POST',
          body: datos,
        }
      )
      queryClient.setQueryData(consultaSesion.queryKey, respuesta)
      const destino =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//')
          ? redirect
          : '/'
      navigate({ to: destino, replace: true })
    } catch (e) {
      setError(mensajeDeError(e))
      form.setValue('pin', '')
      form.setFocus('pin')
    }
  }

  const enviando = form.formState.isSubmitting

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle className='text-xl'>Ingresar</CardTitle>
          <CardDescription>
            Escribe tu usuario y tu PIN. Si no los tienes, pídeselos al
            administrador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(enviar)} className='grid gap-5'>
              <FormField
                control={form.control}
                name='usuario'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Ejemplo: luis'
                        autoComplete='username'
                        autoCapitalize='none'
                        autoCorrect='off'
                        spellCheck={false}
                        autoFocus
                        className='h-12 text-base'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='pin'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PIN</FormLabel>
                    <div className='relative'>
                      <FormControl>
                        <Input
                          type={verPin ? 'text' : 'password'}
                          inputMode='numeric'
                          autoComplete='current-password'
                          maxLength={6}
                          placeholder='••••'
                          className='h-12 pe-12 text-center text-2xl tracking-[0.5em]'
                          {...field}
                          onChange={(e) =>
                            field.onChange(e.target.value.replace(/\D/g, ''))
                          }
                        />
                      </FormControl>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='absolute inset-e-1 top-1/2 -translate-y-1/2'
                        onClick={() => setVerPin((v) => !v)}
                        aria-label={verPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                      >
                        {verPin ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                    <FormDescription>De 4 a 6 números.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && (
                <Alert variant='destructive' role='alert'>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type='submit'
                size='lg'
                className='h-12 text-base'
                disabled={enviando}
              >
                {enviando ? <Loader2 className='animate-spin' /> : <LogIn />}
                {enviando ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <AvisoPruebaIngreso
        onElegir={(usuario, pin) => {
          form.setValue('usuario', usuario)
          form.setValue('pin', pin)
          setError(null)
        }}
      />
      <p className='text-center text-sm text-muted-foreground'>
        ¿Eres cliente?{' '}
        <Link to='/seguimiento' className='font-medium text-primary underline'>
          Mira en qué va tu pedido
        </Link>
      </p>
    </AuthLayout>
  )
}
