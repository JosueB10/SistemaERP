'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Clock, Download, Eye, Plus, Receipt, ShoppingCart, TrendingUp, Wallet } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { coincideBusqueda, fechaHoy, formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { useVentas } from '@/lib/ventas/store'
import type { EstadoVenta, MetodoPago } from '@/lib/ventas/tipos'
import { descargarCsv, ETIQUETAS_ESTADO_VENTA, ETIQUETAS_METODO_PAGO, margenVenta, unidadesVenta } from '@/lib/ventas/utilidades'
import {
  AvisoConexion,
  Buscador,
  Campo,
  claseBotonPrimario,
  claseBotonSecundario,
  claseBotonTabla,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  Modal,
  Notificacion,
  Paginacion,
  TarjetaIndicador,
  useDetalleEnUrl,
  useNotificacion,
  usePaginacion
} from '../inventario/ui'
import { AvisoConexionVentas, InsigniaDocumento } from './ui'
import VentaDetalle from './venta-detalle'

export default function VentasVista() {
  const { productos } = useInventario()
  const { ventas, clientes } = useVentas()
  const { mensaje, mostrar } = useNotificacion()
  const { detalleId, abrirDetalle, cerrarDetalle } = useDetalleEnUrl()

  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [estado, setEstado] = useState<EstadoVenta | ''>('')
  const [metodo, setMetodo] = useState<MetodoPago | ''>('')

  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const clientePorId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes])
  const nombreCliente = (id?: string) => (id ? clientePorId.get(id)?.nombre ?? 'Cliente eliminado' : 'Cliente de contado')

  const filtradas = useMemo(
    () =>
      ventas.filter(
        (v) =>
          (!desde || v.fecha >= desde) &&
          (!hasta || v.fecha <= hasta) &&
          (!estado || v.estado === estado) &&
          (!metodo || v.metodoPago === metodo) &&
          coincideBusqueda(busqueda, v.codigo, v.clienteId ? clientePorId.get(v.clienteId)?.nombre : 'contado', ...v.lineas.map((l) => productoPorId.get(l.productoId)?.nombre))
      ),
    [ventas, desde, hasta, estado, metodo, busqueda, clientePorId, productoPorId]
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtradas, 12)

  const mes = fechaHoy().slice(0, 7)
  const delMes = ventas.filter((v) => v.estado === 'completada' && v.fecha.startsWith(mes))
  const totalMes = delMes.reduce((t, v) => t + v.total, 0)
  const margenMes = delMes.reduce((t, v) => t + margenVenta(v), 0)
  const hoy = ventas.filter((v) => v.estado === 'completada' && v.fecha === fechaHoy())

  const pendientes = ventas.filter((v) => v.estado === 'pendiente')

  const vigentes = useMemo(() => filtradas.filter((v) => v.estado === 'completada'), [filtradas])
  const totalFiltrado = vigentes.reduce((t, v) => t + v.total, 0)

  const masVendidos = useMemo(() => {
    const mapa = new Map<string, { unidades: number; importe: number }>()
    vigentes.forEach((v) =>
      v.lineas.forEach((l) => {
        const actual = mapa.get(l.productoId) ?? { unidades: 0, importe: 0 }
        mapa.set(l.productoId, { unidades: actual.unidades + l.cantidad, importe: actual.importe + l.subtotal })
      })
    )
    return Array.from(mapa, ([id, datos]) => ({ id, ...datos })).sort((a, b) => b.unidades - a.unidades).slice(0, 8)
  }, [vigentes])

  const hayFiltros = busqueda || desde || hasta || estado || metodo
  const ventaDetalle = detalleId ? ventas.find((v) => v.id === detalleId) : undefined

  const exportar = () =>
    descargarCsv(`ventas-${fechaHoy()}.csv`, [
      ['Venta', 'Fecha', 'Cliente', 'Método de pago', 'Unidades', 'Subtotal', 'Descuento', 'IVA', 'Total', 'Costo', 'Estado'],
      ...filtradas.map((v) => [
        v.codigo,
        formatoFecha(v.fecha),
        nombreCliente(v.clienteId),
        v.metodoPago ? ETIQUETAS_METODO_PAGO[v.metodoPago] : '',
        unidadesVenta(v),
        v.subtotal.toFixed(2),
        v.descuento.toFixed(2),
        v.impuesto.toFixed(2),
        v.total.toFixed(2),
        v.costoTotal.toFixed(2),
        ETIQUETAS_ESTADO_VENTA[v.estado]
      ])
    ])

  return (
    <>
      <AvisoConexion />
      <AvisoConexionVentas />
      <EncabezadoPagina
        titulo="Historial de ventas"
        descripcion="Ventas registradas, su detalle y anulaciones."
        migas={false}
        acciones={
          <>
            <button type="button" onClick={exportar} disabled={filtradas.length === 0} className={`${claseBotonSecundario} disabled:opacity-50`}>
              <Download size={16} />
              Exportar CSV
            </button>
            <Link href="/ventas/nueva" className={claseBotonPrimario}>
              <Plus size={16} />
              Nueva venta
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <TarjetaIndicador titulo="Vendido este mes" valor={formatoCordobas(totalMes)} detalle={`${delMes.length} venta(s)`} icono={Wallet} tono="positivo" />
        <TarjetaIndicador titulo="Ventas de hoy" valor={formatoCordobas(hoy.reduce((t, v) => t + v.total, 0))} detalle={`${hoy.length} venta(s)`} icono={ShoppingCart} />
        <TarjetaIndicador titulo="Ticket promedio" valor={formatoCordobas(delMes.length ? totalMes / delMes.length : 0)} detalle="Este mes" icono={Receipt} />
        <TarjetaIndicador titulo="Margen bruto del mes" valor={formatoCordobas(margenMes)} detalle="Venta sin IVA menos costo de producción" icono={TrendingUp} tono={margenMes < 0 ? 'peligro' : 'neutro'} />
      </div>

      {pendientes.length > 0 && (
        <div role="status" className="mb-6 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2">
            <Clock size={16} className="mt-0.5 shrink-0" />
            <span>
              {pendientes.length} venta(s) pendiente(s) de producción por {formatoCordobas(pendientes.reduce((t, v) => t + v.total, 0))}.
              No cuentan como venta ni ingreso hasta que se fabrique lo que falta.
            </span>
          </p>
          <button type="button" onClick={() => { setEstado('pendiente'); setPagina(1) }} className="shrink-0 font-medium underline">Ver pendientes</button>
        </div>
      )}

      <div className={`${claseTarjeta} p-4 mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        <Campo etiqueta="Desde" htmlFor="ventas-desde">
          <input id="ventas-desde" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Hasta" htmlFor="ventas-hasta">
          <input id="ventas-hasta" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Método de pago" htmlFor="ventas-metodo">
          <select id="ventas-metodo" value={metodo} onChange={(e) => { setMetodo(e.target.value as MetodoPago | ''); setPagina(1) }} className={claseInput}>
            <option value="">Todos</option>
            {(Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]).map((m) => <option key={m} value={m}>{ETIQUETAS_METODO_PAGO[m]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Estado" htmlFor="ventas-estado">
          <select id="ventas-estado" value={estado} onChange={(e) => { setEstado(e.target.value as EstadoVenta | ''); setPagina(1) }} className={claseInput}>
            <option value="">Todas</option>
            <option value="pendiente">Pendientes de producción</option>
            <option value="completada">Completadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </Campo>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={`${claseTarjeta} xl:col-span-2`}>
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center">
            <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar por venta, cliente o producto" />
            <p className="text-xs text-zinc-500 sm:ml-auto">
              {hayFiltros ? 'Total filtrado' : 'Total histórico'}: <span className="font-semibold text-zinc-900">{formatoCordobas(totalFiltrado)}</span>
            </p>
          </div>

          {filtradas.length === 0 ? (
            <EstadoVacio
              icono={ShoppingCart}
              titulo={ventas.length ? 'No hay ventas que coincidan' : 'Aún no hay ventas'}
              descripcion={ventas.length ? 'Pruebe con otros filtros.' : 'Registre la primera con el botón Nueva venta.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Fecha</th>
                    <th className={claseCabeceraTabla}>Venta</th>
                    <th className={claseCabeceraTabla}>Cliente</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Unidades</th>
                    <th className={claseCabeceraTabla}>Pago</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Total</th>
                    <th className={claseCabeceraTabla}>Estado</th>
                    <th className={`${claseCabeceraTabla} text-right`} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visibles.map((v) => (
                    <tr key={v.id} className={`hover:bg-zinc-50/60 ${v.estado === 'anulada' ? 'text-zinc-400' : ''}`}>
                      <td className={claseCeldaTabla}>{formatoFecha(v.fecha)}</td>
                      <td className={`${claseCeldaTabla} font-mono text-xs`}>{v.codigo}</td>
                      <td className={`${claseCeldaTabla} font-medium text-zinc-900`}>{nombreCliente(v.clienteId)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(unidadesVenta(v))}</td>
                      <td className={claseCeldaTabla}>{v.metodoPago ? ETIQUETAS_METODO_PAGO[v.metodoPago] : '—'}</td>
                      <td className={`${claseCeldaTabla} text-right font-semibold ${v.estado === 'anulada' ? 'line-through text-zinc-400' : 'text-zinc-900'}`}>{formatoCordobas(v.total)}</td>
                      <td className={claseCeldaTabla}><InsigniaDocumento anulado={v.estado === 'anulada'} pendiente={v.estado === 'pendiente'} texto={ETIQUETAS_ESTADO_VENTA[v.estado]} /></td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <button type="button" onClick={() => abrirDetalle(v.id)} className={claseBotonTabla}><Eye size={14} />Ver</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtradas.length} onCambiar={setPagina} />
        </section>

        <section className={`${claseTarjeta} self-start`}>
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">Más vendidos</h2>
            <p className="text-xs text-zinc-500">{hayFiltros ? 'Según los filtros' : 'Desde el inicio'}</p>
          </div>
          {masVendidos.length === 0 ? (
            <p className="px-5 py-6 text-sm text-zinc-400">Sin ventas en el período.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {masVendidos.map((fila) => (
                <li key={fila.id} className="px-5 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-medium text-zinc-900 truncate">{productoPorId.get(fila.id)?.nombre ?? 'Producto inactivo'}</span>
                    <span className="font-semibold text-zinc-900 whitespace-nowrap">{formatoCantidad(fila.unidades)} und</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{formatoCordobas(fila.importe)} vendidos</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Modal abierto={Boolean(ventaDetalle)} titulo="Detalle de la venta" onCerrar={cerrarDetalle} ancho="max-w-3xl">
        {ventaDetalle && (
          <VentaDetalle
            key={ventaDetalle.id}
            venta={ventaDetalle}
            onAccion={(texto) => {
              cerrarDetalle()
              mostrar(texto)
            }}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
