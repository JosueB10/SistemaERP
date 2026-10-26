'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, History, Plus, SlidersHorizontal } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { AvisoConexion } from './ui'
import type { TipoMovimiento } from '@/lib/inventario/tipos'
import {
  buscarArticulo,
  coincideBusqueda,
  ETIQUETAS_CLASE,
  ETIQUETAS_MOVIMIENTO,
  formatoCantidad,
  formatoFecha,
  ordenarMovimientos,
  rutaDetalle,
  todosLosArticulos,
  variacionMovimiento
} from '@/lib/inventario/utilidades'
import MovimientoFormulario from './movimiento-formulario'
import {
  Buscador,
  claseBotonPrimario,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  InsigniaMovimiento,
  Modal,
  Notificacion,
  Paginacion,
  TarjetaIndicador,
  useNotificacion,
  usePaginacion
} from './ui'

export default function MovimientosVista() {
  const datos = useInventario()
  const searchParams = useSearchParams()
  const { mensaje, mostrar } = useNotificacion()

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimiento | ''>('')
  // Formato "clase:id"; puede venir preseleccionado desde el detalle de un artículo
  const [filtroArticulo, setFiltroArticulo] = useState(() => searchParams.get('articulo') ?? '')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [modalAbierto, setModalAbierto] = useState(false)

  const articulos = useMemo(
    () => todosLosArticulos(datos).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [datos]
  )

  const filas = useMemo(
    () =>
      ordenarMovimientos(datos.movimientos)
        .map((movimiento) => ({
          movimiento,
          articulo: buscarArticulo(datos, movimiento.claseArticulo, movimiento.articuloId)
        }))
        .filter(
          ({ movimiento, articulo }) =>
            coincideBusqueda(
              busqueda,
              articulo?.codigo,
              articulo?.nombre,
              movimiento.motivo,
              movimiento.observaciones
            ) &&
            (!filtroTipo || movimiento.tipo === filtroTipo) &&
            (!filtroArticulo || `${movimiento.claseArticulo}:${movimiento.articuloId}` === filtroArticulo) &&
            (!fechaDesde || movimiento.fecha >= fechaDesde) &&
            (!fechaHasta || movimiento.fecha <= fechaHasta)
        ),
    [datos, busqueda, filtroTipo, filtroArticulo, fechaDesde, fechaHasta]
  )

  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filas, 10)
  const hayFiltros = busqueda || filtroTipo || filtroArticulo || fechaDesde || fechaHasta
  const rangoInvalido = Boolean(fechaDesde && fechaHasta && fechaDesde > fechaHasta)

  const conteo = (tipo: TipoMovimiento) => filas.filter((fila) => fila.movimiento.tipo === tipo).length

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroTipo('')
    setFiltroArticulo('')
    setFechaDesde('')
    setFechaHasta('')
  }

  return (
    <>
      <AvisoConexion />
      <EncabezadoPagina
        titulo="Movimientos"
        descripcion="Historial de entradas, salidas y ajustes de inventario."
        acciones={
          <button type="button" onClick={() => setModalAbierto(true)} className={claseBotonPrimario}>
            <Plus size={16} />
            Registrar movimiento
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Entradas" valor={String(conteo('entrada'))} detalle={hayFiltros ? 'Según filtros aplicados' : 'Total registrado'} icono={ArrowDownLeft} tono="positivo" />
        <TarjetaIndicador titulo="Salidas" valor={String(conteo('salida'))} detalle={hayFiltros ? 'Según filtros aplicados' : 'Total registrado'} icono={ArrowUpRight} />
        <TarjetaIndicador titulo="Ajustes" valor={String(conteo('ajuste'))} detalle={hayFiltros ? 'Según filtros aplicados' : 'Total registrado'} icono={SlidersHorizontal} />
      </div>

      <div className={claseTarjeta}>
        <div className="space-y-3 border-b border-zinc-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Buscador
              valor={busqueda}
              onCambio={(valor) => {
                setBusqueda(valor)
                setPagina(1)
              }}
              placeholder="Buscar por artículo, motivo u observación"
            />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-1 lg:justify-end">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as TipoMovimiento | '')}
                className={`${claseInput} lg:w-40`}
                aria-label="Filtrar por tipo de movimiento"
              >
                <option value="">Todos los tipos</option>
                {(Object.keys(ETIQUETAS_MOVIMIENTO) as TipoMovimiento[]).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {ETIQUETAS_MOVIMIENTO[tipo]}
                  </option>
                ))}
              </select>
              <select
                value={filtroArticulo}
                onChange={(e) => setFiltroArticulo(e.target.value)}
                className={`${claseInput} lg:w-64`}
                aria-label="Filtrar por artículo"
              >
                <option value="">Todos los artículos</option>
                <optgroup label="Productos terminados">
                  {articulos
                    .filter((item) => item.clase === 'producto')
                    .map((item) => (
                      <option key={item.id} value={`producto:${item.id}`}>
                        {item.codigo} — {item.nombre}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="Materias primas">
                  {articulos
                    .filter((item) => item.clase === 'materia_prima')
                    .map((item) => (
                      <option key={item.id} value={`materia_prima:${item.id}`}>
                        {item.codigo} — {item.nombre}
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Desde
              <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} className={`${claseInput} sm:w-40`} />
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Hasta
              <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} className={`${claseInput} sm:w-40`} />
            </label>
            {rangoInvalido && (
              <span className="text-xs text-red-600">La fecha inicial es posterior a la final.</span>
            )}
            {hayFiltros && (
              <button type="button" onClick={limpiarFiltros} className="sm:ml-auto text-xs font-medium text-zinc-500 hover:text-zinc-900">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {filas.length === 0 ? (
          <EstadoVacio
            icono={History}
            titulo={hayFiltros ? 'No hay movimientos que coincidan' : 'Aún no hay movimientos'}
            descripcion={hayFiltros ? 'Pruebe con otros filtros o rango de fechas.' : 'Registre una entrada, salida o ajuste.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>Fecha</th>
                  <th className={claseCabeceraTabla}>Artículo</th>
                  <th className={claseCabeceraTabla}>Tipo</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Cantidad</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Existencias</th>
                  <th className={claseCabeceraTabla}>Motivo</th>
                  <th className={claseCabeceraTabla}>Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visibles.map(({ movimiento, articulo }) => {
                  const variacion = variacionMovimiento(movimiento)
                  return (
                    <tr key={movimiento.id} className="hover:bg-zinc-50/60 align-top">
                      <td className={claseCeldaTabla}>{formatoFecha(movimiento.fecha)}</td>
                      <td className={claseCeldaTabla}>
                        {articulo ? (
                          <Link href={rutaDetalle(articulo.clase, articulo.id)} className="group">
                            <span className="block font-medium text-zinc-900 group-hover:underline">{articulo.nombre}</span>
                            <span className="block text-xs text-zinc-400">
                              {articulo.codigo} · {ETIQUETAS_CLASE[articulo.clase]}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-zinc-400">Artículo no disponible</span>
                        )}
                      </td>
                      <td className={claseCeldaTabla}>
                        <InsigniaMovimiento tipo={movimiento.tipo} />
                      </td>
                      <td className={`${claseCeldaTabla} text-right font-semibold ${variacion >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {variacion >= 0 ? '+' : ''}
                        {formatoCantidad(variacion)} {articulo?.unidad}
                      </td>
                      <td className={`${claseCeldaTabla} text-right text-zinc-500`}>
                        {formatoCantidad(movimiento.existenciasAnteriores)} → {formatoCantidad(movimiento.existenciasResultantes)}
                      </td>
                      <td className={claseCeldaTabla}>{movimiento.motivo}</td>
                      <td className={`${claseCeldaTabla} whitespace-normal text-zinc-500 max-w-xs`}>
                        {movimiento.observaciones || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filas.length} onCambiar={setPagina} />
      </div>

      <Modal
        abierto={modalAbierto}
        titulo="Registrar movimiento"
        descripcion="Las existencias se actualizan al guardar."
        onCerrar={() => setModalAbierto(false)}
      >
        {modalAbierto && (
          <MovimientoFormulario
            onCancelar={() => setModalAbierto(false)}
            onGuardado={(texto) => {
              setModalAbierto(false)
              mostrar(texto)
            }}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
