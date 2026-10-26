'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, ExternalLink, Factory, Package, ShoppingCart, Truck } from 'lucide-react'

import { consumoMateriaPrima, ETIQUETAS_MODULO, eventosDelPeriodo, type ModuloActividad } from '@/lib/actividad/eventos'
import { useActividad, useFuentesActividad } from '@/lib/actividad/store'
import { formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { comprasDelPeriodo, ventasDelPeriodo, type Periodo } from '@/lib/reportes/calculos'
import { descargarCsv } from '@/lib/ventas/utilidades'
import { claseBotonTabla, claseCabeceraTabla, claseCeldaTabla, claseInput, claseTarjeta, Paginacion, TarjetaIndicador, usePaginacion } from '../inventario/ui'
import { TablaReporte } from './ui'

// Recopilación de todo lo hecho en el período: compras, ventas, producción, material utilizado y
// movimientos manuales, cada uno con el documento del que salió.
export default function ReporteActividad({ periodo, archivo }: { periodo: Periodo; archivo: string }) {
  const fuentes = useFuentesActividad()
  const eventos = eventosDelPeriodo(useActividad(), periodo)
  const [modulo, setModulo] = useState<ModuloActividad | ''>('')

  const ventas = ventasDelPeriodo(fuentes.ventas.ventas, periodo)
  const compras = comprasDelPeriodo(fuentes.compras.compras, periodo)
  const completadas = eventos.filter((e) => e.tipo === 'orden_completada')
  const unidades = fuentes.produccion.ordenes
    .filter((o) => completadas.some((e) => e.clave === `orden-completada-${o.id}`))
    .reduce((t, o) => t + o.cantidadProducida, 0)
  const consumo = consumoMateriaPrima(fuentes.inventario, periodo)
  const costoConsumo = consumo.reduce((t, c) => t + c.costo, 0)

  const filtrados = modulo ? eventos.filter((e) => e.modulo === modulo) : eventos
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtrados, 20)

  const exportar = () =>
    descargarCsv(`${archivo}-bitacora.csv`, [
      ['Fecha', 'Módulo', 'Actividad', 'Detalle', 'Monto', 'Documento de origen'],
      ...filtrados.map((e) => [e.fecha, ETIQUETAS_MODULO[e.modulo], e.titulo, e.detalle, e.monto === undefined ? '' : e.monto.toFixed(2), e.documento])
    ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador titulo="Ventas" valor={formatoCordobas(ventas.reduce((t, v) => t + v.total, 0))} detalle={`${ventas.length} venta(s) completada(s)`} icono={ShoppingCart} tono="positivo" />
        <TarjetaIndicador titulo="Compras" valor={formatoCordobas(compras.reduce((t, c) => t + c.total, 0))} detalle={`${compras.length} compra(s) recibida(s)`} icono={Truck} />
        <TarjetaIndicador titulo="Producción" valor={`${formatoCantidad(unidades)} und`} detalle={`${completadas.length} orden(es) completada(s)`} icono={Factory} />
        <TarjetaIndicador titulo="Material utilizado" valor={formatoCordobas(costoConsumo)} detalle={`${consumo.length} materia(s) prima(s)`} icono={Package} tono={consumo.length ? 'alerta' : 'neutro'} />
      </div>

      <TablaReporte
        titulo="Materia prima utilizada"
        descripcion="Salidas de materia prima del período según el inventario, separadas por de dónde salieron. Valorizado al costo unitario actual."
        archivo={`${archivo}-material-utilizado`}
        columnas={[
          { etiqueta: 'Materia prima' },
          { etiqueta: 'Unidad' },
          { etiqueta: 'En producción', formato: 'cantidad' },
          { etiqueta: 'Fabricado al vender', formato: 'cantidad' },
          { etiqueta: 'Salidas manuales', formato: 'cantidad' },
          { etiqueta: 'Total utilizado', formato: 'cantidad' },
          { etiqueta: 'Costo', formato: 'cordobas' },
          { etiqueta: 'Documentos de origen' }
        ]}
        filas={consumo.map((c) => [
          c.nombre,
          c.unidad,
          c.enProduccion,
          c.enVentas,
          c.otrasSalidas,
          c.cantidad,
          c.costo,
          c.documentos.length > 4 ? `${c.documentos.slice(0, 4).join(', ')} y ${c.documentos.length - 4} más` : c.documentos.join(', ') || '—'
        ])}
        totales={['Total', '', '', '', '', '', costoConsumo, '']}
        vacio="No se utilizó materia prima en el período."
      />

      <section className={`${claseTarjeta} print:border-zinc-300`}>
        <div className="flex flex-col gap-3 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="font-semibold text-zinc-900">Bitácora de actividad</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Todo lo registrado en el período, de lo más reciente a lo más antiguo. Pulse el documento para ver de dónde salió.</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <select value={modulo} onChange={(e) => { setModulo(e.target.value as ModuloActividad | ''); setPagina(1) }} className={`${claseInput} h-9 sm:w-44`} aria-label="Filtrar por módulo">
              <option value="">Todos los módulos</option>
              {(Object.keys(ETIQUETAS_MODULO) as ModuloActividad[]).map((m) => <option key={m} value={m}>{ETIQUETAS_MODULO[m]}</option>)}
            </select>
            {filtrados.length > 0 && (
              <button type="button" onClick={exportar} className={claseBotonTabla}>
                <Download size={14} />
                CSV
              </button>
            )}
          </div>
        </div>
        {filtrados.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-400">No hay actividad registrada en el período.</p>
        ) : (
          <>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[860px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Fecha</th>
                    <th className={claseCabeceraTabla}>Módulo</th>
                    <th className={claseCabeceraTabla}>Actividad</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Monto</th>
                    <th className={claseCabeceraTabla}>Origen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visibles.map((e) => (
                    <tr key={e.clave} className="align-top">
                      <td className={claseCeldaTabla}>{formatoFecha(e.fecha)}</td>
                      <td className={claseCeldaTabla}>
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">{ETIQUETAS_MODULO[e.modulo]}</span>
                      </td>
                      <td className={`${claseCeldaTabla} whitespace-normal`}>
                        <p className="font-medium text-zinc-900">{e.titulo}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{e.detalle}</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right ${e.monto !== undefined && e.monto < 0 ? 'text-red-600' : ''}`}>
                        {e.monto === undefined ? '—' : formatoCordobas(e.monto)}
                      </td>
                      <td className={claseCeldaTabla}>
                        <Link href={e.href} className="inline-flex items-center gap-1 font-mono text-xs text-zinc-700 underline-offset-2 hover:underline">
                          {e.documento}
                          <ExternalLink size={12} className="print:hidden" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="print:hidden">
              <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtrados.length} onCambiar={setPagina} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}
