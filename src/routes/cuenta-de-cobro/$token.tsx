import { createFileRoute } from '@tanstack/react-router'
import { CuentaParaCliente } from '@/features/cuentas-cobro/publica'

// Página pública: el cliente abre su cuenta de cobro con el enlace, sin login.
export const Route = createFileRoute('/cuenta-de-cobro/$token')({
  component: RutaCuenta,
})

function RutaCuenta() {
  const { token } = Route.useParams()
  return <CuentaParaCliente key={token} token={token} />
}
