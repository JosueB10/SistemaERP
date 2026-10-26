'use client'

import { ArrowDownCircle, ArrowUpCircle, Scale } from 'lucide-react'

import { useFinanzas } from '@/lib/finanzas/store'
import { enRango, etiquetaMesCorta, etiquetaMesLarga, flujoMensual, sumaMontos, totalesPorCategoria } from '@/lib/finanzas/utilidades'
import { formatoCordobas } from '@/lib/inventario/utilidades'
import { mesesDelPeriodo, porcentaje, type Periodo } from '@/lib/reportes/calculos'
import { claseTarjeta, TarjetaIndicador } from '../inventario/ui'
import GraficoColumnas, { COLOR_SERIE } from '../finanzas/grafico-columnas'
import { TablaReporte } from './ui'

export default function ReporteFlujo({ periodo, archivo }: { periodo: Periodo; archivo: string }) {
  const { ingresos, gastos } = useFinanzas()

  const ingresosPeriodo = ingresos.filter((m) => enRango(m.fecha, periodo.desde, periodo.hasta))
  const gastosPeriodo = gastos.filter((m) => enRango(m.fecha, periodo.desde, periodo.hasta))
  const totalIngresos = sumaMontos(ingresosPeriodo)
  const totalGastos = sumaMontos(gastosPeriodo)
  const meses = mesesDelPeriodo(periodo, [...ingresos, ...gastos].map((m) => m.fecha))
  const flujo = flujoMensual(ingresosPeriodo, gastosPeriodo, meses)
  const mesesGrafico = flujo.slice(-24)

  const filasMes = flujo.map((f, i) => {
    const acumulado = flujo.slice(0, i + 1).reduce((t, m) => t + m.neto, 0)
    return [etiquetaMesLarga(f.mes), f.ingresos, f.gastos, f.neto, acumulado]
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TarjetaIndicador titulo="Entradas" valor={formatoCordobas(totalIngresos)} detalle={`${ingresosPeriodo.length} ingreso(s)`} icono={ArrowUpCircle} tono="positivo" />
        <TarjetaIndicador titulo="Salidas" valor={formatoCordobas(totalGastos)} detalle={`${gastosPeriodo.length} gasto(s)`} icono={ArrowDownCircle} tono="alerta" />
        <TarjetaIndicador titulo="Flujo neto" valor={formatoCordobas(totalIngresos - totalGastos)} detalle="Entradas menos salidas" icono={Scale} tono={totalIngresos - totalGastos < 0 ? 'peligro' : 'positivo'} />
      </div>

      {mesesGrafico.length > 1 && (
        <section className={`${claseTarjeta} p-5 break-inside-avoid`}>
          <h2 className="font-semibold text-zinc-900">Entradas y salidas por mes</h2>
          <p className="text-xs text-zinc-500 mb-5">Montos con IVA, tal como entró o salió el dinero{flujo.length > mesesGrafico.length ? ' · últimos 24 meses del período' : ''}</p>
          <GraficoColumnas
            descripcion="Entradas y salidas por mes"
            categorias={mesesGrafico.map((f) => etiquetaMesCorta(f.mes))}
            formato={formatoCordobas}
            series={[
              { nombre: 'Entradas', color: COLOR_SERIE.primaria, valores: mesesGrafico.map((f) => f.ingresos) },
              { nombre: 'Salidas', color: COLOR_SERIE.secundaria, valores: mesesGrafico.map((f) => f.gastos) }
            ]}
          />
        </section>
      )}

      <TablaReporte
        titulo="Flujo por mes"
        archivo={`${archivo}-por-mes`}
        columnas={[
          { etiqueta: 'Mes' },
          { etiqueta: 'Entradas', formato: 'cordobas' },
          { etiqueta: 'Salidas', formato: 'cordobas' },
          { etiqueta: 'Neto', formato: 'cordobas' },
          { etiqueta: 'Acumulado del período', formato: 'cordobas' }
        ]}
        filas={filasMes}
        totales={['Total', totalIngresos, totalGastos, totalIngresos - totalGastos, '']}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TablaReporte
          titulo="Entradas por categoría"
          archivo={`${archivo}-entradas`}
          columnas={[{ etiqueta: 'Categoría' }, { etiqueta: 'Total', formato: 'cordobas' }, { etiqueta: '% del total', formato: 'porcentaje' }]}
          filas={totalesPorCategoria(ingresosPeriodo).map((f) => [f.categoria, f.total, porcentaje(f.total, totalIngresos)])}
        />
        <TablaReporte
          titulo="Salidas por categoría"
          archivo={`${archivo}-salidas`}
          columnas={[{ etiqueta: 'Categoría' }, { etiqueta: 'Total', formato: 'cordobas' }, { etiqueta: '% del total', formato: 'porcentaje' }]}
          filas={totalesPorCategoria(gastosPeriodo).map((f) => [f.categoria, f.total, porcentaje(f.total, totalGastos)])}
        />
      </div>
    </div>
  )
}
