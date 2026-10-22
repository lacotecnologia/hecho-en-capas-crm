/**
 * PDF de la cotización (se arma en el navegador con @react-pdf/renderer).
 * Este archivo se carga solo cuando alguien pide el PDF.
 * Nunca muestra el precio de fábrica ni la ganancia del comercial.
 */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer'
import { type TextosConfig } from '@shared/configuracion'
import {
  type CotizacionDetalle,
  MODALIDADES_INFO,
  sumarDiasHabiles,
} from '@shared/cotizacion'

const VERDE = '#007a52'
const AMBAR = '#f9ae12'
const TINTA = '#1c1917'
const SUAVE = '#6b6560'
const LINEA = '#e7e5e4'
const FONDO = '#f3f8f5'

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`
const fecha = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

const s = StyleSheet.create({
  pagina: {
    paddingTop: 34,
    paddingBottom: 54,
    paddingHorizontal: 38,
    fontSize: 9.5,
    color: TINTA,
    fontFamily: 'Helvetica',
    lineHeight: 1.35,
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  logo: { width: 150, height: 54, objectFit: 'contain' },
  titulo: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: VERDE,
    textAlign: 'right',
    lineHeight: 1.3,
    marginBottom: 4,
  },
  codigo: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    marginTop: 2,
  },
  dato: { fontSize: 9, color: SUAVE, textAlign: 'right' },
  bandaAmbar: {
    height: 3,
    backgroundColor: AMBAR,
    marginBottom: 14,
    borderRadius: 2,
  },
  dosCol: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  caja: { flex: 1, padding: 10, borderRadius: 6, backgroundColor: FONDO },
  etiqueta: {
    fontSize: 7.5,
    color: SUAVE,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  fuerte: { fontFamily: 'Helvetica-Bold', fontSize: 10.5 },
  tablaCab: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: TINTA,
    paddingBottom: 4,
    marginBottom: 2,
  },
  th: {
    fontSize: 7.5,
    color: SUAVE,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: LINEA,
  },
  foto: {
    width: 42,
    height: 42,
    objectFit: 'contain',
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: '#f5f5f4',
  },
  colProducto: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  colCant: { width: 50, textAlign: 'right' },
  colUnit: { width: 80, textAlign: 'right' },
  colTotal: { width: 86, textAlign: 'right' },
  desc: { fontSize: 8, color: SUAVE, marginTop: 1 },
  totales: { alignSelf: 'flex-end', width: 236, marginTop: 10 },
  totalFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
  },
  totalGrande: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 6,
    paddingHorizontal: 8,
    paddingBottom: 6,
    backgroundColor: VERDE,
    color: '#ffffff',
    borderRadius: 5,
  },
  totalGrandeTxt: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  seccion: { marginTop: 16 },
  tituloSeccion: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: VERDE,
    marginBottom: 5,
  },
  tiempos: { flexDirection: 'row', gap: 10 },
  tiempo: {
    flex: 1,
    padding: 8,
    borderWidth: 0.75,
    borderColor: LINEA,
    borderRadius: 5,
  },
  refs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ref: {
    width: 120,
    height: 120,
    objectFit: 'contain',
    borderRadius: 4,
    backgroundColor: '#f4f5f4',
  },
  vineta: { flexDirection: 'row', marginBottom: 2 },
  pie: {
    position: 'absolute',
    bottom: 22,
    left: 38,
    right: 38,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: SUAVE,
    borderTopWidth: 0.5,
    borderTopColor: LINEA,
    paddingTop: 6,
  },
})

/** Convierte cualquier imagen (WebP, data URL…) a PNG para el PDF. */
async function comoPng(url: string | null): Promise<string | null> {
  if (!url) return null
  try {
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    await img.decode()
    const lado = 500
    const escala = Math.min(
      1,
      lado / Math.max(img.naturalWidth, img.naturalHeight)
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

type Imagenes = {
  logo: string | null
  lineas: (string | null)[]
  refs: (string | null)[]
}

function Documento({
  c,
  t,
  img,
}: {
  c: CotizacionDetalle
  t: TextosConfig
  img: Imagenes
}) {
  const r = c.resumen
  const emitida = c.enviadaEn ?? new Date().toISOString()
  const vence = c.venceEn
  const dias = r.diasFabricacion + r.diasEnvio
  const entrega = sumarDiasHabiles(new Date(emitida), dias)
  const contacto = [
    t.negocio_whatsapp && `WhatsApp ${t.negocio_whatsapp}`,
    t.negocio_email,
  ]
    .filter(Boolean)
    .join(' · ')
  const condiciones = (t.condiciones ?? '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)

  return (
    <Document
      title={`Cotización ${c.codigo}`}
      author='Hecho en Capas'
      language='es'
    >
      <Page size='A4' style={s.pagina}>
        <View style={s.cabecera}>
          {img.logo ? (
            <Image src={img.logo} style={s.logo} />
          ) : (
            <Text style={s.titulo}>Hecho en Capas</Text>
          )}
          <View>
            <Text style={s.titulo}>Cotización</Text>
            <Text style={s.codigo}>{c.codigo}</Text>
            <Text style={s.dato}>Fecha: {fecha(emitida)}</Text>
            {vence && <Text style={s.dato}>Válida hasta: {fecha(vence)}</Text>}
          </View>
        </View>
        <View style={s.bandaAmbar} />

        <View style={s.dosCol}>
          <View style={s.caja}>
            <Text style={s.etiqueta}>Para</Text>
            <Text style={s.fuerte}>{c.cliente?.nombre ?? 'Cliente'}</Text>
            {c.cliente?.documento ? (
              <Text>Doc. {c.cliente.documento}</Text>
            ) : null}
            {c.cliente?.whatsapp ? (
              <Text>WhatsApp {c.cliente.whatsapp}</Text>
            ) : null}
            {c.cliente?.email ? <Text>{c.cliente.email}</Text> : null}
            {[c.cliente?.direccion, c.cliente?.ciudad].filter(Boolean).length >
              0 && (
              <Text>
                {[c.cliente?.direccion, c.cliente?.ciudad]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            )}
          </View>
          <View style={s.caja}>
            <Text style={s.etiqueta}>De</Text>
            <Text style={s.fuerte}>Hecho en Capas</Text>
            <Text>Impresión 3D · {t.negocio_ciudad}</Text>
            {contacto ? <Text>{contacto}</Text> : null}
            <Text>Te atiende: {c.comercial.nombre}</Text>
          </View>
        </View>

        <View style={s.tablaCab}>
          <Text style={[s.th, { flex: 1 }]}>Producto</Text>
          <Text style={[s.th, s.colCant]}>Cant.</Text>
          <Text style={[s.th, s.colUnit]}>Valor unidad</Text>
          <Text style={[s.th, s.colTotal]}>Total</Text>
        </View>
        {c.lineas.map((l, i) => (
          <View key={i} style={s.fila} wrap={false}>
            <View style={s.colProducto}>
              {img.lineas[i] ? (
                <Image src={img.lineas[i]!} style={s.foto} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{l.nombre}</Text>
                {l.descripcion ? (
                  <Text style={s.desc}>{l.descripcion}</Text>
                ) : null}
              </View>
            </View>
            <Text style={s.colCant}>{l.cantidad}</Text>
            <Text style={s.colUnit}>{pesos(l.precioVenta)}</Text>
            <Text style={[s.colTotal, { fontFamily: 'Helvetica-Bold' }]}>
              {pesos(l.precioVenta * l.cantidad)}
            </Text>
          </View>
        ))}

        <View style={s.totales} wrap={false}>
          <View style={s.totalFila}>
            <Text>Productos</Text>
            <Text>{pesos(r.subtotal)}</Text>
          </View>
          {c.cargos.map((cg, i) => (
            <View key={i} style={s.totalFila}>
              <Text>{cg.concepto}</Text>
              <Text>{pesos(cg.valor)}</Text>
            </View>
          ))}
          {r.descuento > 0 && (
            <View style={s.totalFila}>
              <Text>Descuento</Text>
              <Text>- {pesos(r.descuento)}</Text>
            </View>
          )}
          <View style={s.totalGrande}>
            <Text style={s.totalGrandeTxt}>Total</Text>
            <Text style={s.totalGrandeTxt}>{pesos(r.total)}</Text>
          </View>
          {r.anticipo > 0 && (
            <>
              <View style={[s.totalFila, { marginTop: 4 }]}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                  Anticipo para empezar ({r.anticipoPct} %)
                </Text>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                  {pesos(r.anticipo)}
                </Text>
              </View>
              <View style={s.totalFila}>
                <Text>Saldo contra entrega</Text>
                <Text>{pesos(r.saldo)}</Text>
              </View>
            </>
          )}
          <Text style={{ fontSize: 7.5, color: SUAVE, marginTop: 3 }}>
            Precios en pesos colombianos. No incluyen IVA.
          </Text>
        </View>

        <View style={s.seccion} wrap={false}>
          <Text style={s.tituloSeccion}>Tiempos</Text>
          <View style={s.tiempos}>
            <View style={s.tiempo}>
              <Text style={s.etiqueta}>Fabricación</Text>
              <Text style={s.fuerte}>
                {r.diasFabricacion === 0
                  ? 'Disponible ya'
                  : diasHabiles(r.diasFabricacion)}
              </Text>
            </View>
            <View style={s.tiempo}>
              <Text style={s.etiqueta}>Entrega</Text>
              <Text style={s.fuerte}>
                {MODALIDADES_INFO[c.modalidad].corto}
              </Text>
              {r.diasEnvio > 0 && <Text>+ {diasHabiles(r.diasEnvio)}</Text>}
            </View>
            <View style={s.tiempo}>
              <Text style={s.etiqueta}>Fecha estimada</Text>
              <Text style={s.fuerte}>{fecha(entrega)}</Text>
              <Text style={{ fontSize: 7.5, color: SUAVE }}>
                contando desde hoy{r.anticipo > 0 ? ' y el anticipo' : ''}
              </Text>
            </View>
          </View>
        </View>

        {c.notas ? (
          <View style={s.seccion} wrap={false}>
            <Text style={s.tituloSeccion}>Notas</Text>
            <Text>{c.notas}</Text>
          </View>
        ) : null}

        {img.refs.some(Boolean) && (
          <View style={s.seccion} wrap={false}>
            <Text style={s.tituloSeccion}>Imágenes de referencia</Text>
            <View style={s.refs}>
              {img.refs.map((u, i) =>
                u ? <Image key={i} src={u} style={s.ref} /> : null
              )}
            </View>
          </View>
        )}

        {condiciones.length > 0 && (
          <View style={s.seccion} wrap={false}>
            <Text style={s.tituloSeccion}>Condiciones</Text>
            {condiciones.map((x, i) => (
              <View key={i} style={s.vineta}>
                <Text style={{ width: 10 }}>•</Text>
                <Text style={{ flex: 1 }}>{x}</Text>
              </View>
            ))}
          </View>
        )}

        {t.datos_pago ? (
          <View style={[s.seccion, s.caja]} wrap={false}>
            <Text style={s.etiqueta}>Datos para pagar</Text>
            <Text>{t.datos_pago}</Text>
          </View>
        ) : null}

        <View style={s.pie} fixed>
          <Text>Hecho en Capas · {c.codigo}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

export async function generarPdfCotizacion(
  c: CotizacionDetalle,
  textos: TextosConfig
) {
  const base = import.meta.env.BASE_URL
  const [logo, lineas, refs] = await Promise.all([
    comoPng(`${base}images/logo-hecho-en-capas.png`),
    Promise.all(c.lineas.map((l) => comoPng(l.imagen))),
    Promise.all(c.imagenes.map((i) => comoPng(i.url))),
  ])
  return pdf(
    <Documento c={c} t={textos} img={{ logo, lineas, refs }} />
  ).toBlob()
}

function diasHabiles(n: number) {
  return n === 1 ? '1 día hábil' : `${n} días hábiles`
}
