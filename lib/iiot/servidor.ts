import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

// Utilidades de los endpoints IIoT (solo servidor): autenticación del dispositivo y cliente con la llave de servicio.

export function claveValida(recibida: string | null) {
  const esperada = process.env.IIOT_API_KEY
  if (!esperada || !recibida) return false
  const a = Buffer.from(recibida)
  const b = Buffer.from(esperada)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function clienteServicio() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !llave) return null
  return createClient(url, llave, { auth: { persistSession: false, autoRefreshToken: false } })
}

export const respuestaNoAutorizado = () =>
  Response.json({ ok: false, error: 'Clave de dispositivo no válida.' }, { status: 401 })

export const respuestaSinConfigurar = () =>
  Response.json({ ok: false, error: 'Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.' }, { status: 500 })
