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
- Comisiones: la comisión es la `ganancia` del pedido y se gana al quedar Cerrado (`anotarComisionGanada` en `recalcularPedido`; si se reabre, se quita lo no pagado). Solo rol Comercial que no sea admin (`ganaComision`). Una devolución después del cierre anota un descuento (nunca más que lo ganado en ese pedido); antes del cierre baja la ganancia. El admin paga cuando decide y el pago liquida TODO lo pendiente (manda el `total` que vio; si cambió, se rechaza); "Ya se pagó por fuera" deja en cero sin mover plata. Tablas `comisiones` (movimientos) y `pagos_comision`; lógica en `server/comisiones.ts`, reglas en `shared/comisiones.ts`.
- Hora de entrega (promesa): una sola calculadora en `shared/promesa.ts` (pantalla y servidor), probada con `pnpm probar:promesa`. Usa existencias por color (personalizado con nombre nunca usa existencias), la cola real (`estadoTaller` en `server/promesa.ts`), horario del taller (imprimir sigue de noche; preparar, cambiar cama, acabado y alistar solo en horario), festivos de Colombia calculados y reglas de entrega que el admin edita en Configuración → Horarios y entregas (`shared/agenda.ts`, guardado en `configuracion` con clave `agenda_entregas`). Hora de Bogotá fija (UTC−5). La cotización guarda la promesa al guardar/enviar; al crear el pedido se recalcula (si quedó > 1 h más tarde, el comercial confirma con `aceptaNuevaFecha`) y `comprometerPedido` guarda fecha+hora, `listo_compromiso`, `hora_limite` por orden y la fecha sugerida de la entrega. Existencias parciales: se separa lo que hay (`de_stock`) y se imprime lo que falta.
- Recorrido de práctica obligatorio: un comercial (no admin) con `usuarios.recorrido_en` vacío no usa nada real (`conSesion` responde 403 salvo `/auth/*`; la pantalla lo manda a `/bienvenida`). La práctica es un mundo aparte: `src/lib/practica.ts` desvía toda la API (menos `/auth/*`) al motor de `src/demo` guardado en otra clave del navegador. Los pasos están en `src/features/recorrido/pasos.ts` y señalan elementos con `data-tour="..."`: si cambias o quitas uno de esos elementos, conserva el atributo. Al terminar, `POST /api/auth/recorrido`; el admin puede pedir que lo repita desde Personas. Manual en `/manual` (imágenes en `public/manual`). Subidas y PDF preguntan `esModoPrueba()`, no el modo de compilación.
- En `sql\`\`` dentro de un `select({...})`, drizzle escribe las columnas sin tabla: en subconsultas usa `"tabla"."columna"` a mano.
- Página web (hechoencapas.vercel.app, rama `sitio-web`, HTML estático): lee `GET /api/tienda/productos` (pública, sin sesión, CORS abierto; solo datos del catálogo, nunca costos ni 3MF/STL). Sale lo que tenga `en_web` y no esté borrado ni inactivo. `precio_web` vacío = "Consulta el precio"; en miles y nunca menor al precio de fábrica (si la fábrica sube por encima, la API lo manda como sin precio). Manda `stock` (y por color si escoge color; 0 en personalizados) y la web dice "Tenemos N listos" en vez de los días de fabricación. Productos con el mismo `grupo_web` salen en UNA tarjeta y `tamano_web` es el botón de cada uno. Solo el admin lo edita (tarjeta "Página web" en la ficha, guarda con el mismo botón de la ficha; `PATCH /taller/productos/:id/web`). Los pedidos de la web llegan por WhatsApp (todavía no entran al CRM).
- Impresoras: Bambu Lab A1 con AMS lite (multicolor, 3.200.000 COP) y Anycubic Kobra 2 Neo (un color, 800.000 COP).

## Verificar antes de subir

`pnpm build` (tipos + build) y `pnpm lint` deben pasar sin errores.

## Mostrar el resultado

Luis quiere ver el resultado visual de cada avance: al terminar, enviar capturas de las pantallas nuevas o cambiadas (computador y celular). Para capturas limpias, arrancar con `npx vite --mode captura` (así no salen las herramientas de desarrollo).
