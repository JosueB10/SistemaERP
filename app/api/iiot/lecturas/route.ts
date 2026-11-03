import { claveValida, clienteServicio, respuestaNoAutorizado, respuestaSinConfigurar } from '@/lib/iiot/servidor'
//Por aquí anduvo Henry Lanuza, equipo de revisión
// Endpoint IIoT: los dispositivos de planta (o iiot/emulador.py) envían aquí sus lecturas.
// Autenticación por clave de dispositivo en la cabecera x-api-key (variable IIOT_API_KEY).
// Las lecturas se guardan con la llave de servicio de Supabase (SUPABASE_SERVICE_ROLE_KEY, solo servidor).
//
// POST /api/iiot/lecturas
//   { "dispositivo": "PRENSA-01", "centro": "CT-03", "temperatura": 165.2, "presion": 4.1, "piezas": 2,
//     "estado": "operando", "potencia_kw": 4.5, "energia_kwh": 0.075, "registrado_en": "2026-10-30T14:05:00Z" }
//   o un lote: { "lecturas": [ {...}, {...} ] } (máximo 50)
//
//   · "centro" es el código del centro de trabajo (CT-03) o de la planta (PL-01) para el medidor de las lámparas.
//   · "energia_kwh" es la energía gastada desde la lectura anterior del mismo dispositivo.
//   · "registrado_en" (opcional) es la hora en que el dispositivo tomó la lectura. Si estuvo sin conexión,
//     la guarda en su cola y la reenvía después con su hora original (hasta 7 días).

export const dynamic = 'force-dynamic'

const ESTADOS = ['operando', 'preparacion', 'inactivo', 'paro', 'alarma']
const MAXIMO_LOTE = 50

type Lectura = {
  dispositivo: string
  centro: string
  temperatura: number | null
  presion: number | null
  humedad: number | null
  piezas: number
  estado: string
  mensaje: string | null
  potenciaKw: number | null
  energiaKwh: number | null
  registradoEn: string | null
}

const numeroOpcional = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v))

// Valida una lectura; devuelve el texto del error o la lectura normalizada
function validar(entrada: unknown): Lectura | string {
  if (!entrada || typeof entrada !== 'object') return 'La lectura debe ser un objeto JSON.'
  const e = entrada as Record<string, unknown>
  const dispositivo = typeof e.dispositivo === 'string' ? e.dispositivo.trim() : ''
  const centro = typeof e.centro === 'string' ? e.centro.trim() : ''
  if (!dispositivo || dispositivo.length > 50) return 'Falta "dispositivo" (texto de hasta 50 caracteres).'
  if (!centro) return 'Falta "centro" (código del centro de trabajo, por ejemplo CT-03, o de la planta, PL-01).'
  const temperatura = numeroOpcional(e.temperatura)
  const presion = numeroOpcional(e.presion)
  const humedad = numeroOpcional(e.humedad)
  const potenciaKw = numeroOpcional(e.potencia_kw)
  const energiaKwh = numeroOpcional(e.energia_kwh)
  const piezas = e.piezas === undefined ? 0 : Number(e.piezas)
  for (const [nombre, valor] of [['temperatura', temperatura], ['presion', presion], ['humedad', humedad], ['potencia_kw', potenciaKw], ['energia_kwh', energiaKwh]] as const) {
    if (valor !== null && (!Number.isFinite(valor) || Math.abs(valor) > 9999)) return `"${nombre}" no es un número válido.`
  }
  if ((potenciaKw ?? 0) < 0 || (energiaKwh ?? 0) < 0) return '"potencia_kw" y "energia_kwh" no pueden ser negativos.'
  let registradoEn: string | null = null
  if (e.registrado_en !== undefined && e.registrado_en !== null && e.registrado_en !== '') {
    const fecha = typeof e.registrado_en === 'string' ? new Date(e.registrado_en) : null
    if (!fecha || Number.isNaN(fecha.getTime())) return '"registrado_en" debe ser una fecha ISO 8601.'
    registradoEn = fecha.toISOString()
  }
  if (!Number.isInteger(piezas) || piezas < 0 || piezas > 10000) return '"piezas" debe ser un entero entre 0 y 10000.'
  const estado = typeof e.estado === 'string' && e.estado ? e.estado : 'operando'
  if (!ESTADOS.includes(estado)) return `"estado" debe ser uno de: ${ESTADOS.join(', ')}.`
  const mensaje = typeof e.mensaje === 'string' && e.mensaje.trim() ? e.mensaje.trim().slice(0, 300) : null
  return { dispositivo, centro, temperatura, presion, humedad, piezas, estado, mensaje, potenciaKw, energiaKwh, registradoEn }
}

export async function POST(request: Request) {
  if (!claveValida(request.headers.get('x-api-key'))) return respuestaNoAutorizado()
  const supabase = clienteServicio()
  if (!supabase) return respuestaSinConfigurar()

  let cuerpo: unknown
  try {
    cuerpo = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'El cuerpo no es JSON válido.' }, { status: 400 })
  }

  const entradas = cuerpo && typeof cuerpo === 'object' && Array.isArray((cuerpo as { lecturas?: unknown }).lecturas)
    ? (cuerpo as { lecturas: unknown[] }).lecturas
    : [cuerpo]
  if (entradas.length === 0 || entradas.length > MAXIMO_LOTE) {
    return Response.json({ ok: false, error: `Envíe entre 1 y ${MAXIMO_LOTE} lecturas.` }, { status: 400 })
  }

  const lecturas: Lectura[] = []
  for (const [indice, entrada] of entradas.entries()) {
    const resultado = validar(entrada)
    if (typeof resultado === 'string') {
      return Response.json({ ok: false, error: entradas.length > 1 ? `Lectura ${indice + 1}: ${resultado}` : resultado }, { status: 400 })
    }
    lecturas.push(resultado)
  }

  const registradas = []
  for (const l of lecturas) {
    const { data, error } = await supabase.rpc('registrar_lectura_iiot', {
      p_dispositivo: l.dispositivo,
      p_centro_codigo: l.centro,
      p_temperatura: l.temperatura,
      p_presion: l.presion,
      p_humedad: l.humedad,
      p_piezas: l.piezas,
      p_estado: l.estado,
      p_mensaje: l.mensaje,
      p_potencia_kw: l.potenciaKw,
      p_energia_kwh: l.energiaKwh,
      p_registrado_en: l.registradoEn
    })
    if (error) return Response.json({ ok: false, error: error.message, registradas }, { status: 422 })
    registradas.push(data)
  }

  return Response.json({ ok: true, registradas }, { status: 201 })
}

// Prueba de conexión del dispositivo
export async function GET(request: Request) {
  if (!claveValida(request.headers.get('x-api-key'))) return respuestaNoAutorizado()
  return Response.json({ ok: true, servicio: 'NeumoPad ERP · IIoT', configurado: Boolean(clienteServicio()), hora: new Date().toISOString() })
}
