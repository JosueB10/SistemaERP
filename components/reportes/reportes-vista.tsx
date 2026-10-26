'use client'

import { useState } from 'react'
import { Printer } from 'lucide-react'

import { AvisoConexionCompras } from '../compras/ui'
import { AvisoConexionFinanzas } from '../finanzas/ui'
import { AvisoConexion, Campo, claseBotonSecundario, claseInput, claseTarjeta, EncabezadoPagina } from '../inventario/ui'
import { AvisoConexionVentas } from '../ventas/ui'
import { formatoFecha, fechaHoy } from '@/lib/inventario/utilidades'
import { ETIQUETAS_PRESET, periodoDePreset, type Periodo, type PresetPeriodo } from '@/lib/reportes/calculos'
import ReporteActividad from './reporte-actividad'
import ReporteCompras from './reporte-compras'
import ReporteFlujo from './reporte-flujo'
import ReporteInventario from './reporte-inventario'
import ReporteProduccion from './reporte-produccion'
import ReporteResultados from './reporte-resultados'
import ReporteVentas from './reporte-ventas'

type TipoReporte = 'actividad' | 'resultados' | 'ventas' | 'compras' | 'flujo' | 'produccion' | 'inventario'

const REPORTES: Record<TipoReporte, { titulo: string; descripcion: string; archivo: string }> = {
  actividad: { titulo: 'Actividad', descripcion: 'Recopilación de lo hecho: compras, ventas, producción y material utilizado, con su documento de origen.', archivo: 'actividad' },
  resultados: { titulo: 'Estado de resultados', descripcion: 'Ventas, costo de ventas, gastos y utilidad del período.', archivo: 'estado-resultados' },
  ventas: { titulo: 'Ventas', descripcion: 'Qué se vendió, a quién y cómo se cobró.', archivo: 'reporte-ventas' },
  compras: { titulo: 'Compras', descripcion: 'Qué se compró y a qué proveedores.', archivo: 'reporte-compras' },
  flujo: { titulo: 'Flujo de caja', descripcion: 'Dinero que entró y salió, mes a mes.', archivo: 'flujo-caja' },
  produccion: { titulo: 'Producción', descripcion: 'Unidades fabricadas y su costo de materia prima.', archivo: 'reporte-produccion' },
  inventario: { titulo: 'Inventario valorizado', descripcion: 'Existencias actuales y su valor.', archivo: 'inventario-valorizado' }
}

function textoPeriodo({ desde, hasta }: Periodo) {
  if (!desde && !hasta) return 'Todo el historial'
  if (!desde) return `Hasta el ${formatoFecha(hasta)}`
  if (!hasta) return `Desde el ${formatoFecha(desde)}`
  return `Del ${formatoFecha(desde)} al ${formatoFecha(hasta)}`
}

export default function ReportesVista() {
  const [reporte, setReporte] = useState<TipoReporte>('actividad')
  const [preset, setPreset] = useState<PresetPeriodo>('este_mes')
  const [personalizado, setPersonalizado] = useState<Periodo>(() => periodoDePreset('este_mes'))

  const periodo = preset === 'personalizado' ? personalizado : periodoDePreset(preset)
  const info = REPORTES[reporte]
  const usaPeriodo = reporte !== 'inventario'
  const sufijo = usaPeriodo ? `${periodo.desde || 'inicio'}_${periodo.hasta || fechaHoy()}` : fechaHoy()
  const archivo = `${info.archivo}-${sufijo}`

  const cambiarPreset = (valor: PresetPeriodo) => {
    // Al pasar a personalizado se parte del período que se estaba viendo
    if (valor === 'personalizado' && preset !== 'personalizado') setPersonalizado(periodo)
    setPreset(valor)
  }

  return (
    <>
      <div className="print:hidden">
        <AvisoConexion />
        <AvisoConexionVentas />
        <AvisoConexionCompras />
        <AvisoConexionFinanzas />
        <EncabezadoPagina
          titulo="Reportes"
          descripcion="Informes del negocio por período, listos para imprimir o exportar a CSV."
          migas={false}
          acciones={
            <button type="button" onClick={() => window.print()} className={claseBotonSecundario}>
              <Printer size={16} />
              Imprimir
            </button>
          }
        />

        <div role="tablist" aria-label="Tipo de reporte" className="mb-4 flex gap-1 overflow-x-auto border-b border-stone-200">
          {(Object.keys(REPORTES) as TipoReporte[]).map((tipo) => (
            <button
              key={tipo}
              type="button"
              role="tab"
              aria-selected={reporte === tipo}
              onClick={() => setReporte(tipo)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                reporte === tipo ? 'border-stone-900 text-stone-900' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {REPORTES[tipo].titulo}
            </button>
          ))}
        </div>

        <div className={`${claseTarjeta} p-4 mb-6 flex flex-col gap-3 lg:flex-row lg:items-end`}>
          <div className="flex-1">
            <p className="font-semibold text-stone-900">{info.titulo}</p>
            <p className="text-xs text-stone-500">{info.descripcion}</p>
          </div>
          {usaPeriodo ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:w-[560px]">
              <Campo etiqueta="Período" htmlFor="rep-preset">
                <select id="rep-preset" value={preset} onChange={(e) => cambiarPreset(e.target.value as PresetPeriodo)} className={claseInput}>
                  {(Object.keys(ETIQUETAS_PRESET) as PresetPeriodo[]).map((p) => <option key={p} value={p}>{ETIQUETAS_PRESET[p]}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Desde" htmlFor="rep-desde">
                <input
                  id="rep-desde"
                  type="date"
                  value={periodo.desde}
                  disabled={preset !== 'personalizado'}
                  onChange={(e) => setPersonalizado((p) => ({ ...p, desde: e.target.value }))}
                  className={claseInput}
                />
              </Campo>
              <Campo etiqueta="Hasta" htmlFor="rep-hasta">
                <input
                  id="rep-hasta"
                  type="date"
                  value={periodo.hasta}
                  disabled={preset !== 'personalizado'}
                  onChange={(e) => setPersonalizado((p) => ({ ...p, hasta: e.target.value }))}
                  className={claseInput}
                />
              </Campo>
            </div>
          ) : (
            <p className="text-sm text-stone-500">Existencias al día de hoy</p>
          )}
        </div>
      </div>

      {/* Encabezado que solo aparece al imprimir */}
      <div className="hidden print:block mb-6 border-b border-stone-300 pb-3">
        <p className="text-xs uppercase tracking-wide text-stone-500">NeumoPad ERP</p>
        <h1 className="text-xl font-bold text-stone-900">{info.titulo}</h1>
        <p className="text-sm text-stone-600">
          {usaPeriodo ? textoPeriodo(periodo) : `Existencias al ${formatoFecha(fechaHoy())}`} · Generado el {formatoFecha(fechaHoy())}
        </p>
      </div>

      {usaPeriodo && periodo.desde && periodo.hasta && periodo.desde > periodo.hasta ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          La fecha inicial es posterior a la final. Corrija el período.
        </div>
      ) : (
        <>
          {reporte === 'actividad' && <ReporteActividad periodo={periodo} archivo={archivo} />}
          {reporte === 'resultados' && <ReporteResultados periodo={periodo} archivo={archivo} />}
          {reporte === 'ventas' && <ReporteVentas periodo={periodo} archivo={archivo} />}
          {reporte === 'compras' && <ReporteCompras periodo={periodo} archivo={archivo} />}
          {reporte === 'flujo' && <ReporteFlujo periodo={periodo} archivo={archivo} />}
          {reporte === 'produccion' && <ReporteProduccion periodo={periodo} archivo={archivo} />}
          {reporte === 'inventario' && <ReporteInventario archivo={archivo} />}
        </>
      )}
    </>
  )
}
