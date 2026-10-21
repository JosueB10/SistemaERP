'use client'

import { Download, Receipt, Scale, TrendingUp, Wallet } from 'lucide-react'

import { useCompras } from '@/lib/compras/store'
import { useFinanzas } from '@/lib/finanzas/store'
import { formatoCordobas } from '@/lib/inventario/utilidades'
import { estadoResultados, porcentaje, type Periodo } from '@/lib/reportes/calculos'
import { useVentas } from '@/lib/ventas/store'
import { descargarCsv, TASA_IVA } from '@/lib/ventas/utilidades'
import { claseBotonTabla, claseTarjeta, TarjetaIndicador } from '../inventario/ui'
import { FilaEstado } from './ui'

export default function ReporteResultados({ periodo, archivo }: { periodo: Periodo; archivo: string }) {
  const { ventas } = useVentas()
  const { compras } = useCompras()
  const { ingresos, gastos } = useFinanzas()
  const er = estadoResultados(ventas, compras, ingresos, gastos, periodo)
  const ivaNeto = er.ivaCobrado - er.ivaPagado

  const exportar = () =>
    descargarCsv(`${archivo}.csv`, [
      ['Concepto', 'Monto'],
      ['Ventas brutas', er.ventasBrutas.toFixed(2)],
      ['(-) Descuentos', (-er.descuentos).toFixed(2)],
      ['Ventas netas', er.ventasNetas.toFixed(2)],
      ['(-) Costo de ventas', (-er.costoVentas).toFixed(2)],
      ['Utilidad bruta', er.utilidadBruta.toFixed(2)],
      ...er.otrosIngresos.map((f) => [`(+) ${f.categoria}`, f.total.toFixed(2)]),
      ['Total otros ingresos', er.totalOtrosIngresos.toFixed(2)],
      ...er.gastosOperativos.map((f) => [`(-) ${f.categoria}`, (-f.total).toFixed(2)]),
      ['Total gastos operativos', (-er.totalGastosOperativos).toFixed(2)],
      ['Utilidad neta antes de IR', er.utilidadNeta.toFixed(2)],
      [],
      ['IVA cobrado en ventas', er.ivaCobrado.toFixed(2)],
      ['IVA pagado en compras', er.ivaPagado.toFixed(2)],
      ['IVA neto estimado', ivaNeto.toFixed(2)]
    ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador titulo="Ventas netas" valor={formatoCordobas(er.ventasNetas)} detalle={`${er.cantidadVentas} venta(s), sin IVA`} icono={Wallet} />
        <TarjetaIndicador titulo="Utilidad bruta" valor={formatoCordobas(er.utilidadBruta)} detalle={`Margen bruto ${porcentaje(er.utilidadBruta, er.ventasNetas).toFixed(1)} %`} icono={TrendingUp} tono={er.utilidadBruta < 0 ? 'peligro' : 'positivo'} />
        <TarjetaIndicador titulo="Gastos operativos" valor={formatoCordobas(er.totalGastosOperativos)} detalle={`${porcentaje(er.totalGastosOperativos, er.ventasNetas).toFixed(1)} % de las ventas netas`} icono={Receipt} tono="alerta" />
        <TarjetaIndicador titulo="Utilidad neta" valor={formatoCordobas(er.utilidadNeta)} detalle={`Margen neto ${porcentaje(er.utilidadNeta, er.ventasNetas + er.totalOtrosIngresos).toFixed(1)} %`} icono={Scale} tono={er.utilidadNeta < 0 ? 'peligro' : 'positivo'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={`${claseTarjeta} xl:col-span-2 break-inside-avoid`}>
          <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4">
            <div>
              <h2 className="font-semibold text-stone-900">Estado de resultados</h2>
              <p className="text-xs text-stone-500 mt-0.5">Cifras sin IVA, en córdobas.</p>
            </div>
            <button type="button" onClick={exportar} className={`${claseBotonTabla} print:hidden`}>
              <Download size={14} />
              CSV
            </button>
          </div>
          <table className="w-full">
            <tbody>
              <FilaEstado etiqueta="Ventas brutas" monto={er.ventasBrutas} nivel="detalle" />
              <FilaEstado etiqueta="(-) Descuentos" monto={-er.descuentos} />
              <FilaEstado etiqueta="Ventas netas" monto={er.ventasNetas} nivel="subtotal" />
              <FilaEstado etiqueta="(-) Costo de ventas" monto={-er.costoVentas} nota="costo de producción de lo vendido" />
              <FilaEstado etiqueta="Utilidad bruta" monto={er.utilidadBruta} nivel="subtotal" />
              {er.otrosIngresos.map((f) => <FilaEstado key={`i-${f.categoria}`} etiqueta={`(+) ${f.categoria}`} monto={f.total} />)}
              <FilaEstado etiqueta="Otros ingresos" monto={er.totalOtrosIngresos} nivel="subtotal" />
              {er.gastosOperativos.map((f) => <FilaEstado key={`g-${f.categoria}`} etiqueta={`(-) ${f.categoria}`} monto={-f.total} />)}
              <FilaEstado etiqueta="Gastos operativos" monto={-er.totalGastosOperativos} nivel="subtotal" />
              <FilaEstado etiqueta="Utilidad neta antes de IR" monto={er.utilidadNeta} nivel="total" />
            </tbody>
          </table>
        </section>

        <div className="space-y-6 self-start">
          <section className={`${claseTarjeta} break-inside-avoid`}>
            <div className="border-b border-stone-200 px-5 py-4">
              <h2 className="font-semibold text-stone-900">IVA del período</h2>
              <p className="text-xs text-stone-500 mt-0.5">Tasa {TASA_IVA * 100} %. Referencia para la declaración.</p>
            </div>
            <table className="w-full">
              <tbody>
                <FilaEstado etiqueta="IVA cobrado en ventas" monto={er.ivaCobrado} />
                <FilaEstado etiqueta="(-) IVA pagado en compras" monto={-er.ivaPagado} />
                <FilaEstado etiqueta={ivaNeto >= 0 ? 'IVA neto a pagar' : 'Saldo a favor'} monto={Math.abs(ivaNeto)} nivel="subtotal" />
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-stone-200 bg-stone-50 px-5 py-4 text-xs text-stone-600 space-y-2 break-inside-avoid">
            <p className="font-medium text-stone-800">Cómo se calcula</p>
            <p>Las ventas se reconocen en su fecha, sin IVA, y su costo es el costo de producción del producto al momento de vender.</p>
            <p>Las compras de materia prima no se restan como gasto: se reflejan en el costo de ventas cuando el producto se vende. Para ver el dinero que salió por compras, use el reporte Flujo de caja.</p>
            <p>Gastos operativos incluye la nómina pagada (salarios y aportes patronales) y los gastos registrados en Finanzas. No incluye el IR anual.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
