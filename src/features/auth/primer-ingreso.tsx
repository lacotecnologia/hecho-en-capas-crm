import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
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

export const consultaPrimerIngreso = {
  queryKey: ['auth', 'primer-ingreso'],
  queryFn: () => api<{ necesario: boolean }>('/auth/primer-ingreso'),
  staleTime: Infinity,
  retry: false,
} as const

const esquema = z
  .object({
    codigo: z
      .string()
      .trim()
      .min(8, 'Escribe el código de instalación completo.'),
    nombre: z.string().trim().min(2, 'Escribe tu nombre.'),
    usuario: z
      .string()
      .trim()
      .toLowerCase()
      .regex(
        /^[a-z0-9._-]{3,30}$/,
        'De 3 a 30 letras o números, sin espacios ni tildes. Ejemplo: luis'
      ),
    pin: z.string().regex(/^\d{4,6}$/, 'El PIN tiene de 4 a 6 números.'),
    repetir: z.string(),
  })
  .refine((d) => d.pin === d.repetir, {
    path: ['repetir'],
    message: 'Los dos PIN no son iguales. Escríbelo otra vez.',
  })

type Datos = z.infer<typeof esquema>

/**
 * Se muestra en lugar de "Ingresar" solo cuando el sistema está recién
 * instalado y todavía no hay ninguna persona creada.
 */
export function PrimerIngreso() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [verPin, setVerPin] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: '',
      nombre: '',
      usuario: '',
      pin: '',
      repetir: '',
    },
  })

  const enviar = async ({ repetir: _repetir, ...datos }: Datos) => {
    setError(null)
    try {
      const respuesta = await api<{ usuario: UsuarioSesion }>(
        '/auth/primer-ingreso',
        { method: 'POST', body: datos }
      )
      queryClient.setQueryData(consultaSesion.queryKey, respuesta)
      queryClient.setQueryData(consultaPrimerIngreso.queryKey, {
        necesario: false,
      })
      navigate({ to: '/', replace: true })
    } catch (e) {
      setError(mensajeDeError(e))
    }
  }

  const enviando = form.formState.isSubmitting

  const campoPin = (
    name: 'pin' | 'repetir',
    etiqueta: string,
    ayuda: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{etiqueta}</FormLabel>
          <div className='relative'>
            <FormControl>
              <Input
                type={verPin ? 'text' : 'password'}
                inputMode='numeric'
                autoComplete='new-password'
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
          <FormDescription>{ayuda}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-xl'>Bienvenido: crea tu cuenta</CardTitle>
        <CardDescription>
          El sistema está recién instalado. Crea la cuenta del administrador;
          después, desde Personas, creas las cuentas de tu familia.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(enviar)} className='grid gap-5'>
            <FormField
              control={form.control}
              name='codigo'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código de instalación</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='XXXX-XXXX-XXXX'
                      autoComplete='off'
                      autoCapitalize='characters'
                      autoCorrect='off'
                      spellCheck={false}
                      autoFocus
                      className='h-12 text-center font-mono text-lg tracking-widest uppercase'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Te lo dio quien instaló el sistema. Solo se usa esta vez.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='nombre'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tu nombre</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='Ejemplo: Luis'
                      autoComplete='name'
                      className='h-12 text-base'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Así te verán los demás.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      className='h-12 text-base'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Con esto entras. En minúsculas y sin espacios.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {campoPin('pin', 'PIN', 'De 4 a 6 números que solo tú sepas.')}
            {campoPin(
              'repetir',
              'Repite el PIN',
              'Para estar seguros de que quedó bien.'
            )}

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
              {enviando ? (
                <Loader2 className='animate-spin' />
              ) : (
                <ShieldCheck />
              )}
              {enviando ? 'Creando…' : 'Crear mi cuenta y entrar'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
