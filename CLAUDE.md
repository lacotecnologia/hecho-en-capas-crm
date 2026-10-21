# CLAUDE.md — CRM Hecho en Capas

Sistema interno (familiar) para cotizaciones, pedidos, taller, cobros y entregas de impresiones 3D. Plan completo: documento "Plan CRM Hecho en Capas".

## Regla de oro: fácil de usar

- Todo texto visible en **español sencillo**, sin palabras técnicas ("Cobrar anticipo", no "Registrar transacción").
- Un botón principal por pantalla que dice exactamente lo que pasa.
- Cada campo con una línea de ayuda; cálculos visibles mientras se escribe.
- Mensajes de error que dicen cómo arreglarlo, escritos en el servidor y mostrados tal cual.
- Pensado también para celular (botones grandes, `inputMode` numérico).

## Stack

- Pantalla: Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui (plantilla shadcn-admin), TanStack Router (rutas por archivos en `src/routes`) y TanStack Query.
- API: Hono en `server/app.ts`, expuesta por una sola función de Vercel (`api/index.ts`); `vercel.json` redirige `/api/*` ahí. En local, el plugin `apiLocal` de `vite.config.ts` atiende `/api/*` con la misma app.
- BD: Postgres en VPS propio + Drizzle (`server/db/schema.ts`, migraciones en `server/db/migraciones`).
- Sesión: cookie httpOnly `hec_sesion` (JWT HS256 con `SESSION_SECRET`); PIN con bcrypt; bloqueo de 15 min tras 5 intentos.

## Convenciones

- En `server/` los imports relativos llevan extensión `.js` (requisito de ESM en Vercel). Sin alias `@/` en el servidor.
- `shared/` lo usan pantalla y servidor (`@shared/...` en la pantalla).
- Dinero en pesos colombianos como enteros (sin decimales).
- Roles: `admin`, `comercial`, `fabricacion` (se muestra como "Taller"), `entregas`. Los permisos se validan en la API con `soloRoles(...)`, no solo ocultando botones.
- Menú y permisos de pantalla: `src/components/layout/data/navegacion.ts` y `exigirRoles` en `src/lib/guardias.ts`.
- Valores del negocio editables por el Admin: `shared/configuracion.ts` (con etiqueta, ayuda, unidad y rango).
- Cada sección nueva: carpeta en `src/features/<seccion>` + ruta en `src/routes/_authenticated/<seccion>.tsx` usando `<Pagina>`.

## Reglas de negocio ya decididas

- Sin IVA. Anticipo 50 % solo en personalizados. Cotización vence a los 10 días.
- Precio de fábrica = costo × (1 + margen elegido 40 % o 50 %), redondeado hacia arriba a la centena; el taller puede subirlo a mano (se guarda el calculado y el ajuste).
- El comercial puede subir hasta 25 % sobre el precio de fábrica; esa diferencia es su ganancia. Nunca por debajo del precio de fábrica.
- Impresoras: Bambu Lab A1 con AMS lite (multicolor, 3.200.000 COP) y Anycubic Kobra 2 Neo (un color, 800.000 COP).

## Verificar antes de subir

`pnpm build` (tipos + build) y `pnpm lint` deben pasar sin errores.

## Mostrar el resultado

Luis quiere ver el resultado visual de cada avance: al terminar, enviar capturas de las pantallas nuevas o cambiadas (computador y celular). Para capturas limpias, arrancar con `npx vite --mode captura` (así no salen las herramientas de desarrollo).
