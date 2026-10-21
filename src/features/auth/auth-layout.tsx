import { Logo } from '@/assets/logo'

type AuthLayoutProps = {
  children: React.ReactNode
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className='flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10'>
      <div className='flex w-full max-w-sm flex-col gap-6'>
        <div className='flex justify-center'>
          <Logo tamano='lg' />
        </div>
        {children}
      </div>
    </div>
  )
}
