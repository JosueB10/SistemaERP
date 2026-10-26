'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Eye, History, Package, Wallet } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { costoUnitarioOrden, fechaReferenciaOrden } from '@/lib/produccion/utilidades'
import {
  AvisoConexion,
  Campo,
  claseBotonTabla,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  Modal,
  Paginacion,
  TarjetaIndicador,
  usePaginacion
} from '../inventario/ui'
import OrdenDetalle from './orden-detalle'
import { AvisoConexionProduccion, InsigniaOrden, SECCION_PRODUCCION } from './ui'

type FiltroCierre = '' | 'completada' | 'cancelada'

export default function HistorialVista() {
  const { productos } = useInventario()
  const { ordenes, responsables } = useProduccion()

  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [productoId, setProductoId] = useState('')
  const [estado, setEstado] = useState<FiltroCierre>('')
  const [detalleId, setDetalleId] = useState<string | null>(null)

  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const responsablePorId = useMemo(() => new Map(responsables.map((r) => [r.id, r])), [responsables])

  const cerradas = useMemo(
    () =>
      ordenes
        .filter((o) => o.estado === 'completada' || o.estado === 'cancelada')
        .filter((o) => {
          const fecha = fechaReferenciaOrden(o)
          return (!desde || fecha >= desde) && (!hasta || fecha <= hasta) && (!productoId || o.productoId === productoId) && (!estado || o.estado === estado)
        })
        .sort((a, b) => fechaReferenciaOrden(b).localeCompare(fechaReferenciaOrden(a)) || Number(b.id) - Number(a.id)),
    [ordenes, desde, hasta, productoId, estado]
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(cerradas, 12)

  const completadas = cerradas.filter((o) => o.estado === 'completada')
  const unidades = completadas.reduce((t, o) => t + o.cantidadProducida, 0)
  const costo = completadas.reduce((t, o) => t + o.costoMateriales, 0)

  const porProducto = (() => {
    const mapa = new Map<string, { unidades: number; costo: number; ordenes: number }>()
    completadas.forEach((o) => {
      const actual = mapa.get(o.productoId) ?? { unidades: 0, costo: 0, ordenes: 0 }
      mapa.set(o.productoId, { unidades: actual.unidades + o.cantidadProducida, costo: actual.costo + o.costoMateriales, ordenes: actual.ordenes + 1 })
    })
    return Array.from(mapa, ([id, datos]) => ({ id, ...datos })).sort((a, b) => b.unidades - a.unidades)
  })()

  const ordenDetalle = detalleId ? ordenes.find((o) => o.id === detalleId) : undefined
  const hayFiltros = desde || hasta || productoId || estado

  return (
    <>
      <AvisoConexion />
      <AvisoConexionProduccion />
      <EncabezadoPagina titulo="Historial de producción" descripcion="Órdenes completadas y canceladas, con su consumo real de materia prima." seccion={SECCION_PRODUCCION} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Órdenes completadas" valor={String(completadas.length)} detalle={`${cerradas.length - completadas.length} cancelada(s)`} icono={CheckCircle2} tono="positivo" />
        <TarjetaIndicador titulo="Unidades producidas" valor={`${formatoCantidad(unidades)} und`} detalle={hayFiltros ? 'Según los filtros' : 'Desde el inicio'} icono={Package} />
        <TarjetaIndicador titulo="Costo de materia prima" valor={formatoCordobas(costo)} detalle={unidades ? `${formatoCordobas(costo / unidades)} por unidad en promedio` : 'Sin producción'} icono={Wallet} />
      </div>

      <div className={`${claseTarjeta} p-4 mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        <Campo etiqueta="Desde" htmlFor="hist-desde">
          <input id="hist-desde" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Hasta" htmlFor="hist-hasta">
          <input id="hist-hasta" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Producto" htmlFor="hist-producto">
          <select id="hist-producto" value={productoId} onChange={(e) => { setProductoId(e.target.value); setPagina(1) }} className={claseInput}>
            <option value="">Todos</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Estado" htmlFor="hist-estado">
          <select id="hist-estado" value={estado} onChange={(e) => { setEstado(e.target.value as FiltroCierre); setPagina(1) }} className={claseInput}>
            <option value="">Completadas y canceladas</option>
            <option value="completada">Completadas</option>
            <option value="cancelada">Canceladas</option>
          </select>
        </Campo>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={`${claseTarjeta} xl:col-span-2`}>
          {cerradas.length === 0 ? (
            <EstadoVacio icono={History} titulo="Sin órdenes cerradas" descripcion={hayFiltros ? 'Pruebe con otros filtros.' : 'Las órdenes completadas o canceladas aparecerán aquí.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Fecha</th>
                    <th className={claseCabeceraTabla}>Orden</th>
                    <th className={claseCabeceraTabla}>Producto</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Producido</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Costo MP</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Por unidad</th>
                    <th className={claseCabeceraTabla}>Estado</th>
                    <th className={`${claseCabeceraTabla} text-right`} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visibles.map((o) => (
                    <tr key={o.id} className="hover:bg-zinc-50/60">
                      <td className={claseCeldaTabla}>{formatoFecha(fechaReferenciaOrden(o))}</td>
                      <td className={`${claseCeldaTabla} font-mono text-xs`}>{o.codigo}</td>
                      <td className={claseCeldaTabla}>
                        <p className="font-medium text-zinc-900">{productoPorId.get(o.productoId)?.nombre ?? 'Producto inactivo'}</p>
                        <p className="text-xs text-zinc-400">{responsablePorId.get(o.empleadoId ?? '')?.nombre ?? 'Sin responsable'}</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{o.estado === 'completada' ? `${formatoCantidad(o.cantidadProducida)} und` : '—'}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{o.estado === 'completada' ? formatoCordobas(o.costoMateriales) : '—'}</td>
                      <td className={`${claseCeldaTabla} text-right text-zinc-500`}>{o.estado === 'completada' ? formatoCordobas(costoUnitarioOrden(o)) : '—'}</td>
                      <td className={claseCeldaTabla}><InsigniaOrden estado={o.estado} /></td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <button type="button" onClick={() => setDetalleId(o.id)} className={claseBotonTabla}><Eye size={14} />Ver</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={cerradas.length} onCambiar={setPagina} />
        </section>

        <section className={`${claseTarjeta} self-start`}>
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">Por producto</h2>
          </div>
          {porProducto.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-400">Sin producción en el período.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {porProducto.map((fila) => (
                <li key={fila.id} className="px-5 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-zinc-900 truncate">{productoPorId.get(fila.id)?.nombre ?? 'Producto inactivo'}</span>
                    <span className="font-semibold text-zinc-900 whitespace-nowrap">{formatoCantidad(fila.unidades)} und</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {fila.ordenes} orden(es) · {formatoCordobas(fila.costo)} · {formatoCordobas(fila.costo / fila.unidades)} c/u
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal abierto={Boolean(ordenDetalle)} titulo="Detalle de la orden" onCerrar={() => setDetalleId(null)} ancho="max-w-3xl">
        {ordenDetalle && (
          <OrdenDetalle orden={ordenDetalle} onEditar={() => undefined} onCompletar={() => undefined} onAccion={() => setDetalleId(null)} />
        )}
      </Modal>
    </>
  )
}
