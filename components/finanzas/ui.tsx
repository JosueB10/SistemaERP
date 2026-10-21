'use client'

import Link from 'next/link'

import { useErrorFinanzas } from '@/lib/finanzas/store'
import type { MovimientoFinanciero } from '@/lib/finanzas/tipos'
import { documentoOrigen, ETIQUETAS_ORIGEN } from '@/lib/finanzas/utilidades'
import { formatoCordobas } from '@/lib/inventario/utilidades'

export const SECCION_FINANZAS = { etiqueta: 'Finanzas', href: '/finanzas' }

export function AvisoConexionFinanzas() {
  const error = useErrorFinanzas()
  if (!error) return null
  return <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Revisa la conexión de Supabase y que hayas aplicado la migración SQL de finanzas.</div>
}

// Origen del registro; los automáticos enlazan a su documento
export function OrigenMovimiento({ movimiento }: { movimiento: MovimientoFinanciero }) {
  const documento = documentoOrigen(movimiento)
  if (!documento) {
    return <span className="inline-flex px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-xs font-medium">{ETIQUETAS_ORIGEN[movimiento.origen]}</span>
  }
  return (
    <Link href={documento.href} className="inline-flex px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 text-xs font-medium hover:bg-sky-100 whitespace-nowrap">
      {movimiento.origen === 'nomina' ? 'Nómina' : documento.texto}
    </Link>
  )
}

// Barras horizontales de una sola serie: magnitud por categoría
export function BarrasCategoria({
  filas,
  color = '#2a78d6',
  vacio
}: {
  filas: { etiqueta: string; total: number; detalle?: string }[]
  color?: string
  vacio: string
}) {
  if (filas.length === 0) return <p className="px-5 py-6 text-sm text-stone-400">{vacio}</p>
  const maximo = Math.max(...filas.map((f) => f.total))
  const suma = filas.reduce((t, f) => t + f.total, 0)
  return (
    <ul className="space-y-3 px-5 py-4">
      {filas.map((fila) => (
        <li key={fila.etiqueta} className="text-sm">
          <div className="flex justify-between gap-3 mb-1">
            <span className="text-stone-700 truncate">{fila.etiqueta}</span>
            <span className="font-medium text-stone-900 whitespace-nowrap">
              {formatoCordobas(fila.total)}
              <span className="ml-1.5 text-xs font-normal text-stone-400">{suma > 0 ? Math.round((fila.total / suma) * 100) : 0} %</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-stone-100">
            <div className="h-2 rounded-full" style={{ width: `${maximo > 0 ? Math.max(2, (fila.total / maximo) * 100) : 0}%`, backgroundColor: color }} />
          </div>
          {fila.detalle && <p className="text-xs text-stone-400 mt-1">{fila.detalle}</p>}
        </li>
      ))}
    </ul>
  )
}
