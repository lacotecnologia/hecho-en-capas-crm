import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'
import { DirectionProvider } from './context/direction-provider'
import { FontProvider } from './context/font-provider'
import { ThemeProvider } from './context/theme-provider'
// Rutas generadas automáticamente a partir de src/routes
import { routeTree } from './routeTree.gen'
// Estilos
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (intentos, error) => {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status))
          return false
        return intentos < 2
      },
      refetchOnWindowFocus: import.meta.env.PROD,
      staleTime: 10 * 1000,
    },
    mutations: {
      onError: handleServerError,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      // La consulta de sesión maneja su propio 401 (lleva a /ingresar).
      if (query.queryKey[0] === 'sesion') return
      if (error instanceof ApiError && error.status === 401) {
        toast.error(error.message)
        queryClient.clear()
        const redirect = `${router.history.location.href}`
        router.navigate({ to: '/ingresar', search: { redirect } })
      }
    },
  }),
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <DirectionProvider>
              <RouterProvider router={router} />
            </DirectionProvider>
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
  )
}
