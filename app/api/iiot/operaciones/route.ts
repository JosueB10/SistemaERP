import { claveValida, clienteServicio, respuestaNoAutorizado, respuestaSinConfigurar } from '@/lib/iiot/servidor'

// Planta conectada: las máquinas preguntan qué operación tienen en proceso y avisan cuando la terminan.
//
// GET  /api/iiot/operaciones   → operaciones en proceso (centro, piezas que llegan, tiempos estándar)
// POST /api/iiot/operaciones   → termina una operación; la siguiente arranca sola y, si era la última,
//   { "operacion_id": 12, "buenas": 5, "rechazadas": 0, "paro_min": 3, "escala": 20, "motivo_paro": "Atasco" }
//   la orden se cierra y se crea el lote.

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!claveValida(request.headers.get('x-api-key'))) return respuestaNoAutorizado()
  const supabase = clienteServicio()
  if (!supabase) return respuestaSinConfigurar()
  const { data, error } = await supabase.rpc('operaciones_activas_iiot')
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 })
  return Response.json({ ok: true, operaciones: data ?? [] })
}

export async function POST(request: Request) {
  if (!claveValida(request.headers.get('x-api-key'))) return respuestaNoAutorizado()
  const supabase = clienteServicio()
  if (!supabase) return respuestaSinConfigurar()

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await request.json()
  } catch {
    return Response.json({ ok: false, error: 'El cuerpo no es JSON válido.' }, { status: 400 })
  }
  const operacionId = Number(cuerpo.operacion_id)
  const buenas = Number(cuerpo.buenas)
  const rechazadas = Number(cuerpo.rechazadas ?? 0)
  const paro = Number(cuerpo.paro_min ?? 0)
  const escala = Number(cuerpo.escala ?? 1)
  if (!Number.isInteger(operacionId) || operacionId <= 0) return Response.json({ ok: false, error: 'Falta "operacion_id".' }, { status: 400 })
  if (!Number.isInteger(buenas) || !Number.isInteger(rechazadas) || buenas < 0 || rechazadas < 0) {
    return Response.json({ ok: false, error: '"buenas" y "rechazadas" deben ser enteros no negativos.' }, { status: 400 })
  }
  if (!Number.isFinite(paro) || paro < 0 || !Number.isFinite(escala) || escala < 1 || escala > 1000) {
    return Response.json({ ok: false, error: '"paro_min" o "escala" no son válidos.' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('terminar_operacion_iiot', {
    p_operacion_id: operacionId,
    p_cantidad_buena: buenas,
    p_cantidad_rechazada: rechazadas,
    p_paro_min: paro,
    p_escala: escala,
    p_motivo_paro: typeof cuerpo.motivo_paro === 'string' ? cuerpo.motivo_paro.slice(0, 200) : null
  })
  if (error) return Response.json({ ok: false, error: error.message }, { status: 422 })
  return Response.json({ ok: true, resultado: data })
}
