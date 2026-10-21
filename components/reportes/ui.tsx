'use client'

import { Download } from 'lucide-react'

import { formatoCantidad, formatoCordobas } from '@/lib/inventario/utilidades'
import { descargarCsv } from '@/lib/ventas/utilidades'
import { claseBotonTabla, claseCabeceraTabla, claseCeldaTabla, claseTarjeta } from '../inventario/ui'

export type FormatoColumna = 'texto' | 'cordobas' | 'cantidad' | 'porcentaje'

export interface ColumnaReporte {
  etiqueta: string
  formato?: FormatoColumna
}

type Valor = string | number

function mostrar(valor: Valor, formato: FormatoColumna = 'texto') {
  if (typeof valor === 'string') return valor
  if (formato === 'cordobas') return formatoCordobas(valor)
  if (formato === 'porcentaje') return `${valor.toFixed(1)} %`
  return formatoCantidad(Math.round(valor * 1000) / 1000)
}

// En el CSV los números van sin formato para poder sumarlos en Excel
function crudo(valor: Valor, formato: FormatoColumna = 'texto') {
  if (typeof valor === 'string') return valor
  return formato === 'cordobas' || formato === 'porcentaje' ? valor.toFixed(2) : String(Math.round(valor * 1000) / 1000)
}

export function TablaReporte({
  titulo,
  descripcion,
  columnas,
  filas,
  totales,
  archivo,
  vacio = 'Sin datos en el período.'
}: {
  titulo: string
  descripcion?: string
  columnas: ColumnaReporte[]
  filas: Valor[][]
  totales?: Valor[]
  archivo: string
  vacio?: string
}) {
  const alineacion = (c: ColumnaReporte) => (c.formato && c.formato !== 'texto' ? 'text-right' : '')

  const exportar = () =>
    descargarCsv(`${archivo}.csv`, [
      columnas.map((c) => c.etiqueta),
      ...filas.map((fila) => fila.map((v, i) => crudo(v, columnas[i]?.formato))),
      ...(totales ? [totales.map((v, i) => crudo(v, columnas[i]?.formato))] : [])
    ])

  return (
    <section className={`${claseTarjeta} break-inside-avoid print:border-stone-300`}>
      <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-stone-900">{titulo}</h2>
          {descripcion && <p className="text-xs text-stone-500 mt-0.5">{descripcion}</p>}
        </div>
        {filas.length > 0 && (
          <button type="button" onClick={exportar} className={`${claseBotonTabla} print:hidden`}>
            <Download size={14} />
            CSV
          </button>
        )}
      </div>
      {filas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-stone-400">{vacio}</p>
      ) : (
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                {columnas.map((c) => (
                  <th key={c.etiqueta} className={`${claseCabeceraTabla} ${alineacion(c)}`}>{c.etiqueta}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.map((fila, i) => (
                <tr key={i}>
                  {fila.map((valor, j) => (
                    <td key={j} className={`${claseCeldaTabla} ${alineacion(columnas[j])} ${j === 0 ? 'font-medium text-stone-900' : ''}`}>
                      {mostrar(valor, columnas[j]?.formato)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totales && (
              <tfoot className="bg-stone-50 border-t border-stone-200">
                <tr>
                  {totales.map((valor, j) => (
                    <td key={j} className={`${claseCeldaTabla} font-semibold text-stone-900 ${alineacion(columnas[j])}`}>
                      {mostrar(valor, columnas[j]?.formato)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}

// Fila de un estado financiero: detalle sangrado, subtotales y total resaltados
export function FilaEstado({
  etiqueta,
  monto,
  nivel = 'detalle',
  nota
}: {
  etiqueta: string
  monto: number
  nivel?: 'detalle' | 'subtotal' | 'total'
  nota?: string
}) {
  const estilos = {
    detalle: 'pl-8 text-stone-600',
    subtotal: 'font-semibold text-stone-900 bg-stone-50',
    total: 'font-bold text-stone-900 bg-stone-100 text-base'
  }
  return (
    <tr className={nivel === 'detalle' ? '' : 'border-t border-stone-200'}>
      <td className={`px-5 py-2.5 text-sm ${estilos[nivel]}`}>
        {etiqueta}
        {nota && <span className="ml-2 text-xs font-normal text-stone-400">{nota}</span>}
      </td>
      <td className={`px-5 py-2.5 text-sm text-right whitespace-nowrap ${estilos[nivel]} ${monto < 0 && nivel !== 'detalle' ? 'text-red-600' : ''}`}>
        {formatoCordobas(monto)}
      </td>
    </tr>
  )
}
