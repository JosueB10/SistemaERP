'use client'

import { AlertTriangle } from 'lucide-react'

import type { EstadoOrden, Requerimiento } from '@/lib/produccion/tipos'
import { ETIQUETAS_ESTADO_ORDEN } from '@/lib/produccion/utilidades'
import { useErrorProduccion } from '@/lib/produccion/store'
import { formatoCantidad, formatoCordobas } from '@/lib/inventario/utilidades'
import { claseCabeceraTabla, claseCeldaTabla } from '../inventario/ui'

export const SECCION_PRODUCCION = { etiqueta: 'Producción', href: '/produccion' }

export function AvisoConexionProduccion() {
  const error = useErrorProduccion()
  if (!error) return null
  return <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Revisa la conexión de Supabase y que hayas aplicado la migración SQL de producción.</div>
}

const estilosOrden: Record<EstadoOrden, string> = {
  pendiente: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  en_proceso: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  completada: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  cancelada: 'bg-stone-100 text-stone-500 ring-stone-500/20'
}

export function InsigniaOrden({ estado }: { estado: EstadoOrden }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${estilosOrden[estado]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {ETIQUETAS_ESTADO_ORDEN[estado]}
    </span>
  )
}

// Tabla de materia prima necesaria vs. disponible para una cantidad de producto
export function TablaRequerimientos({ lineas, cantidad }: { lineas: Requerimiento[]; cantidad: number }) {
  const total = lineas.reduce((suma, linea) => suma + linea.costo, 0)
  const faltantes = lineas.filter((linea) => linea.faltante > 0)
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[560px]">
          <thead className="bg-stone-50">
            <tr>
              <th className={claseCabeceraTabla}>Materia prima</th>
              <th className={`${claseCabeceraTabla} text-right`}>Por unidad</th>
              <th className={`${claseCabeceraTabla} text-right`}>Requerido ({formatoCantidad(cantidad)})</th>
              <th className={`${claseCabeceraTabla} text-right`}>Disponible</th>
              <th className={`${claseCabeceraTabla} text-right`}>Costo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lineas.map((linea) => (
              <tr key={linea.materiaPrimaId} className={linea.faltante > 0 ? 'bg-red-50/50' : undefined}>
                <td className={claseCeldaTabla}>
                  <span className="font-mono text-xs text-stone-400 mr-2">{linea.codigo}</span>
                  {linea.nombre}
                </td>
                <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCantidad(linea.porUnidad)} {linea.unidad}</td>
                <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCantidad(linea.requerido)} {linea.unidad}</td>
                <td className={`${claseCeldaTabla} text-right ${linea.faltante > 0 ? 'text-red-600 font-medium' : 'text-stone-500'}`}>
                  {formatoCantidad(linea.disponible)} {linea.unidad}
                </td>
                <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.costo)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-stone-50">
            <tr>
              <td colSpan={4} className={`${claseCeldaTabla} text-right font-medium`}>Costo de materia prima</td>
              <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCordobas(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {faltantes.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-red-600">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Falta materia prima: {faltantes.map((linea) => `${linea.nombre} (${formatoCantidad(linea.faltante)} ${linea.unidad})`).join(', ')}.
        </p>
      )}
    </div>
  )
}
