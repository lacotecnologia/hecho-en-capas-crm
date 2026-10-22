# Hecho en Capas · CRM

Sistema interno para llevar cotizaciones, pedidos, taller (fabricación), cobros y entregas de las impresiones 3D de Hecho en Capas.

- **Pantalla:** React + TypeScript + Tailwind, sobre la plantilla [shadcn-admin](https://github.com/satnaing/shadcn-admin) (MIT).
- **API:** una sola función de Vercel (`api/index.ts`) con [Hono](https://hono.dev).
- **Base de datos:** PostgreSQL en VPS propio, con [Drizzle](https://orm.drizzle.team) para el esquema y las migraciones.
- **Publicación:** Vercel conectado a este repositorio.

## Estado

| Fase                 | Qué incluye                                                         | Estado   |
| -------------------- | ------------------------------------------------------------------- | -------- |
| 1. Base              | Login con usuario + PIN, roles, Personas, Configuración, marca      | ✅ Lista |
| 2. Taller I          | Impresoras, bobinas, catálogo y precio de fábrica                   | ✅ Lista |
| 3. Cotizar           | Clientes, cotizador con cálculos, PDF, versiones y respuestas       | ✅ Lista |
| 4. Pedidos           | Pedidos, anticipo y cola de impresión por impresora                 | ✅ Lista |
| 5. Cobros y Entregas | Pagos con comprobante, devoluciones, entregas y vista del mensajero | ✅ Lista |
| 6. Seguimiento       | Página pública para el cliente, reportes y pendientes en Inicio     | ✅ Lista |

## Seguimiento para el cliente

Cada pedido tiene un código (por ejemplo `HC-7K4P2Q`). El cliente ve su pedido sin cuenta ni contraseña en:

- `https://TU-DOMINIO/seguimiento/HC-7K4P2Q`, o
- `https://TU-DOMINIO/seguimiento` y escribe el código.

Desde la ficha del pedido, el botón **Enviar por WhatsApp** le manda el enlace listo. La página solo muestra lo pensado para el cliente: pasos, fecha, productos, lo que falta por pagar, novedades y cómo contactarlos. Nunca muestra costos, ganancias ni notas internas.

## Poner a andar en tu Mac (paso a paso)

**1. Instala las dependencias** (una sola vez):

```bash
pnpm install
```

**2. Crea el archivo de valores secretos.** Copia el ejemplo:

```bash
cp .env.example .env
```

Abre `.env` y completa:

- `DATABASE_URL`: la conexión a Postgres en tu VPS.
- `SESSION_SECRET`: una frase larga al azar. Para generarla: `openssl rand -base64 48`
- `BLOB_READ_WRITE_TOKEN` (opcional en tu Mac): para subir fotos y archivos 3MF. Sale al crear un Blob Store en Vercel.

**3. Crea las tablas en la base de datos:**

```bash
pnpm db:migrar
```

**4. Crea tu usuario administrador** (cambia el usuario, el nombre y el PIN):

```bash
pnpm crear-admin luis "Luis" 1234
```

**5. Arranca el sistema:**

```bash
pnpm dev
```

Abre <http://localhost:5173> y entra con tu usuario y PIN. Desde **Personas** creas al resto del equipo.

## Publicar en Vercel

1. En Vercel: **Add New → Project** e importa este repositorio. Vercel detecta Vite solo.
2. En **Settings → Environment Variables** agrega `DATABASE_URL` y `SESSION_SECRET` (los mismos de tu `.env`, o unos propios de producción).
3. En **Storage** crea un **Blob Store** y conéctalo al proyecto: Vercel agrega solo `BLOB_READ_WRITE_TOKEN` (fotos y archivos de los productos).
4. En **Settings → Functions** elige la región más cercana a tu VPS.
5. Cada vez que se sube un cambio a `main`, Vercel publica solo.

## Base de datos en el VPS (recomendado)

- Un usuario de Postgres solo para la app (no `postgres`).
- SSL activo y `?sslmode=require` al final de `DATABASE_URL`.
- PgBouncer delante de Postgres: cada función de Vercel abre sus propias conexiones.

## Comandos útiles

| Comando                                       | Para qué                                                           |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev`                                    | Arranca el sistema en tu equipo (pantalla + API)                   |
| `pnpm dev:prueba`                             | Arranca la versión de prueba (sin base de datos, datos de ejemplo) |
| `pnpm build`                                  | Revisa tipos y arma la versión de producción                       |
| `pnpm lint`                                   | Revisa el código                                                   |
| `pnpm db:generar`                             | Crea una migración nueva después de cambiar `server/db/schema.ts`  |
| `pnpm db:migrar`                              | Aplica las migraciones pendientes a la base de datos               |
| `pnpm crear-admin <usuario> "<Nombre>" <PIN>` | Crea un administrador o le cambia el PIN                           |

## Estructura

```
api/            Función de Vercel (entrada de la API)
server/         Rutas de la API, sesión, base de datos
  db/           Esquema y migraciones
  rutas/        auth, usuarios, configuracion, taller
shared/         Código que usan la pantalla y el servidor (roles, configuración)
scripts/        crear-admin
src/            Pantalla (React)
  features/     Una carpeta por sección: auth, inicio, personas, configuracion…
  routes/       Rutas (TanStack Router, se generan solas)
```
