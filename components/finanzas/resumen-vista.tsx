'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, Landmark, Scale } from 'lucide-react'

import { useFinanzas } from '@/lib/finanzas/store'
import {
  etiquetaMesCorta,
  etiquetaMesLarga,
  flujoMensual,
  mesAnterior,
  sumaMontos,
  totalesPorCategoria,
  ultimosMeses
} from '@/lib/finanzas/utilidades'
import { fechaHoy, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import {
  Campo,
  claseBotonSecundario,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  TarjetaIndicador
} from '../inventario/ui'
import GraficoColumnas, { COLOR_SERIE } from './grafico-columnas'
import { AvisoConexionFinanzas, BarrasCategoria, OrigenMovimiento } from './ui'

function variacion(actual: number, anterior: number) {
  if (anterior === 0) return actual === 0 ? 'Igual que el mes anterior' : 'Sin datos del mes anterior'
  const cambio = ((actual - anterior) / Math.abs(anterior)) * 100
  return `${cambio >= 0 ? '+' : ''}${cambio.toFixed(0)} % vs. mes anterior`
}

export default function ResumenFinanzasVista() {
  const { ingresos, gastos } = useFinanzas()
  const [mes, setMes] = useState(fechaHoy().slice(0, 7))

  const meses = useMemo(() => ultimosMeses(mes, 12), [mes])
  const flujo = useMemo(() => flujoMensual(ingresos, gastos, meses), [ingresos, gastos, meses])
  const actual = flujo[flujo.length - 1]
  const previo = flujoMensual(ingresos, gastos, [mesAnterior(mes)])[0]

  const ingresosMes = useMemo(() => ingresos.filter((m) => m.fecha.startsWith(mes)), [ingresos, mes])
  const gastosMes = useMemo(() => gastos.filter((m) => m.fecha.startsWith(mes)), [gastos, mes])
  // Lo acumulado hasta el final del mes elegido
  const acumulado = sumaMontos(ingresos.filter((m) => m.fecha.slice(0, 7) <= mes)) - sumaMontos(gastos.filter((m) => m.fecha.slice(0, 7) <= mes))

  const recientes = useMemo(
    () => [...ingresosMes, ...gastosMes].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.registradoEn.localeCompare(a.registradoEn)).slice(0, 10),
    [ingresosMes, gastosMes]
  )
  const hayDatos = ingresos.length > 0 || gastos.length > 0

  return (
    <>
      <AvisoConexionFinanzas />
      <EncabezadoPagina
        titulo="Resumen financiero"
        descripcion="Flujo de caja: lo que entra por ventas y otros ingresos frente a lo que sale por compras, nómina y gastos."
        migas={false}
        acciones={
          <>
            <Link href="/finanzas/ingresos" className={claseBotonSecundario}><ArrowUpCircle size={16} />Ingresos</Link>
            <Link href="/finanzas/gastos" className={claseBotonSecundario}><ArrowDownCircle size={16} />Gastos</Link>
          </>
        }
      />

      <div className={`${claseTarjeta} p-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`}>
        <Campo etiqueta="Mes" htmlFor="fin-mes" className="sm:w-56">
          <input id="fin-mes" type="month" value={mes} max={fechaHoy().slice(0, 7)} onChange={(e) => setMes(e.target.value || fechaHoy().slice(0, 7))} className={claseInput} />
        </Campo>
        <p className="text-sm text-stone-500">Mostrando <span className="font-medium text-stone-900">{etiquetaMesLarga(mes)}</span></p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <TarjetaIndicador titulo="Ingresos del mes" valor={formatoCordobas(actual.ingresos)} detalle={variacion(actual.ingresos, previo.ingresos)} icono={ArrowUpCircle} tono="positivo" />
        <TarjetaIndicador titulo="Gastos del mes" valor={formatoCordobas(actual.gastos)} detalle={variacion(actual.gastos, previo.gastos)} icono={ArrowDownCircle} tono="alerta" />
        <TarjetaIndicador
          titulo="Flujo neto del mes"
          valor={formatoCordobas(actual.neto)}
          detalle={actual.ingresos > 0 ? `${((actual.neto / actual.ingresos) * 100).toFixed(0)} % de los ingresos` : 'Ingresos menos gastos'}
          icono={Scale}
          tono={actual.neto < 0 ? 'peligro' : 'positivo'}
        />
        <TarjetaIndicador titulo="Flujo acumulado" valor={formatoCordobas(acumulado)} detalle={`Desde el inicio hasta ${etiquetaMesCorta(mes)}`} icono={Landmark} tono={acumulado < 0 ? 'peligro' : 'neutro'} />
      </div>

      <section className={`${claseTarjeta} p-5 mb-6`}>
        <h2 className="font-semibold text-stone-900">Ingresos y gastos por mes</h2>
        <p className="text-xs text-stone-500 mb-5">Últimos 12 meses hasta {etiquetaMesLarga(mes)}</p>
        {hayDatos ? (
          <GraficoColumnas
            descripcion="Ingresos y gastos por mes"
            categorias={meses.map(etiquetaMesCorta)}
            formato={formatoCordobas}
            series={[
              { nombre: 'Ingresos', color: COLOR_SERIE.primaria, valores: flujo.map((f) => f.ingresos) },
              { nombre: 'Gastos', color: COLOR_SERIE.secundaria, valores: flujo.map((f) => f.gastos) }
            ]}
          />
        ) : (
          <EstadoVacio icono={Scale} titulo="Aún no hay movimientos financieros" descripcion="Las ventas, compras y nóminas pagadas aparecerán aquí automáticamente." />
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        <section className={claseTarjeta}>
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="font-semibold text-stone-900">Ingresos por categoría</h2>
            <p className="text-xs text-stone-500">{etiquetaMesLarga(mes)}</p>
          </div>
          <BarrasCategoria filas={totalesPorCategoria(ingresosMes).map((f) => ({ etiqueta: f.categoria, total: f.total }))} color={COLOR_SERIE.primaria} vacio="Sin ingresos este mes." />
        </section>
        <section className={claseTarjeta}>
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="font-semibold text-stone-900">Gastos por categoría</h2>
            <p className="text-xs text-stone-500">{etiquetaMesLarga(mes)}</p>
          </div>
          <BarrasCategoria filas={totalesPorCategoria(gastosMes).map((f) => ({ etiqueta: f.categoria, total: f.total }))} color={COLOR_SERIE.secundaria} vacio="Sin gastos este mes." />
        </section>
      </div>

      <section className={claseTarjeta}>
        <div className="border-b border-stone-200 px-5 py-4">
          <h2 className="font-semibold text-stone-900">Movimientos del mes</h2>
        </div>
        {recientes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-stone-400">Sin movimientos en {etiquetaMesLarga(mes)}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Fecha</th>
                  <th className={claseCabeceraTabla}>Concepto</th>
                  <th className={claseCabeceraTabla}>Categoría</th>
                  <th className={claseCabeceraTabla}>Origen</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recientes.map((m) => (
                  <tr key={`${m.tipo}-${m.id}`}>
                    <td className={claseCeldaTabla}>{formatoFecha(m.fecha)}</td>
                    <td className={`${claseCeldaTabla} font-medium text-stone-900`}>{m.concepto}</td>
                    <td className={claseCeldaTabla}>{m.categoria}</td>
                    <td className={claseCeldaTabla}><OrigenMovimiento movimiento={m} /></td>
                    <td className={`${claseCeldaTabla} text-right font-semibold ${m.tipo === 'ingreso' ? 'text-emerald-700' : 'text-stone-900'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{formatoCordobas(m.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
