/// <reference types="vitest/config" />
import path from 'path'
import { type Plugin, defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { playwright } from '@vitest/browser-playwright'

/**
 * En desarrollo (pnpm dev) atiende /api/* con la misma app de Hono que usa
 * Vercel en producción, así no hace falta instalar la CLI de Vercel.
 */
function apiLocal(): Plugin {
  return {
    name: 'api-local',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        try {
          const { getRequestListener } = await import('@hono/node-server')
          const { app } = await server.ssrLoadModule('/server/app.ts')
          await getRequestListener(app.fetch)(req, res)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    apiLocal(),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    silent: 'passed-only',
    unstubEnvs: true,
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
    coverage: {
      exclude: [
        'src/components/ui/**',
        'src/assets/**',
        'src/tanstack-table.d.ts',
        'src/routeTree.gen.ts',
        'src/test-utils/**',
        'src/routes/**',
      ],
    },
  },
})
