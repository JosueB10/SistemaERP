'use client'

import { AlertTriangle, Boxes } from 'lucide-react'

import type { MateriaPrima } from '@/lib/inventario/tipos'
import type { EstadoOperacion, EstadoOrden, LineaEstructura, Requerimiento, Subensamble } from '@/lib/produccion/tipos'
import { ETIQUETAS_ESTADO_OPERACION, ETIQUETAS_ESTADO_ORDEN, formatoPorcentaje, nivelOee } from '@/lib/produccion/utilidades'
import { useErrorProduccion } from '@/lib/produccion/store'
import { ABREVIATURAS_UNIDAD, formatoCantidad, formatoCordobas } from '@/lib/inventario/utilidades'
import { claseCabeceraTabla, claseCeldaTabla } from '../inventario/ui'

export const SECCION_PRODUCCION = { etiqueta: 'Producción', href: '/produccion' }

const estilosOperacion: Record<EstadoOperacion, string> = {
  pendiente: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20',
  en_proceso: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  completada: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
}

export function InsigniaOperacion({ estado }: { estado: EstadoOperacion }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${estilosOperacion[estado]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {ETIQUETAS_ESTADO_OPERACION[estado]}
    </span>
  )
}

const estilosOee = {
  positivo: 'text-emerald-700',
  alerta: 'text-amber-700',
  peligro: 'text-red-600'
}

// Porcentaje de OEE coloreado: ≥ 85 % clase mundial, 65–85 % aceptable, < 65 % bajo
export function ValorOee({ valor }: { valor: number }) {
  return <span className={`font-semibold tabular-nums ${estilosOee[nivelOee(valor)]}`}>{formatoPorcentaje(valor)}</span>
}

// Árbol de la BOM: producto → componentes (nivel 1) → materia prima de cada subensamble (nivel 2)
export function ArbolBom({
  estructura,
  subensambles,
  materiasPrimas,
  multiplicador = 1
}: {
  estructura: LineaEstructura[]
  subensambles: Subensamble[]
  materiasPrimas: MateriaPrima[]
  multiplicador?: number
}) {
  const materiaPorId = new Map(materiasPrimas.map((m) => [m.id, m]))
  const subPorId = new Map(subensambles.map((s) => [s.id, s]))
  const textoMateria = (id: string, cantidad: number) => {
    const materia = materiaPorId.get(id)
    return (
      <>
        <span className="font-medium text-zinc-800">{formatoCantidad(Math.round(cantidad * 1000) / 1000)} {materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''}</span>{' '}
        <span className="text-zinc-500">{materia?.nombre ?? 'Materia prima inactiva'}</span>
      </>
    )
  }
  return (
    <ul className="space-y-0.5 text-xs">
      {estructura.map((linea) => {
        if (linea.tipo === 'materia_prima') {
          return <li key={`mp-${linea.componenteId}`}>{textoMateria(linea.componenteId, linea.cantidad * multiplicador)}</li>
        }
        const sub = subPorId.get(linea.componenteId)
        return (
          <li key={`se-${linea.componenteId}`}>
            <span className="inline-flex items-center gap-1 font-medium text-zinc-900">
              <Boxes size={12} className="text-zinc-400" />
              {formatoCantidad(linea.cantidad * multiplicador)} und {sub?.nombre ?? 'Subensamble inactivo'}
            </span>
            <ul className="ml-2 mt-0.5 border-l border-zinc-200 pl-2.5 space-y-0.5">
              {(sub?.lineas ?? []).map((l) => (
                <li key={l.materiaPrimaId}>{textoMateria(l.materiaPrimaId, l.cantidad * linea.cantidad * multiplicador)}</li>
              ))}
            </ul>
          </li>
        )
      })}
    </ul>
  )
}

export function AvisoConexionProduccion() {
  const error = useErrorProduccion()
  if (!error) return null
  return <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Revisa la conexión de Supabase y que hayas aplicado la migración SQL de producción.</div>
}

const estilosOrden: Record<EstadoOrden, string> = {
  pendiente: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  en_proceso: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  completada: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  cancelada: 'bg-zinc-100 text-zinc-500 ring-zinc-500/20'
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
      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[560px]">
          <thead className="bg-zinc-50/70">
            <tr>
              <th className={claseCabeceraTabla}>Materia prima</th>
              <th className={`${claseCabeceraTabla} text-right`}>Por unidad</th>
              <th className={`${claseCabeceraTabla} text-right`}>Requerido ({formatoCantidad(cantidad)})</th>
              <th className={`${claseCabeceraTabla} text-right`}>Disponible</th>
              <th className={`${claseCabeceraTabla} text-right`}>Costo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {lineas.map((linea) => (
              <tr key={linea.materiaPrimaId} className={linea.faltante > 0 ? 'bg-red-50/50' : undefined}>
                <td className={claseCeldaTabla}>
                  <span className="font-mono text-xs text-zinc-400 mr-2">{linea.codigo}</span>
                  {linea.nombre}
                </td>
                <td className={`${claseCeldaTabla} text-right text-zinc-500`}>{formatoCantidad(linea.porUnidad)} {linea.unidad}</td>
                <td className={`${claseCeldaTabla} text-right font-semibold text-zinc-900`}>{formatoCantidad(linea.requerido)} {linea.unidad}</td>
                <td className={`${claseCeldaTabla} text-right ${linea.faltante > 0 ? 'text-red-600 font-medium' : 'text-zinc-500'}`}>
                  {formatoCantidad(linea.disponible)} {linea.unidad}
                </td>
                <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.costo)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-zinc-50">
            <tr>
              <td colSpan={4} className={`${claseCeldaTabla} text-right font-medium`}>Costo de materia prima</td>
              <td className={`${claseCeldaTabla} text-right font-semibold text-zinc-900`}>{formatoCordobas(total)}</td>
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
