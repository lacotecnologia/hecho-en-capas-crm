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
- Precio de fábrica = costo × (1 + margen elegido 40 % o 50 %), redondeado hacia arriba al mil; el taller puede subirlo a mano, también en miles (se guarda el calculado y el ajuste).
- El comercial puede subir hasta 25 % sobre el precio de fábrica, en valores redondos a mil (el máximo es el mil más alto que no pasa el 25 %); esa diferencia es su ganancia. Nunca por debajo del precio de fábrica.
- Colores por producto: si el taller prende "El cliente puede escoger el color", marca bobinas preaprobadas (mínimo 2); el comercial escoge una por línea (mismo precio). Stock por color (`producto_colores`, el total en `productos.stock`); todo movimiento pasa por `moverStock` en `server/stock.ts`. La orden guarda `color_bobina_id` y al empezar solo se acepta una bobina de ese color y material.
- Borrado lógico, solo el administrador: productos, clientes, cotizaciones, pedidos (solo cancelados), bobinas e impresoras tienen `borrado_en`/`borrado_por`; las listas filtran `isNull(borradoEn)` y la Papelera (`/papelera`) recupera. Rutas en `server/rutas/papelera.ts`; botón `BotonBorrar`.
- Impresoras: Bambu Lab A1 con AMS lite (multicolor, 3.200.000 COP) y Anycubic Kobra 2 Neo (un color, 800.000 COP).

## Tienda en línea (sitio aparte)

- API pública en `server/rutas/tienda.ts` (`/api/tienda/*`): productos sin sesión; el cliente entra con Google (`/entrar`, verificado en el servidor con `GOOGLE_CLIENT_ID`) y recibe un token propio (`SESSION_SECRET::tienda`, no sirve en el CRM). CORS solo para `TIENDA_ORIGENES`.
- El Admin fija `productos.precioTienda` y `enTienda` (tarjeta "Tienda en línea" en la ficha). Nunca por debajo del precio de fábrica; la API usa siempre ese precio, no el que mande el navegador.
- Un pedido web es una cotización `enviada` con `origen = 'tienda'`, asignada a quien tenga "Atiende la tienda" (si nadie, el primer admin). Lógica compartida con Cotizar en `server/cotizaciones-logica.ts`.
- Quien se registra en la web es cliente en etapa `prospecto` (`origen = 'tienda'`, con `aceptoDatosEn`); pasa a `cliente` al crearse su pedido.
- La tienda vive en su propia carpeta/repo (HTML + JS); ver su `LEEME.md`.

## Verificar antes de subir

`pnpm build` (tipos + build) y `pnpm lint` deben pasar sin errores.

## Mostrar el resultado

Luis quiere ver el resultado visual de cada avance: al terminar, enviar capturas de las pantallas nuevas o cambiadas (computador y celular). Para capturas limpias, arrancar con `npx vite --mode captura` (así no salen las herramientas de desarrollo).
