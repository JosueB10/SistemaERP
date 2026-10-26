'use client'

import { useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle, CalendarDays, Download, Pencil, Plus, Trash2, Wallet } from 'lucide-react'

import { eliminarMovimientoFinanciero, useFinanzas } from '@/lib/finanzas/store'
import type { MovimientoFinanciero, OrigenFinanciero, TipoFinanciero } from '@/lib/finanzas/tipos'
import { CATEGORIAS_SUGERIDAS, enRango, esAutomatico, ETIQUETAS_ORIGEN, sumaMontos, totalesPorCategoria } from '@/lib/finanzas/utilidades'
import { categoriasUnicas, coincideBusqueda, fechaHoy, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { descargarCsv, ETIQUETAS_METODO_PAGO } from '@/lib/ventas/utilidades'
import {
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
  useNotificacion,
  usePaginacion
} from '../inventario/ui'
import MovimientoFormulario from './movimiento-formulario'
import { AvisoConexionFinanzas, BarrasCategoria, OrigenMovimiento, SECCION_FINANZAS } from './ui'

const TEXTOS: Record<TipoFinanciero, { titulo: string; descripcion: string; singular: string; plural: string }> = {
  ingreso: {
    titulo: 'Ingresos',
    descripcion: 'Dinero que entra al negocio. Las ventas se registran solas; aquí puede agregar otros ingresos.',
    singular: 'ingreso',
    plural: 'ingresos'
  },
  gasto: {
    titulo: 'Gastos',
    descripcion: 'Dinero que sale del negocio. Compras y nómina pagada se registran solas; aquí puede agregar gastos operativos.',
    singular: 'gasto',
    plural: 'gastos'
  }
}

type ModalActivo = { tipo: 'formulario'; movimiento?: MovimientoFinanciero } | null

export default function MovimientosVista({ tipo }: { tipo: TipoFinanciero }) {
  const datos = useFinanzas()
  const { mensaje, mostrar } = useNotificacion()
  const textos = TEXTOS[tipo]
  const movimientos = tipo === 'ingreso' ? datos.ingresos : datos.gastos

  const [busqueda, setBusqueda] = useState('')
  const [desde, setDesde] = useState(`${fechaHoy().slice(0, 7)}-01`)
  const [hasta, setHasta] = useState('')
  const [categoria, setCategoria] = useState('')
  const [origen, setOrigen] = useState<OrigenFinanciero | ''>('')
  const [modal, setModal] = useState<ModalActivo>(null)
  const [error, setError] = useState<string | null>(null)

  const categorias = useMemo(() => categoriasUnicas(movimientos), [movimientos])
  const sugerencias = useMemo(
    () => categoriasUnicas([...CATEGORIAS_SUGERIDAS[tipo].map((c) => ({ categoria: c })), ...movimientos.filter((m) => !esAutomatico(m))]),
    [tipo, movimientos]
  )

  const filtrados = useMemo(
    () =>
      movimientos.filter(
        (m) =>
          enRango(m.fecha, desde, hasta) &&
          (!categoria || m.categoria === categoria) &&
          (!origen || m.origen === origen) &&
          coincideBusqueda(busqueda, m.concepto, m.categoria, m.observaciones)
      ),
    [movimientos, desde, hasta, categoria, origen, busqueda]
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtrados, 15)

  const mes = fechaHoy().slice(0, 7)
  const delMes = movimientos.filter((m) => m.fecha.startsWith(mes))
  const totalFiltrado = sumaMontos(filtrados)
  const manualesFiltrados = sumaMontos(filtrados.filter((m) => !esAutomatico(m)))
  const porCategoria = totalesPorCategoria(filtrados).map((f) => ({ etiqueta: f.categoria, total: f.total }))

  const hayFiltros = busqueda || desde || hasta || categoria || origen
  const limpiarFiltros = () => {
    setBusqueda('')
    setDesde('')
    setHasta('')
    setCategoria('')
    setOrigen('')
    setPagina(1)
  }

  const eliminar = async (movimiento: MovimientoFinanciero) => {
    if (!window.confirm(`¿Eliminar el ${textos.singular} "${movimiento.concepto}" por ${formatoCordobas(movimiento.monto)}?`)) return
    const resultado = await eliminarMovimientoFinanciero(tipo, movimiento.id)
    if (!resultado.ok) { setError(resultado.error); return }
    setError(null)
    mostrar(`${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} eliminado`)
  }

  const exportar = () =>
    descargarCsv(`${textos.plural}-${fechaHoy()}.csv`, [
      ['Fecha', 'Concepto', 'Categoría', 'Origen', 'Método de pago', 'Monto', 'Observaciones'],
      ...filtrados.map((m) => [
        formatoFecha(m.fecha),
        m.concepto,
        m.categoria,
        ETIQUETAS_ORIGEN[m.origen],
        m.metodoPago ? ETIQUETAS_METODO_PAGO[m.metodoPago] : '',
        m.monto.toFixed(2),
        m.observaciones ?? ''
      ])
    ])

  const alGuardar = (texto: string) => {
    setModal(null)
    mostrar(texto)
  }

  const IconoTipo = tipo === 'ingreso' ? ArrowUpCircle : ArrowDownCircle

  return (
    <>
      <AvisoConexionFinanzas />
      <EncabezadoPagina
        titulo={textos.titulo}
        descripcion={textos.descripcion}
        seccion={SECCION_FINANZAS}
        acciones={
          <>
            <button type="button" onClick={exportar} disabled={filtrados.length === 0} className={`${claseBotonSecundario} disabled:opacity-50`}>
              <Download size={16} />
              Exportar CSV
            </button>
            <button type="button" onClick={() => setModal({ tipo: 'formulario' })} className={claseBotonPrimario}>
              <Plus size={16} />
              Registrar {textos.singular}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo={`${textos.titulo} de este mes`} valor={formatoCordobas(sumaMontos(delMes))} detalle={`${delMes.length} registro(s)`} icono={CalendarDays} tono={tipo === 'ingreso' ? 'positivo' : 'neutro'} />
        <TarjetaIndicador titulo={hayFiltros ? 'Total filtrado' : 'Total histórico'} valor={formatoCordobas(totalFiltrado)} detalle={`${filtrados.length} registro(s)`} icono={IconoTipo} />
        <TarjetaIndicador titulo="Registrados a mano" valor={formatoCordobas(manualesFiltrados)} detalle={hayFiltros ? 'Según los filtros' : 'Desde el inicio'} icono={Wallet} />
      </div>

      <div className={`${claseTarjeta} p-4 mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`}>
        <Campo etiqueta="Desde" htmlFor="fin-desde">
          <input id="fin-desde" type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPagina(1) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Hasta" htmlFor="fin-hasta">
          <input id="fin-hasta" type="date" value={hasta} onChange={(e) => { setHasta(e.target.value); setPagina(1) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Categoría" htmlFor="fin-filtro-categoria">
          <select id="fin-filtro-categoria" value={categoria} onChange={(e) => { setCategoria(e.target.value); setPagina(1) }} className={claseInput}>
            <option value="">Todas</option>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Origen" htmlFor="fin-filtro-origen">
          <select id="fin-filtro-origen" value={origen} onChange={(e) => { setOrigen(e.target.value as OrigenFinanciero | ''); setPagina(1) }} className={claseInput}>
            <option value="">Todos</option>
            {(tipo === 'ingreso' ? (['manual', 'venta'] as const) : (['manual', 'compra', 'nomina'] as const)).map((o) => (
              <option key={o} value={o}>{ETIQUETAS_ORIGEN[o]}</option>
            ))}
          </select>
        </Campo>
      </div>

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className={`${claseTarjeta} xl:col-span-2`}>
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center">
            <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar por concepto o categoría" />
            {hayFiltros && (
              <button type="button" onClick={limpiarFiltros} className="text-xs font-medium text-zinc-500 hover:text-zinc-900 whitespace-nowrap sm:ml-auto">
                Ver todo el historial
              </button>
            )}
          </div>

          {filtrados.length === 0 ? (
            <EstadoVacio
              icono={IconoTipo}
              titulo={movimientos.length ? `No hay ${textos.plural} que coincidan` : `Aún no hay ${textos.plural}`}
              descripcion={movimientos.length ? 'Pruebe con otro período o filtro.' : `Registre el primero con el botón Registrar ${textos.singular}.`}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Fecha</th>
                    <th className={claseCabeceraTabla}>Concepto</th>
                    <th className={claseCabeceraTabla}>Categoría</th>
                    <th className={claseCabeceraTabla}>Origen</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Monto</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {visibles.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/60">
                      <td className={claseCeldaTabla}>{formatoFecha(m.fecha)}</td>
                      <td className={`${claseCeldaTabla} whitespace-normal`}>
                        <p className="font-medium text-zinc-900">{m.concepto}</p>
                        {(m.metodoPago || m.observaciones) && (
                          <p className="text-xs text-zinc-400">
                            {[m.metodoPago && ETIQUETAS_METODO_PAGO[m.metodoPago], m.observaciones].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </td>
                      <td className={claseCeldaTabla}>{m.categoria}</td>
                      <td className={claseCeldaTabla}><OrigenMovimiento movimiento={m} /></td>
                      <td className={`${claseCeldaTabla} text-right font-semibold text-zinc-900`}>{formatoCordobas(m.monto)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        {esAutomatico(m) ? (
                          <span className="text-xs text-zinc-400">Automático</span>
                        ) : (
                          <div className="inline-flex gap-1">
                            <button type="button" onClick={() => setModal({ tipo: 'formulario', movimiento: m })} className={claseBotonTabla}>
                              <Pencil size={14} />
                              Editar
                            </button>
                            <button type="button" onClick={() => eliminar(m)} className={`${claseBotonTabla} hover:text-red-600`}>
                              <Trash2 size={14} />
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtrados.length} onCambiar={setPagina} />
        </section>

        <section className={`${claseTarjeta} self-start`}>
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">Por categoría</h2>
            <p className="text-xs text-zinc-500">{hayFiltros ? 'Según los filtros' : 'Desde el inicio'}</p>
          </div>
          <BarrasCategoria filas={porCategoria} color={tipo === 'ingreso' ? '#2a78d6' : '#eb6834'} vacio={`Sin ${textos.plural} en el período.`} />
        </section>
      </div>

      <Modal
        abierto={modal?.tipo === 'formulario'}
        titulo={modal?.movimiento ? `Editar ${textos.singular}` : `Registrar ${textos.singular}`}
        descripcion="Los campos marcados con * son obligatorios."
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === 'formulario' && (
          <MovimientoFormulario
            key={modal.movimiento?.id ?? 'nuevo'}
            tipo={tipo}
            movimiento={modal.movimiento}
            sugerencias={sugerencias}
            onCancelar={() => setModal(null)}
            onGuardado={alGuardar}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
