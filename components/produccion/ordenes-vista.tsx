'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Clock, Eye, Factory, Plus, Wallet } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { coincideBusqueda, fechaHoy, formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { codigoVenta } from '@/lib/ventas/utilidades'
import type { EstadoOrden, OrdenProduccion } from '@/lib/produccion/tipos'
import { ETIQUETAS_ESTADO_ORDEN, materiaComprometida, ordenAbierta, recetaDeProducto, requerimientos, tieneMateriaDefinida } from '@/lib/produccion/utilidades'
import {
  AvisoConexion,
  Buscador,
  claseBotonPrimario,
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
import OrdenCompletar from './orden-completar'
import OrdenDetalle from './orden-detalle'
import OrdenFormulario from './orden-formulario'
import { AvisoConexionProduccion, InsigniaOrden } from './ui'

type FiltroEstado = 'abiertas' | 'todas' | EstadoOrden

type ModalActivo =
  | { tipo: 'formulario'; orden?: OrdenProduccion }
  | { tipo: 'detalle'; ordenId: string }
  | { tipo: 'completar'; ordenId: string }
  | null

export default function OrdenesVista() {
  const { productos, materiasPrimas } = useInventario()
  const { ordenes, recetas, responsables } = useProduccion()
  const { mensaje, mostrar } = useNotificacion()

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('abiertas')
  const [modalLocal, setModal] = useState<ModalActivo>(null)
  // ?detalle=<id> abre la orden directamente (enlaces desde notificaciones y reportes)
  const { detalleId, cerrarDetalle } = useDetalleEnUrl()
  // ?nueva=<producto>&cantidad=<n>&venta=<id> abre una orden nueva prellenada (lo que falta para una venta pendiente)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const productoNueva = searchParams.get('nueva')
  const ventaNueva = searchParams.get('venta') ?? undefined
  const inicial = productoNueva
    ? {
        productoId: productoNueva,
        cantidad: Math.max(1, Math.trunc(Number(searchParams.get('cantidad')) || 1)),
        ventaId: ventaNueva,
        observaciones: ventaNueva ? `Para la venta ${codigoVenta(ventaNueva)}` : ''
      }
    : undefined
  const modal: ModalActivo = modalLocal ?? (detalleId ? { tipo: 'detalle', ordenId: detalleId } : inicial ? { tipo: 'formulario' } : null)
  const cerrar = () => {
    setModal(null)
    if (detalleId) cerrarDetalle()
    if (productoNueva) router.replace(pathname, { scroll: false })
  }

  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const responsablePorId = useMemo(() => new Map(responsables.map((r) => [r.id, r])), [responsables])

  const filtradas = useMemo(
    () =>
      ordenes.filter((orden) => {
        const producto = productoPorId.get(orden.productoId)
        const estadoOk = filtroEstado === 'todas' || (filtroEstado === 'abiertas' ? ordenAbierta(orden) : orden.estado === filtroEstado)
        return estadoOk && coincideBusqueda(busqueda, orden.codigo, producto?.nombre, producto?.sku, responsablePorId.get(orden.empleadoId ?? '')?.nombre)
      }),
    [ordenes, productoPorId, responsablePorId, busqueda, filtroEstado]
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtradas, 10)

  const mes = fechaHoy().slice(0, 7)
  const completadasMes = ordenes.filter((o) => o.estado === 'completada' && o.fechaFin?.startsWith(mes))
  const unidadesMes = completadasMes.reduce((total, o) => total + o.cantidadProducida, 0)
  const costoMes = completadasMes.reduce((total, o) => total + o.costoMateriales, 0)
  const pendientes = ordenes.filter((o) => o.estado === 'pendiente').length
  const enProceso = ordenes.filter((o) => o.estado === 'en_proceso').length

  // Órdenes abiertas a las que no les alcanza la materia prima (descontando lo que reservan las demás)
  const sinMateria = (orden: OrdenProduccion) => {
    const receta = recetaDeProducto(recetas, orden.productoId)
    if (!tieneMateriaDefinida(receta)) return null
    return requerimientos(receta, orden.cantidadPlanificada, materiasPrimas, materiaComprometida(ordenes, recetas, orden.id)).some((l) => l.faltante > 0)
  }
  const bloqueadas = ordenes.filter((o) => ordenAbierta(o) && sinMateria(o)).length

  const ordenModal = modal && modal.tipo !== 'formulario' ? ordenes.find((o) => o.id === modal.ordenId) : undefined

  const alTerminar = (texto: string) => {
    cerrar()
    mostrar(texto)
  }

  return (
    <>
      <AvisoConexion />
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Órdenes de producción"
        descripcion="Planifique, fabrique y registre lo producido. Al completar una orden se descuenta la materia prima y entra el producto terminado."
        migas={false}
        acciones={
          <button type="button" onClick={() => setModal({ tipo: 'formulario' })} className={claseBotonPrimario}>
            <Plus size={16} />
            Nueva orden
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <TarjetaIndicador titulo="Pendientes" valor={String(pendientes)} detalle="Por iniciar" icono={Clock} tono={pendientes ? 'alerta' : 'neutro'} />
        <TarjetaIndicador
          titulo="En proceso"
          valor={String(enProceso)}
          detalle={bloqueadas ? `${bloqueadas} abierta(s) sin materia prima suficiente` : 'Materia prima suficiente'}
          icono={Factory}
          tono={bloqueadas ? 'peligro' : 'neutro'}
        />
        <TarjetaIndicador titulo="Producido este mes" valor={`${formatoCantidad(unidadesMes)} und`} detalle={`${completadasMes.length} orden(es) completada(s)`} icono={CheckCircle2} tono="positivo" />
        <TarjetaIndicador titulo="Materia prima consumida" valor={formatoCordobas(costoMes)} detalle="Costo de este mes" icono={Wallet} />
      </div>

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center">
          <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar por orden, producto o responsable" />
          <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value as FiltroEstado); setPagina(1) }} className={`${claseInput} sm:w-48 sm:ml-auto`} aria-label="Filtrar por estado">
            <option value="abiertas">Abiertas</option>
            <option value="todas">Todas</option>
            {(Object.keys(ETIQUETAS_ESTADO_ORDEN) as EstadoOrden[]).map((estado) => (
              <option key={estado} value={estado}>{ETIQUETAS_ESTADO_ORDEN[estado]}</option>
            ))}
          </select>
        </div>

        {filtradas.length === 0 ? (
          <EstadoVacio
            icono={Factory}
            titulo={ordenes.length ? 'No hay órdenes que coincidan' : 'Aún no hay órdenes de producción'}
            descripcion={ordenes.length ? 'Pruebe con otro estado o búsqueda.' : 'Cree la primera orden con el botón Nueva orden.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Orden</th>
                  <th className={claseCabeceraTabla}>Producto</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Cantidad</th>
                  <th className={claseCabeceraTabla}>Responsable</th>
                  <th className={claseCabeceraTabla}>Programada</th>
                  <th className={claseCabeceraTabla}>Materia prima</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((orden) => {
                  const producto = productoPorId.get(orden.productoId)
                  const falta = ordenAbierta(orden) ? sinMateria(orden) : undefined
                  return (
                    <tr key={orden.id} className="hover:bg-stone-50/60">
                      <td className={`${claseCeldaTabla} font-mono text-xs`}>{orden.codigo}</td>
                      <td className={`${claseCeldaTabla} font-medium text-stone-900`}>{producto?.nombre ?? 'Producto inactivo'}</td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        {orden.estado === 'completada'
                          ? `${formatoCantidad(orden.cantidadProducida)} / ${formatoCantidad(orden.cantidadPlanificada)}`
                          : formatoCantidad(orden.cantidadPlanificada)}
                      </td>
                      <td className={claseCeldaTabla}>{responsablePorId.get(orden.empleadoId ?? '')?.nombre ?? <span className="text-stone-400">Sin asignar</span>}</td>
                      <td className={claseCeldaTabla}>{orden.fechaProgramada ? formatoFecha(orden.fechaProgramada) : '—'}</td>
                      <td className={claseCeldaTabla}>
                        {falta === undefined ? (
                          <span className="text-stone-400">—</span>
                        ) : falta === null ? (
                          <span className="text-xs text-amber-700">Sin receta</span>
                        ) : falta ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><AlertTriangle size={13} />Insuficiente</span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-700">Suficiente</span>
                        )}
                      </td>
                      <td className={claseCeldaTabla}><InsigniaOrden estado={orden.estado} /></td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => setModal({ tipo: 'detalle', ordenId: orden.id })} className={claseBotonTabla}>
                            <Eye size={14} />
                            Ver
                          </button>
                          {ordenAbierta(orden) && (
                            <button type="button" onClick={() => setModal({ tipo: 'completar', ordenId: orden.id })} className={claseBotonTabla}>
                              <CheckCircle2 size={14} />
                              Completar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtradas.length} onCambiar={setPagina} />
      </div>

      <Modal
        abierto={modal?.tipo === 'formulario'}
        titulo={modal?.tipo === 'formulario' && modal.orden ? `Editar orden ${modal.orden.codigo}` : 'Nueva orden de producción'}
        descripcion="Los campos marcados con * son obligatorios."
        onCerrar={cerrar}
        ancho="max-w-3xl"
      >
        {modal?.tipo === 'formulario' && (
          <OrdenFormulario key={modal.orden?.id ?? 'nueva'} orden={modal.orden} inicial={modal.orden ? undefined : inicial} onCancelar={cerrar} onGuardado={alTerminar} />
        )}
      </Modal>

      <Modal abierto={modal?.tipo === 'detalle' && Boolean(ordenModal)} titulo="Detalle de la orden" onCerrar={cerrar} ancho="max-w-3xl">
        {modal?.tipo === 'detalle' && ordenModal && (
          <OrdenDetalle
            key={ordenModal.id}
            orden={ordenModal}
            onEditar={() => setModal({ tipo: 'formulario', orden: ordenModal })}
            onCompletar={() => setModal({ tipo: 'completar', ordenId: ordenModal.id })}
            onAccion={alTerminar}
          />
        )}
      </Modal>

      <Modal
        abierto={modal?.tipo === 'completar' && Boolean(ordenModal)}
        titulo={ordenModal ? `Completar orden ${ordenModal.codigo}` : 'Completar orden'}
        descripcion="Se descontará la materia prima y el producto terminado entrará al inventario."
        onCerrar={cerrar}
        ancho="max-w-3xl"
      >
        {modal?.tipo === 'completar' && ordenModal && (
          <OrdenCompletar key={ordenModal.id} orden={ordenModal} onCancelar={cerrar} onGuardado={alTerminar} />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
