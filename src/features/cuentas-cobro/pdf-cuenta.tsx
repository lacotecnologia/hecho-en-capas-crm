/**
 * PDF de la cuenta de cobro (se arma en el navegador con @react-pdf/renderer).
 * Lo usan el administrador y la página del cliente. Se carga solo cuando hace falta.
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
import { type CuentaPublica, type TipoDocumento } from '@shared/cuenta-cobro'
import { fechaCuenta } from './fechas'

const VERDE = '#007a52'
const AMBAR = '#f9ae12'
const TINTA = '#1c1917'
const SUAVE = '#6b6560'
const LINEA = '#e7e5e4'
const FONDO = '#f3f8f5'

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`

const sigla = (t: TipoDocumento) =>
  t === 'CC' ? 'C.C.' : t === 'CE' ? 'C.E.' : t === 'PP' ? 'Pasaporte' : 'NIT'

const s = StyleSheet.create({
  pagina: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 42,
    fontSize: 10,
    color: TINTA,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  logo: { width: 120, height: 44, objectFit: 'contain' },
  titulo: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: VERDE,
    textAlign: 'right',
    letterSpacing: 0.5,
    lineHeight: 1.25,
    marginBottom: 2,
  },
  codigo: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginTop: 2 },
  dato: { fontSize: 9, color: SUAVE, textAlign: 'right' },
  banda: { height: 3, backgroundColor: AMBAR, marginBottom: 16, borderRadius: 2 },
  etiqueta: {
    fontSize: 7.5,
    color: SUAVE,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  grande: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  bloque: { marginBottom: 9 },
  caja: { padding: 9, borderRadius: 6, backgroundColor: FONDO, marginBottom: 10 },
  suma: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  tablaCab: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: TINTA,
    paddingBottom: 4,
    marginTop: 4,
  },
  th: { fontSize: 7.5, color: SUAVE, textTransform: 'uppercase', letterSpacing: 0.6 },
  fila: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: LINEA,
  },
  colDesc: { flex: 1, paddingRight: 6 },
  colCant: { width: 44, textAlign: 'right' },
  colUnit: { width: 78, textAlign: 'right' },
  colTotal: { width: 84, textAlign: 'right' },
  totales: { alignSelf: 'flex-end', width: 236, marginTop: 8 },
  totalFila: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalGrande: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    padding: 7,
    backgroundColor: VERDE,
    color: '#ffffff',
    borderRadius: 5,
  },
  totalGrandeTxt: { fontFamily: 'Helvetica-Bold', fontSize: 12.5 },
  declaracion: { marginTop: 12, fontSize: 9.5, textAlign: 'justify' },
  cierre: { flexDirection: 'row', gap: 18, alignItems: 'flex-end', marginTop: 12 },
  firmaZona: { width: 220 },
  firma: { width: 160, height: 58, objectFit: 'contain', marginBottom: -4 },
  lineaFirma: { borderTopWidth: 0.75, borderTopColor: TINTA, paddingTop: 4 },
  pie: {
    position: 'absolute',
    bottom: 22,
    left: 42,
    right: 42,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: SUAVE,
    borderTopWidth: 0.5,
    borderTopColor: LINEA,
    paddingTop: 6,
  },
  anulada: {
    position: 'absolute',
    top: 330,
    left: 60,
    right: 60,
    textAlign: 'center',
    fontSize: 72,
    fontFamily: 'Helvetica-Bold',
    color: '#dc2626',
    opacity: 0.18,
    transform: 'rotate(-28deg)',
  },
})

function Documento({ c, logo }: { c: CuentaPublica; logo: string | null }) {
  const saldo = c.total - c.abonado
  const contacto = [c.cobrador.direccion, c.cobrador.telefono && `Tel. ${c.cobrador.telefono}`, c.cobrador.email]
    .filter(Boolean)
    .join(' · ')
  return (
    <Document title={`Cuenta de cobro ${c.codigo}`} author={c.cobrador.nombre} language='es'>
      <Page size='A4' style={s.pagina}>
        <View style={s.cabecera}>
          {logo ? <Image src={logo} style={s.logo} /> : <View />}
          <View>
            <Text style={s.titulo}>CUENTA DE COBRO</Text>
            <Text style={s.codigo}>No. {c.codigo}</Text>
            <Text style={s.dato}>
              {c.cobrador.ciudad}, {fechaCuenta(c.fecha)}
            </Text>
          </View>
        </View>
        <View style={s.banda} />

        <View style={s.bloque}>
          <Text style={s.grande}>{c.pagador.nombre}</Text>
          <Text>
            {sigla(c.pagador.tipoDocumento)} {c.pagador.documento}
          </Text>
          {[c.pagador.direccion, c.pagador.ciudad].some(Boolean) && (
            <Text style={{ color: SUAVE }}>
              {[c.pagador.direccion, c.pagador.ciudad].filter(Boolean).join(', ')}
            </Text>
          )}
        </View>

        <View style={s.bloque}>
          <Text style={s.etiqueta}>Debe a</Text>
          <Text style={s.grande}>{c.cobrador.nombre}</Text>
          <Text>
            {sigla(c.cobrador.tipoDocumento)} {c.cobrador.documento}
          </Text>
          {contacto ? <Text style={{ color: SUAVE }}>{contacto}</Text> : null}
        </View>

        <View style={s.caja} wrap={false}>
          <Text style={s.etiqueta}>La suma de</Text>
          <Text style={s.suma}>
            {c.valorEnLetras} ({pesos(c.total)})
          </Text>
          <Text style={[s.etiqueta, { marginTop: 8 }]}>Por concepto de</Text>
          <Text>{c.concepto}</Text>
        </View>

        <Text style={[s.etiqueta, { marginTop: 4 }]}>Detalle</Text>
        <View style={s.tablaCab}>
          <Text style={[s.th, { flex: 1 }]}>Descripción</Text>
          <Text style={[s.th, s.colCant]}>Cant.</Text>
          <Text style={[s.th, s.colUnit]}>Valor unidad</Text>
          <Text style={[s.th, s.colTotal]}>Total</Text>
        </View>
        {c.items.map((it, i) => (
          <View key={i} style={s.fila} wrap={false}>
            <Text style={s.colDesc}>{it.descripcion}</Text>
            <Text style={s.colCant}>{it.cantidad}</Text>
            <Text style={s.colUnit}>{pesos(it.valorUnitario)}</Text>
            <Text style={[s.colTotal, { fontFamily: 'Helvetica-Bold' }]}>{pesos(it.total)}</Text>
          </View>
        ))}
        <View style={s.totales} wrap={false}>
          {c.cargos.map((cg, i) => (
            <View key={i} style={s.totalFila}>
              <Text>{cg.concepto}</Text>
              <Text>{pesos(cg.valor)}</Text>
            </View>
          ))}
          {c.descuento > 0 && (
            <View style={s.totalFila}>
              <Text>Descuento</Text>
              <Text>- {pesos(c.descuento)}</Text>
            </View>
          )}
          <View style={s.totalGrande}>
            <Text style={s.totalGrandeTxt}>Total</Text>
            <Text style={s.totalGrandeTxt}>{pesos(c.total)}</Text>
          </View>
          {c.abonado > 0 && (
            <>
              <View style={[s.totalFila, { marginTop: 4 }]}>
                <Text>Abonado a la fecha</Text>
                <Text>- {pesos(c.abonado)}</Text>
              </View>
              <View style={s.totalFila}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Saldo por pagar</Text>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{pesos(saldo)}</Text>
              </View>
            </>
          )}
          <Text style={{ fontSize: 7.5, color: SUAVE, marginTop: 3 }}>
            Valores en pesos colombianos. Pedido {c.pedido.codigo}.
          </Text>
        </View>

        <Text style={s.declaracion}>{c.declaracion}</Text>

        <View style={s.cierre} wrap={false}>
          <View style={{ flex: 1 }}>
            {c.datosPago ? (
              <View style={[s.caja, { marginBottom: 0 }]}>
                <Text style={s.etiqueta}>Datos para pagar</Text>
                <Text>{c.datosPago}</Text>
              </View>
            ) : null}
          </View>
          <View style={s.firmaZona}>
            {c.firma ? <Image src={c.firma} style={s.firma} /> : <View style={{ height: 48 }} />}
            <View style={s.lineaFirma}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{c.cobrador.nombre}</Text>
              <Text>
                {sigla(c.cobrador.tipoDocumento)} {c.cobrador.documento}
              </Text>
            </View>
          </View>
        </View>

        {c.estado === 'anulada' && (
          <Text style={s.anulada} fixed>
            ANULADA
          </Text>
        )}

        <View style={s.pie} fixed>
          <Text>
            Cuenta de cobro {c.codigo} · {c.cobrador.nombre}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

/** Logo a PNG (react-pdf no lee WebP). */
async function logoPng(): Promise<string | null> {
  try {
    const img = new window.Image()
    img.src = `${import.meta.env.BASE_URL}images/logo-hecho-en-capas.png`
    await img.decode()
    const escala = Math.min(1, 500 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * escala)
    canvas.height = Math.round(img.naturalHeight * escala)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

export async function generarPdfCuenta(c: CuentaPublica) {
  return pdf(<Documento c={c} logo={await logoPng()} />).toBlob()
}
