'use client'

import { useErrorCompras } from '@/lib/compras/store'

export const SECCION_COMPRAS = { etiqueta: 'Compras', href: '/compras' }

export function AvisoConexionCompras() {
  const error = useErrorCompras()
  if (!error) return null
  return <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Revisa la conexión de Supabase y que hayas aplicado la migración SQL de ventas y compras.</div>
}
