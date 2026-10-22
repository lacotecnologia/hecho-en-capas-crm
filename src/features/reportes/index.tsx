import { useState } from 'react'
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { mesActual, moverMes, type ReporteMes } from '@shared/reportes'
import { ChevronLeft, ChevronRight, MessageCircle, Table2 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '@/lib/api'
import { tieneRol, useSesion } from '@/lib/sesion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagina } from '@/components/layout/pagina'
import { EstadoPagoBadge } from '@/features/cobros'
import { formatoFecha } from '@/features/cotizar/estado'
import { enlaceWhatsapp } from '@/features/entregas/entrega'
import { formatoPesos } from '@/features/taller/formato'

const consultaReporte = (mes: string) =>
  queryOptions({
    queryKey: ['reportes', mes],
    queryFn: () => api<ReporteMes>(`/reportes?mes=${mes}`),
    placeholderData: keepPreviousData,
  })

const nombreMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number)
  const t = new Intl.DateTimeFormat('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(a, m - 1, 15)))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** $ 572 mil, $ 1,2 M — para los ejes de la gráfica. */
const pesosCortos = (n: number) =>
  n >= 1_000_000
    ? `$ ${(n / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
    : n >= 1000
      ? `$ ${Math.round(n / 1000)} mil`
      : `$ ${n}`

function Cifra({
  titulo,
  valor,
  ayuda,
}: {
  titulo: string
  valor: string
  ayuda: string
}) {
  return (
    <Card className='gap-1 py-4'>
      <CardContent className='px-4'>
        <p className='text-sm text-muted-foreground'>{titulo}</p>
        <p className='text-2xl font-bold tabular-nums'>{valor}</p>
        <p className='text-xs text-muted-foreground'>{ayuda}</p>
      </CardContent>
    </Card>
  )
}

export function PantallaReportes() {
  const usuario = useSesion()
  const esAdmin = tieneRol(usuario, ['admin'])
  const hoy = mesActual()
  const [mes, setMes] = useState(hoy)
  const { data: r, isLoading } = useQuery(consultaReporte(mes))

  return (
    <Pagina
      titulo='Reportes'
      descripcion={
        esAdmin
          ? 'Cómo va el negocio en el mes: ventas, ganancia de cada comercial y lo que falta cobrar.'
          : 'Tus ventas del mes, tu ganancia y lo que falta por cobrar a tus clientes.'
      }
    >
      <div className='mb-5 flex items-center gap-2'>
        <Button
          variant='outline'
          size='icon'
          aria-label='Mes anterior'
          onClick={() => setMes(moverMes(mes, -1))}
        >
          <ChevronLeft />
        </Button>
        <p className='min-w-44 text-center text-lg font-semibold'>
          {nombreMes(mes)}
        </p>
        <Button
          variant='outline'
          size='icon'
          aria-label='Mes siguiente'
          disabled={mes >= hoy}
          onClick={() => setMes(moverMes(mes, 1))}
        >
          <ChevronRight />
        </Button>
        {mes !== hoy && (
          <Button variant='ghost' onClick={() => setMes(hoy)}>
            Volver a este mes
          </Button>
        )}
      </div>

      {isLoading && <Skeleton className='h-96 rounded-xl' />}
      {r && (
        <div className='grid grid-cols-[minmax(0,1fr)] gap-6'>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Cifra
              titulo='Vendido'
              valor={formatoPesos(r.ventas.total)}
              ayuda={`${r.ventas.pedidos} ${r.ventas.pedidos === 1 ? 'pedido' : 'pedidos'} nuevos`}
            />
            <Cifra
              titulo='Pedido promedio'
              valor={formatoPesos(r.ventas.ticket)}
              ayuda='Lo que vale un pedido en promedio'
            />
            <Cifra
              titulo='Cobrado'
              valor={formatoPesos(r.ventas.cobrado)}
              ayuda='Plata que entró en el mes'
            />
            <Cifra
              titulo={esAdmin ? 'Ganancia de comerciales' : 'Tu ganancia'}
              valor={formatoPesos(
                r.comerciales.reduce((s, c) => s + c.ganancia, 0)
              )}
              ayuda='Lo que subieron sobre el precio de fábrica'
            />
          </div>

          <VentasPorDia r={r} />

          <div className='grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2 lg:items-start'>
            <GananciaComerciales r={r} esAdmin={esAdmin} />
            <Productos r={r} />
          </div>

          <PorCobrar r={r} />

          {r.envios.conCosto > 0 && (
            <Card className='gap-2'>
              <CardHeader>
                <CardTitle className='text-lg'>Envíos del mes</CardTitle>
                <CardDescription>
                  De {r.envios.conCosto}{' '}
                  {r.envios.conCosto === 1 ? 'envío' : 'envíos'} con el costo
                  real anotado.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p>
                  Se cobraron <strong>{formatoPesos(r.envios.cobrado)}</strong>{' '}
                  y costaron <strong>{formatoPesos(r.envios.costoReal)}</strong>
                  :{' '}
                  {r.envios.cobrado >= r.envios.costoReal ? (
                    <span className='font-semibold text-primary'>
                      dejaron{' '}
                      {formatoPesos(r.envios.cobrado - r.envios.costoReal)}
                    </span>
                  ) : (
                    <span className='font-semibold text-destructive'>
                      perdieron{' '}
                      {formatoPesos(r.envios.costoReal - r.envios.cobrado)}
                    </span>
                  )}
                  .
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </Pagina>
  )
}

function VentasPorDia({ r }: { r: ReporteMes }) {
  const [tabla, setTabla] = useState(false)
  const conVentas = r.porDia.filter((d) => d.total > 0)
  const [a, m] = r.mes.split('-').map(Number)
  const fechaDia = (dia: number) =>
    new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(a, m - 1, dia)))
  return (
    <Card>
      <CardHeader className='flex flex-row flex-wrap items-start justify-between gap-2'>
        <div className='grid gap-1'>
          <CardTitle className='text-lg'>Ventas por día</CardTitle>
          <CardDescription>
            Lo vendido cada día del mes (pedidos nuevos).
          </CardDescription>
        </div>
        {conVentas.length > 0 && (
          <Button variant='ghost' size='sm' onClick={() => setTabla(!tabla)}>
            <Table2 /> {tabla ? 'Ver gráfica' : 'Ver como tabla'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {conVentas.length === 0 ? (
          <p className='py-10 text-center text-muted-foreground'>
            No hay ventas en este mes.
          </p>
        ) : tabla ? (
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b text-start text-muted-foreground'>
                <th className='py-2 text-start font-medium'>Día</th>
                <th className='py-2 text-end font-medium'>Pedidos</th>
                <th className='py-2 text-end font-medium'>Vendido</th>
              </tr>
            </thead>
            <tbody>
              {conVentas.map((d) => (
                <tr key={d.dia} className='border-b last:border-0'>
                  <td className='py-2 capitalize'>{fechaDia(d.dia)}</td>
                  <td className='py-2 text-end tabular-nums'>{d.pedidos}</td>
                  <td className='py-2 text-end tabular-nums'>
                    {formatoPesos(d.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            className='h-64'
            role='img'
            aria-label={`Ventas por día de ${nombreMes(r.mes)}`}
          >
            <ResponsiveContainer width='100%' height='100%'>
              <BarChart
                data={r.porDia}
                margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
                barCategoryGap={2}
              >
                <CartesianGrid vertical={false} stroke='var(--border)' />
                <XAxis
                  dataKey='dia'
                  tickLine={false}
                  axisLine={false}
                  interval='preserveStartEnd'
                  minTickGap={12}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={78}
                  tickFormatter={pesosCortos}
                  tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'var(--accent)', opacity: 0.6 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const d = payload[0].payload as ReporteMes['porDia'][number]
                    return (
                      <div className='rounded-lg border bg-popover px-3 py-2 text-sm shadow-md'>
                        <p className='font-medium capitalize'>
                          {fechaDia(d.dia)}
                        </p>
                        <p className='tabular-nums'>{formatoPesos(d.total)}</p>
                        <p className='text-xs text-muted-foreground'>
                          {d.pedidos} {d.pedidos === 1 ? 'pedido' : 'pedidos'}
                        </p>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey='total'
                  fill='var(--chart-1)'
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function GananciaComerciales({
  r,
  esAdmin,
}: {
  r: ReporteMes
  esAdmin: boolean
}) {
  const [ver, setVer] = useState(false)
  return (
    <Card className='pb-0'>
      <CardHeader>
        <CardTitle className='text-lg'>
          {esAdmin ? 'Ganancia de cada comercial' : 'Tu ganancia'}
        </CardTitle>
        <CardDescription>
          Lo que subió sobre el precio de fábrica en los pedidos del mes. “Lista
          para pagar” es la de los pedidos que el cliente ya pagó completo.
        </CardDescription>
      </CardHeader>
      {r.comerciales.length === 0 ? (
        <CardContent className='pb-6 text-center text-muted-foreground'>
          No hay pedidos en este mes.
        </CardContent>
      ) : (
        <>
          <div className='overflow-x-auto border-t'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b text-muted-foreground'>
                  <th className='px-4 py-2 text-start font-medium'>
                    Comercial
                  </th>
                  <th className='hidden px-2 py-2 text-end font-medium sm:table-cell'>
                    Pedidos
                  </th>
                  <th className='hidden px-2 py-2 text-end font-medium sm:table-cell'>
                    Vendió
                  </th>
                  <th className='px-2 py-2 text-end font-medium'>Ganancia</th>
                  <th className='px-4 py-2 text-end font-medium'>
                    Lista para pagar
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.comerciales.map((c) => (
                  <tr key={c.id} className='border-b last:border-0'>
                    <td className='px-4 py-2.5 font-medium'>{c.nombre}</td>
                    <td className='hidden px-2 py-2.5 text-end tabular-nums sm:table-cell'>
                      {c.pedidos}
                    </td>
                    <td className='hidden px-2 py-2.5 text-end tabular-nums sm:table-cell'>
                      {formatoPesos(c.ventas)}
                    </td>
                    <td className='px-2 py-2.5 text-end tabular-nums'>
                      {formatoPesos(c.ganancia)}
                    </td>
                    <td className='px-4 py-2.5 text-end font-semibold text-primary tabular-nums'>
                      {formatoPesos(c.gananciaPagada)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='border-t px-4 py-3'>
            <Button
              variant='ghost'
              size='sm'
              className='-ms-2'
              onClick={() => setVer(!ver)}
            >
              {ver
                ? 'Ocultar el detalle'
                : `Ver los ${r.pedidos.length} pedidos del mes`}
            </Button>
          </div>
          {ver && (
            <ul className='divide-y border-t'>
              {r.pedidos.map((p) => (
                <li
                  key={p.id}
                  className='flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm'
                >
                  <Link
                    to='/pedidos/$id'
                    params={{ id: String(p.id) }}
                    className='min-w-40 flex-1 underline-offset-2 hover:underline'
                  >
                    <span className='font-medium'>{p.cliente}</span>
                    <span className='block text-xs text-muted-foreground'>
                      {p.codigo} · {formatoFecha(p.fecha)}
                      {esAdmin && ` · ${p.comercial}`}
                    </span>
                  </Link>
                  <EstadoPagoBadge estado={p.estadoPago} />
                  <span className='w-24 text-end tabular-nums'>
                    {formatoPesos(p.ganancia)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

function Productos({ r }: { r: ReporteMes }) {
  const max = Math.max(1, ...r.productos.map((p) => p.unidades))
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg'>Productos más vendidos</CardTitle>
        <CardDescription>Por unidades, en los pedidos del mes.</CardDescription>
      </CardHeader>
      <CardContent>
        {r.productos.length === 0 ? (
          <p className='py-6 text-center text-muted-foreground'>
            No hay ventas en este mes.
          </p>
        ) : (
          <ol className='grid gap-3'>
            {r.productos.map((p, i) => (
              <li key={p.productoId} className='grid gap-1'>
                <div className='flex items-baseline justify-between gap-3 text-sm'>
                  <span className='font-medium'>
                    {i + 1}. {p.nombre}
                  </span>
                  <span className='shrink-0 text-muted-foreground tabular-nums'>
                    {p.unidades} und · {formatoPesos(p.ventas)}
                  </span>
                </div>
                <div
                  className='h-2 overflow-hidden rounded-full bg-muted'
                  aria-hidden='true'
                >
                  <div
                    className='h-full rounded-full bg-chart-1'
                    style={{ width: `${(p.unidades / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function PorCobrar({ r }: { r: ReporteMes }) {
  const [ahora] = useState(() => Date.now())
  const dias = (d: string | null) =>
    d
      ? Math.max(0, Math.floor((ahora - new Date(d).getTime()) / 86_400_000))
      : null
  return (
    <Card className='pb-0'>
      <CardHeader>
        <CardTitle className='text-lg'>Entregados que aún deben</CardTitle>
        <CardDescription>
          De cualquier mes. Primero los que llevan más tiempo. Total:{' '}
          <strong>
            {formatoPesos(r.porCobrar.reduce((s, p) => s + p.saldo, 0))}
          </strong>
        </CardDescription>
      </CardHeader>
      {r.porCobrar.length === 0 ? (
        <CardContent className='pb-6 text-center text-muted-foreground'>
          Todo lo entregado está pagado. ¡Muy bien!
        </CardContent>
      ) : (
        <ul className='divide-y border-t'>
          {r.porCobrar.map((p) => {
            const n = dias(p.entregadoEn)
            return (
              <li
                key={p.id}
                className='flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm'
              >
                <Link
                  to='/pedidos/$id'
                  params={{ id: String(p.id) }}
                  className='min-w-44 flex-1 underline-offset-2 hover:underline'
                >
                  <span className='font-medium'>{p.cliente}</span>
                  <span className='block text-xs text-muted-foreground'>
                    {p.codigo} · {p.comercial}
                  </span>
                </Link>
                {n !== null && (
                  <span
                    className={cn(
                      n > 15
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground'
                    )}
                  >
                    entregado hace {n} {n === 1 ? 'día' : 'días'}
                  </span>
                )}
                <span className='w-28 text-end text-base font-semibold tabular-nums'>
                  {formatoPesos(p.saldo)}
                </span>
                {p.whatsapp && (
                  <a
                    href={enlaceWhatsapp(
                      p.whatsapp,
                      `Hola ${p.cliente}, te escribimos de Hecho en Capas: del pedido ${p.codigo} queda un saldo de ${formatoPesos(p.saldo)}. ¡Gracias!`
                    )}
                    target='_blank'
                    rel='noreferrer'
                    className='inline-flex items-center gap-1 text-primary'
                  >
                    <MessageCircle className='size-4' /> Recordar
                  </a>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
