import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { estadoEnvio } from '@shared/cuenta-cobro'
import { FileSignature, FileText, Settings } from 'lucide-react'
import { mensajeDeError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { consultaCuentasPedido } from './api'
import { fechaCuenta } from './fechas'
import { EstadoCuentaBadge, PasosEnvio } from './estado'
import { HacerCuenta } from './hacer'
import { VistaCuenta } from './vista'

/** En la ficha del pedido (solo admin): hacer, ver y enviar la cuenta de cobro. */
export function TarjetaCuentaCobro({
  pedido,
}: {
  pedido: { id: number; codigo: string }
}) {
  const { data, isLoading, isError, error } = useQuery(
    consultaCuentasPedido(pedido.id)
  )
  const [haciendo, setHaciendo] = useState(false)
  const [viendo, setViendo] = useState<number | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-lg'>
          <FileSignature className='size-5 text-primary' /> Cuenta de cobro
        </CardTitle>
        {!data?.vigente && (
          <CardDescription>
            Para clientes que la piden (casi siempre empresas). Sale con los
            productos y el total del pedido.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className='grid gap-3 text-sm'>
        {isLoading && <Skeleton className='h-20 w-full' />}
        {isError && (
          <p className='text-destructive'>{mensajeDeError(error)}</p>
        )}
        {data?.vigente && (
          <>
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <span>
                <strong className='text-base'>{data.vigente.codigo}</strong>
                <span className='block text-xs text-muted-foreground'>
                  {fechaCuenta(data.vigente.fecha)} · a nombre de{' '}
                  {data.vigente.pagador.nombre}
                </span>
              </span>
              <EstadoCuentaBadge
                estado='vigente'
                envio={estadoEnvio(data.vigente)}
              />
            </div>
            <PasosEnvio {...data.vigente} angosto />
            <Button onClick={() => setViendo(data.vigente!.id)}>
              <FileText />
              {data.vigente.enviadaEn ? 'Ver cuenta de cobro' : 'Ver y enviar'}
            </Button>
          </>
        )}
        {data && !data.vigente && data.bloqueo && (
          <div className='grid gap-2 rounded-lg bg-marca-ambar/15 p-3'>
            <p>{data.bloqueo}</p>
            {data.bloqueo.includes('Configuración') && (
              <Button variant='outline' size='sm' asChild className='justify-self-start'>
                <Link to='/configuracion' search={{ pestana: 'cuenta-cobro' }}>
                  <Settings /> Llenar mis datos
                </Link>
              </Button>
            )}
          </div>
        )}
        {data && !data.vigente && !data.bloqueo && (
          <Button variant='outline' onClick={() => setHaciendo(true)}>
            <FileSignature /> Hacer cuenta de cobro
          </Button>
        )}
        {data && data.anuladas.length > 0 && (
          <ul className='grid gap-1 border-t pt-2 text-xs text-muted-foreground'>
            {data.anuladas.map((a) => (
              <li key={a.id}>
                <button
                  type='button'
                  className='underline-offset-2 hover:underline'
                  onClick={() => setViendo(a.id)}
                >
                  {a.codigo} · anulada
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {data && (
        <HacerCuenta
          abierto={haciendo}
          pedido={pedido}
          datos={data}
          onCerrar={() => setHaciendo(false)}
          onHecha={(c) => {
            setHaciendo(false)
            setViendo(c.id)
          }}
        />
      )}
      <VistaCuenta id={viendo} onCerrar={() => setViendo(null)} />
    </Card>
  )
}
