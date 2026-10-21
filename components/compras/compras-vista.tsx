'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AlertTriangle, Download, Eye, Plus, Receipt, Truck, Wallet } from 'lucide-react'

import { useCompras } from '@/lib/compras/store'
import type { EstadoCompra } from '@/lib/compras/tipos'
import { ETIQUETAS_ESTADO_COMPRA } from '@/lib/compras/utilidades'
import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, coincideBusqueda, fechaHoy, formatoCantidad, formatoCordobas, formatoFecha, tieneStockBajo } from '@/lib/inventario/utilidades'
import { descargarCsv, ETIQUETAS_METODO_PAGO } from '@/lib/ventas/utilidades'
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
import { InsigniaDocumento } from '../ventas/ui'
import CompraDetalle from './compra-detalle'
import { AvisoConexionCompras } from './ui'

export default function ComprasVista() {
  const { materiasPrimas } = useInventario()
  const { compras, proveedores } = useCompras()
  const { mensaje, mostrar } = useNotificacion()
  const { detalleId, abrirDetalle, cerrarDetalle } = useDetalleEnUrl()

  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [proveedorId, setProveedorId] = useState('')
  const [estado, setEstado] = useState<EstadoCompra | ''>('')

  const materiaPorId = useMemo(() => new Map(materiasPrimas.map((m) => [m.id, m])), [materiasPrimas])
  const proveedorPorId = useMemo(() => new Map(proveedores.map((p) => [p.id, p])), [proveedores])

  const filtradas = useMemo(
    () =>
      compras.filter(
        (c) =>
          (!desde || c.fecha >= desde) &&
          (!hasta || c.fecha <= hasta) &&
          (!proveedorId || c.proveedorId === proveedorId) &&
          (!estado || c.estado === estado) &&
          coincideBusqueda(busqueda, c.codigo, c.numeroFactura, proveedorPorId.get(c.proveedorId ?? '')?.nombre, ...c.lineas.map((l) => materiaPorId.get(l.materiaPrimaId)?.nombre))
      ),
    [compras, desde, hasta, proveedorId, estado, busqueda, proveedorPorId, materiaPorId]
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtradas, 12)

  const mes = fechaHoy().slice(0, 7)
  const delMes = compras.filter((c) => c.estado === 'completada' && c.fecha.startsWith(mes))
  const totalMes = delMes.reduce((t, c) => t + c.total, 0)
  const ivaMes = delMes.reduce((t, c) => t + c.impuesto, 0)
  const stockBajo = materiasPrimas.filter(tieneStockBajo)

  const vigentes = useMemo(() => filtradas.filter((c) => c.estado === 'completada'), [filtradas])
  const totalFiltrado = vigentes.reduce((t, c) => t + c.total, 0)

  const masCompradas = useMemo(() => {
    const mapa = new Map<string, { cantidad: number; importe: number }>()
    vigentes.forEach((c) =>
      c.lineas.forEach((l) => {
        const actual = mapa.get(l.materiaPrimaId) ?? { cantidad: 0, importe: 0 }
        mapa.set(l.materiaPrimaId, { cantidad: actual.cantidad + l.cantidad, importe: actual.importe + l.subtotal })
      })
    )
    return Array.from(mapa, ([id, datos]) => ({ id, ...datos })).sort((a, b) => b.importe - a.importe).slice(0, 8)
  }, [vigentes])

  const hayFiltros = busqueda || desde || hasta || proveedorId || estado
  const compraDetalle = detalleId ? compras.find((c) => c.id === detalleId) : undefined
  const nombreProveedor = (id?: string) => proveedorPorId.get(id ?? '')?.nombre ?? 'Proveedor eliminado'

  const exportar = () =>
    descargarCsv(`compras-${fechaHoy()}.csv`, [
      ['Compra', 'Fecha', 'Proveedor', 'Factura', 'Método de pago', 'Subtotal', 'Descuento', 'IVA', 'Total', 'Estado'],
      ...filtradas.map((c) => [
        c.codigo,
        formatoFecha(c.fecha),
        nombreProveedor(c.proveedorId),
        c.numeroFactura ?? '',
        c.metodoPago ? ETIQUETAS_METODO_PAGO[c.metodoPago] : '',
        c.subtotal.toFixed(2),
        c.descuento.toFixed(2),
        c.impuesto.toFixed(2),
        c.total.toFixed(2),
        ETIQUETAS_ESTADO_COMPRA[c.estado]
      ])
    ])

  return (
    <>
      <AvisoConexion />
      <AvisoConexionCompras />
      <EncabezadoPagina
        titulo="Historial de compras"
        descripcion="Compras de materia prima a proveedores, su detalle y anulaciones."
        migas={false}
        acciones={
          <>
            <button type="button" onClick={exportar} disabled={filtradas.length === 0} className={`${claseBotonSecundario} disabled:opacity-50`}>
              <Download size={16} />
              Exportar CSV
            </button>
            <Link href="/compras/nueva" className={claseBotonPrimario}>
              <Plus size={16} />
              Nueva compra
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <TarjetaIndicador titulo="Comprado este mes" valor={formatoCordobas(totalMes)} detalle={`${delMes.length} compra(s)`} icono={Wallet} />
        <TarjetaIndicador titulo="IVA pagado este mes" valor={formatoCordobas(ivaMes)} detalle="Crédito fiscal de las facturas" icono={Receipt} />
        <TarjetaIndicador titulo="Proveedores activos" valor={String(proveedores.filter((p) => p.activo).length)} detalle={`${proveedores.length} registrado(s)`} icono={Truck} />
        <TarjetaIndicador
          titulo="Materia prima en stock bajo"
          valor={String(stockBajo.length)}
          detalle={stockBajo.length ? 'Considere reabastecer' : 'Todo por encima del mínimo'}
          icono={AlertTriangle}
          tono={stockBajo.length ? 'alerta' : 'positivo'}
        />
      </div>

      <div className={`${claseTarjeta} p-4 mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        <Campo etiqueta="Desde" htmlFor="compras-desde">
          <input id="compras-desde" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Hasta" htmlFor="compras-hasta">
          <input id="compras-hasta" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Proveedor" htmlFor="compras-proveedor">
          <select id="compras-proveedor" value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setPagina(1) }} className={claseInput}>
            <option value="">Todos</option>
            {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Estado" htmlFor="compras-estado">
          <select id="compras-estado" value={estado} onChange={(e) => { setEstado(e.target.value as EstadoCompra | ''); setPagina(1) }} className={claseInput}>
            <option value="">Todas</option>
            <option value="completada">Recibidas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </Campo>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={`${claseTarjeta} xl:col-span-2`}>
          <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center">
            <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar por compra, factura, proveedor o material" />
            <p className="text-xs text-stone-500 sm:ml-auto">
              {hayFiltros ? 'Total filtrado' : 'Total histórico'}: <span className="font-semibold text-stone-900">{formatoCordobas(totalFiltrado)}</span>
            </p>
          </div>

          {filtradas.length === 0 ? (
            <EstadoVacio
              icono={Truck}
              titulo={compras.length ? 'No hay compras que coincidan' : 'Aún no hay compras'}
              descripcion={compras.length ? 'Pruebe con otros filtros.' : 'Registre la primera con el botón Nueva compra.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-stone-50">
                  <tr>
                    <th className={claseCabeceraTabla}>Fecha</th>
                    <th className={claseCabeceraTabla}>Compra</th>
                    <th className={claseCabeceraTabla}>Proveedor</th>
                    <th className={claseCabeceraTabla}>Factura</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Líneas</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Total</th>
                    <th className={claseCabeceraTabla}>Estado</th>
                    <th className={`${claseCabeceraTabla} text-right`} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {visibles.map((c) => (
                    <tr key={c.id} className={`hover:bg-stone-50/60 ${c.estado === 'anulada' ? 'text-stone-400' : ''}`}>
                      <td className={claseCeldaTabla}>{formatoFecha(c.fecha)}</td>
                      <td className={`${claseCeldaTabla} font-mono text-xs`}>{c.codigo}</td>
                      <td className={`${claseCeldaTabla} font-medium text-stone-900`}>{nombreProveedor(c.proveedorId)}</td>
                      <td className={claseCeldaTabla}>{c.numeroFactura ?? '—'}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{c.lineas.length}</td>
                      <td className={`${claseCeldaTabla} text-right font-semibold ${c.estado === 'anulada' ? 'line-through text-stone-400' : 'text-stone-900'}`}>{formatoCordobas(c.total)}</td>
                      <td className={claseCeldaTabla}><InsigniaDocumento anulado={c.estado === 'anulada'} texto={ETIQUETAS_ESTADO_COMPRA[c.estado]} /></td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <button type="button" onClick={() => abrirDetalle(c.id)} className={claseBotonTabla}><Eye size={14} />Ver</button>
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
          <div className="border-b border-stone-200 px-5 py-4">
            <h2 className="font-semibold text-stone-900">Materia prima más comprada</h2>
            <p className="text-xs text-stone-500">{hayFiltros ? 'Según los filtros' : 'Desde el inicio'}</p>
          </div>
          {masCompradas.length === 0 ? (
            <p className="px-5 py-6 text-sm text-stone-400">Sin compras en el período.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {masCompradas.map((fila) => {
                const materia = materiaPorId.get(fila.id)
                return (
                  <li key={fila.id} className="px-5 py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-stone-900 truncate">{materia?.nombre ?? 'Materia prima inactiva'}</span>
                      <span className="font-semibold text-stone-900 whitespace-nowrap">{formatoCordobas(fila.importe)}</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {formatoCantidad(fila.cantidad)} {materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''} · {formatoCordobas(fila.cantidad ? fila.importe / fila.cantidad : 0)} promedio
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      <Modal abierto={Boolean(compraDetalle)} titulo="Detalle de la compra" onCerrar={cerrarDetalle} ancho="max-w-3xl">
        {compraDetalle && (
          <CompraDetalle
            key={compraDetalle.id}
            compra={compraDetalle}
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
