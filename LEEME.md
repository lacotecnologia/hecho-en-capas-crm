# Sitio web de Hecho en Capas (tienda + academia)

Rama aparte del CRM: solo contiene la página pública estática que se publica en el proyecto `hechoencapas` de Vercel.

- `index.html`: tienda. Los pedidos se envían por WhatsApp (`js/config.js` → `WHATSAPP`).
- `academia.html` (`/academia`): formulario para apartar cupo en los cursos; también llega por WhatsApp.
- Productos y precios: `js/data.js` (por ahora de ejemplo, hasta conectar con el CRM).
