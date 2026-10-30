// Ajustes de la tienda. Lo único que tienes que llenar cuando esté lista la parte de servidor.
export const CONFIG = {
  // ID de cliente de Google (Google Cloud Console > Credenciales > ID de cliente de OAuth, tipo "Web").
  // Mientras esté vacío, el botón de Google funciona en "modo de prueba" (no inicia sesión de verdad).
  GOOGLE_CLIENT_ID: '',

  // Dirección donde la tienda envía los pedidos (la API del CRM). Vacío = los pedidos se guardan solo en este navegador.
  API_PEDIDOS: '',

  // WhatsApp de la tienda, con indicativo y sin signos (ej. 573001234567). Vacío = no se muestra el botón.
  WHATSAPP: '573116317218',
}
