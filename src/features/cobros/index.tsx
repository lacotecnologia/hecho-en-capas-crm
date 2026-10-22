import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  type EstadoPago,
  ESTADOS_PAGO_INFO,
  type PedidoPorCobrar,
} from '@shared/entregas'
import {
  ESTADOS_PEDIDO_INFO,
  type EstadoPedido,
  METODOS_PAGO_INFO,
  type MetodoPago,
  TIPOS_PAGO_INFO,
  type TipoPago,
} from '@shared/pedidos'
import { CircleDollarSign, Image, MessageCircle, Wallet } from 'lucide-react'
import { tieneRol, useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { consultaCobros } from '@/features/entregas/api'
import { enlaceWhatsapp } from '@/features/entregas/entrega'
import { formatoDiaHora } from '@/features/pedidos/fechas'
import { formatoPesos } from '@/features/taller/formato'

const COLOR_PAGO: Record<EstadoPago, string> = {
  sin_pagos: 'bg-destructive/15 text-destructive',
  con_anticipo: 'bg-marca-ambar/30 text-foreground',
  con_abono: 'bg-marca-ambar/30 text-foreground',
  pagado: 'bg-primary text-primary-foreground',
  por_devolver: 'bg-marca-naranja/30 text-foreground',
}

export function EstadoPagoBadge({ estado }: { estado: EstadoPago }) {
  return (
    <Badge className={COLOR_PAGO[estado]}>{ESTADOS_PAGO_INFO[estado]}</Badge>
  )
}

function Cifra({
  titulo,
  valor,
  ayuda,
  tono,
}: {
  titulo: string
  valor: number
  ayuda: string
  tono?: 'ambar'
}) {
  return (
    <Card className={cn('gap-1 py-4', tono === 'ambar' && 'bg-marca-ambar/10')}>
      <CardContent className='px-4'>
        <p className='text-sm text-muted-foreground'>{titulo}</p>
        <p className='text-2xl font-bold tabular-nums'>{formatoPesos(valor)}</p>
        <p className='text-xs text-muted-foreground'>{ayuda}</p>
      </CardContent>
    </Card>
  )
}

function FilaPorCobrar({
  p,
  verComercial,
}: {
  p: PedidoPorCobrar
  verComercial: boolean
}) {
  const devolver = p.estadoPago === 'por_devolver'
  const recordatorio = devolver
    ? undefined
    : `Hola ${p.cliente.nombre}, te escribimos de Hecho en Capas sobre tu pedido ${p.codigo}. ${
        p.anticipoPendiente > 0
          ? `Para empezar a fabricarlo falta el anticipo de ${formatoPesos(p.anticipoPendiente)}.`
          : `Queda un saldo de ${formatoPesos(p.saldo)}.`
      } ¡Gracias!`
  return (
    <li className='flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3'>
      <Link
        to='/pedidos/$id'
        params={{ id: String(p.id) }}
        className='min-w-48 flex-1 underline-offset-2 hover:underline'
      >
        <p className='font-semibold'>{p.cliente.nombre}</p>
        <p className='text-sm text-muted-foreground'>
          {p.codigo} ·{' '}
          {ESTADOS_PEDIDO_INFO[p.estado as EstadoPedido]?.nombre ?? p.estado}
          {verComercial && ` · ${p.comercial}`}
        </p>
      </Link>
      <div className='flex flex-wrap items-center gap-2'>
        <EstadoPagoBadge estado={p.estadoPago} />
        {p.anticipoPendiente > 0 && (
          <span className='text-sm font-medium text-marca-naranja'>
            Falta el anticipo: {formatoPesos(p.anticipoPendiente)}
          </span>
        )}
        {p.contraentrega && !devolver && (
          <Badge variant='outline'>Se cobra al entregar</Badge>
        )}
      </div>
      <div className='w-36 text-end'>
        <p className='text-lg font-semibold tabular-nums'>
          {formatoPesos(devolver ? p.pagado : p.saldo)}
        </p>
        <p className='text-xs text-muted-foreground'>
          {devolver ? 'pagó y se canceló' : `de ${formatoPesos(p.total)}`}
        </p>
      </div>
      {recordatorio && p.cliente.whatsapp && (
        <a
          href={enlaceWhatsapp(p.cliente.whatsapp, recordatorio)}
          target='_blank'
          rel='noreferrer'
          className='inline-flex items-center gap-1 text-sm text-primary'
          aria-label={`Recordarle a ${p.cliente.nombre} por WhatsApp`}
        >
          <MessageCircle className='size-4' /> Recordar
        </a>
      )}
    </li>
  )
}

export function PantallaCobros() {
  const usuario = useSesion()
  const esAdmin = tieneRol(usuario, ['admin'])
  const { data, isLoading } = useQuery(consultaCobros)

  return (
    <Pagina
      titulo='Cobros'
      descripcion={
        esAdmin
          ? 'Lo que han pagado los clientes y lo que falta por cobrar.'
          : 'Lo que han pagado tus clientes y lo que falta por cobrar.'
      }
    >
      {isLoading && <Skeleton className='h-80 rounded-xl' />}
      {data && (
        <div className='grid gap-6'>
          <div className='grid gap-4 sm:grid-cols-3'>
            <Cifra
              titulo='Cobrado hoy'
              valor={data.totales.hoy}
              ayuda='Pagos registrados hoy'
            />
            <Cifra
              titulo='Cobrado este mes'
              valor={data.totales.mes}
              ayuda='Desde el día 1'
            />
            <Cifra
              titulo='Por cobrar'
              valor={data.totales.porCobrar}
              ayuda={`${data.porCobrar.length} ${data.porCobrar.length === 1 ? 'pedido' : 'pedidos'} con saldo`}
              tono='ambar'
            />
          </div>

          {data.porDevolver.length > 0 && (
            <Card className='border-marca-naranja'>
              <CardHeader>
                <CardTitle className='text-lg'>Por devolver</CardTitle>
                <CardDescription>
                  Pedidos cancelados en los que el cliente ya había pagado.
                  {esAdmin
                    ? ' Abre el pedido y usa “Devolver plata” cuando le devuelvas.'
                    : ' El administrador registra la devolución.'}
                </CardDescription>
              </CardHeader>
              <ul className='divide-y'>
                {data.porDevolver.map((p) => (
                  <FilaPorCobrar key={p.id} p={p} verComercial={esAdmin} />
                ))}
              </ul>
            </Card>
          )}

          <Card className='pb-0'>
            <CardHeader>
              <CardTitle className='text-lg'>Por cobrar</CardTitle>
              <CardDescription>
                Primero lo que ya se entregó sin pagar completo. El botón
                “Recordar” abre WhatsApp con un mensaje listo.
              </CardDescription>
            </CardHeader>
            {data.porCobrar.length === 0 ? (
              <CardContent className='grid justify-items-center gap-2 pb-8 text-center'>
                <Wallet className='size-8 text-muted-foreground' />
                <p className='font-medium'>Nadie debe nada. ¡Al día!</p>
              </CardContent>
            ) : (
              <ul className='divide-y border-t'>
                {data.porCobrar.map((p) => (
                  <FilaPorCobrar key={p.id} p={p} verComercial={esAdmin} />
                ))}
              </ul>
            )}
          </Card>

          <Card className='pb-0'>
            <CardHeader>
              <CardTitle className='text-lg'>Pagos recibidos</CardTitle>
              <CardDescription>
                Los últimos 60 días. Para registrar un pago, ábrelo desde el
                pedido.
              </CardDescription>
            </CardHeader>
            {data.pagos.length === 0 ? (
              <CardContent className='grid justify-items-center gap-2 pb-8 text-center'>
                <CircleDollarSign className='size-8 text-muted-foreground' />
                <p className='font-medium'>Todavía no hay pagos.</p>
              </CardContent>
            ) : (
              <ul className='divide-y border-t'>
                {data.pagos.map((x) => (
                  <li
                    key={x.id}
                    className='flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm'
                  >
                    <div className='min-w-48 flex-1'>
                      <Link
                        to='/pedidos/$id'
                        params={{ id: String(x.pedido.id) }}
                        className='font-medium underline-offset-2 hover:underline'
                      >
                        {x.pedido.cliente} · {x.pedido.codigo}
                      </Link>
                      <p className='text-muted-foreground'>
                        {formatoDiaHora(x.creadoEn)} · {x.usuario}
                        {x.referencia && ` · ${x.referencia}`}
                        {x.nota && ` · ${x.nota}`}
                      </p>
                    </div>
                    <span className='text-muted-foreground'>
                      {TIPOS_PAGO_INFO[x.tipo as TipoPago] ?? x.tipo} ·{' '}
                      {METODOS_PAGO_INFO[x.metodo as MetodoPago] ?? x.metodo}
                    </span>
                    {x.comprobanteUrl && (
                      <a
                        href={x.comprobanteUrl}
                        target='_blank'
                        rel='noreferrer'
                        className='inline-flex items-center gap-1 text-primary'
                      >
                        <Image className='size-4' /> Comprobante
                      </a>
                    )}
                    <span
                      className={cn(
                        'w-28 text-end text-base font-semibold tabular-nums',
                        x.monto < 0 && 'text-destructive'
                      )}
                    >
                      {x.monto < 0
                        ? `− ${formatoPesos(-x.monto)}`
                        : formatoPesos(x.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </Pagina>
  )
}
