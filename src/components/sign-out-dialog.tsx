import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { ConfirmDialog } from '@/components/confirm-dialog'

interface SignOutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutDialog({ open, onOpenChange }: SignOutDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const salir = async () => {
    await api('/auth/salir', { method: 'POST' }).catch(() => undefined)
    queryClient.clear()
    navigate({ to: '/ingresar', replace: true })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='¿Salir del sistema?'
      desc='Para volver a entrar necesitarás tu usuario y tu PIN.'
      confirmText='Sí, salir'
      cancelBtnText='Seguir aquí'
      destructive
      handleConfirm={salir}
      className='sm:max-w-sm'
    />
  )
}
