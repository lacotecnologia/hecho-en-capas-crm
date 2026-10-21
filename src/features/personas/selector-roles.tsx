import { ROLES, ROLES_INFO, type Rol } from '@shared/roles'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'

type SelectorRolesProps = {
  valor: Rol[]
  onChange: (roles: Rol[]) => void
}

/** Lista de roles con su explicación, para que nadie tenga que adivinar. */
export function SelectorRoles({ valor, onChange }: SelectorRolesProps) {
  const alternar = (rol: Rol, marcado: boolean) =>
    onChange(marcado ? [...valor, rol] : valor.filter((r) => r !== rol))

  return (
    <div className='grid gap-2'>
      {ROLES.map((rol) => {
        const marcado = valor.includes(rol)
        return (
          <label
            key={rol}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
              marcado && 'border-primary bg-accent/60'
            )}
          >
            <Checkbox
              checked={marcado}
              onCheckedChange={(v) => alternar(rol, v === true)}
              className='mt-0.5'
            />
            <span className='grid gap-0.5'>
              <span className='font-medium'>{ROLES_INFO[rol].nombre}</span>
              <span className='text-sm text-muted-foreground'>
                {ROLES_INFO[rol].descripcion}
              </span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
