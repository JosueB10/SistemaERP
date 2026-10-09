'use client'

import { useMemo, useState } from 'react'
import { ArrowRightLeft, Eye, Layers, Pencil, Plus } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { AvisoConexion } from './ui'
import type { EstadoStock, MateriaPrima } from '@/lib/inventario/tipos'
import {
  ABREVIATURAS_UNIDAD,
  categoriasUnicas,
  coincideBusqueda,
  estadoStock,
  ETIQUETAS_ESTADO,
  ETIQUETAS_UNIDAD,
  formatoCantidad,
  formatoCordobas
} from '@/lib/inventario/utilidades'
import DetalleArticulo from './detalle-articulo'
import MateriaPrimaFormulario from './materia-prima-formulario'
import MovimientoFormulario from './movimiento-formulario'
import {
  Buscador,
  claseBotonPrimario,
  claseBotonSecundario,
  claseBotonTabla,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  InsigniaEstado,
  InsigniaNeutra,
  Modal,
  Notificacion,
  Paginacion,
  useDetalleEnUrl,
  useNotificacion,
  usePaginacion
} from './ui'

type ModalActivo =
  | { tipo: 'formulario'; materia?: MateriaPrima }
  | { tipo: 'movimiento'; materiaId?: string }
  | null

export default function MateriasPrimasVista() {
  const { materiasPrimas } = useInventario()
  const { detalleId, abrirDetalle, cerrarDetalle } = useDetalleEnUrl()
  const { mensaje, mostrar } = useNotificacion()

  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoStock | ''>('')
  const [modal, setModal] = useState<ModalActivo>(null)

  const filtradas = useMemo(
    () =>
      materiasPrimas
        .filter(
          (item) =>
            coincideBusqueda(busqueda, item.codigo, item.nombre, item.categoria) &&
            (!filtroCategoria || item.categoria === filtroCategoria) &&
            (!filtroEstado || estadoStock(item.existencias, item.stockMinimo) === filtroEstado)
        )
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [materiasPrimas, busqueda, filtroCategoria, filtroEstado]
  )

  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtradas, 8)
  const hayFiltros = busqueda || filtroCategoria || filtroEstado
  const materiaDetalle = detalleId ? materiasPrimas.find((item) => item.id === detalleId) : undefined

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroCategoria('')
    setFiltroEstado('')
  }

  const alGuardar = (texto: string) => {
    setModal(null)
    mostrar(texto)
  }

  return (
    <>
      <AvisoConexion />
      <EncabezadoPagina
        titulo="Materias primas"
        descripcion="Materiales e insumos utilizados en la fabricación de mousepads."
        acciones={
          <>
            <button type="button" onClick={() => setModal({ tipo: 'movimiento' })} className={claseBotonSecundario}>
              <ArrowRightLeft size={16} />
              Movimiento
            </button>
            <button type="button" onClick={() => setModal({ tipo: 'formulario' })} className={claseBotonPrimario}>
              <Plus size={16} />
              Registrar material
            </button>
          </>
        }
      />

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center">
          <Buscador
            valor={busqueda}
            onCambio={(valor) => {
              setBusqueda(valor)
              setPagina(1)
            }}
            placeholder="Buscar por código, nombre o categoría"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-1 lg:justify-end">
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className={`${claseInput} lg:w-44`}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {categoriasUnicas(materiasPrimas).map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoStock | '')}
              className={`${claseInput} lg:w-40`}
              aria-label="Filtrar por estado"
            >
              <option value="">Todos los estados</option>
              {(Object.keys(ETIQUETAS_ESTADO) as EstadoStock[]).map((estado) => (
                <option key={estado} value={estado}>
                  {ETIQUETAS_ESTADO[estado]}
                </option>
              ))}
            </select>
          </div>
          {hayFiltros && (
            <button type="button" onClick={limpiarFiltros} className="text-xs font-medium text-stone-500 hover:text-stone-900 whitespace-nowrap">
              Limpiar filtros
            </button>
          )}
        </div>

        {filtradas.length === 0 ? (
          <EstadoVacio
            icono={Layers}
            titulo={hayFiltros ? 'No hay materiales que coincidan' : 'Aún no hay materias primas'}
            descripcion={hayFiltros ? 'Pruebe con otros filtros o términos de búsqueda.' : 'Registre el primer material.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Código</th>
                  <th className={claseCabeceraTabla}>Material</th>
                  <th className={claseCabeceraTabla}>Categoría</th>
                  <th className={claseCabeceraTabla}>Unidad</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Existencias</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Mínimo</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Costo unitario</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((materia) => (
                  <tr key={materia.id} className="hover:bg-stone-50/60">
                    <td className={`${claseCeldaTabla} font-mono text-xs`}>{materia.codigo}</td>
                    <td className={`${claseCeldaTabla} font-medium text-stone-900`}>{materia.nombre}</td>
                    <td className={claseCeldaTabla}>
                      <InsigniaNeutra>{materia.categoria}</InsigniaNeutra>
                    </td>
                    <td className={claseCeldaTabla} title={ETIQUETAS_UNIDAD[materia.unidad]}>
                      {ABREVIATURAS_UNIDAD[materia.unidad]}
                    </td>
                    <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCantidad(materia.existencias)}</td>
                    <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCantidad(materia.stockMinimo)}</td>
                    <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(materia.costoUnitario)}</td>
                    <td className={claseCeldaTabla}>
                      <InsigniaEstado estado={estadoStock(materia.existencias, materia.stockMinimo)} />
                    </td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => abrirDetalle(materia.id)} className={claseBotonTabla}>
                          <Eye size={14} />
                          Ver
                        </button>
                        <button type="button" onClick={() => setModal({ tipo: 'formulario', materia })} className={claseBotonTabla}>
                          <Pencil size={14} />
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtradas.length} onCambiar={setPagina} />
      </div>

      <Modal
        abierto={Boolean(materiaDetalle) && modal === null}
        titulo="Detalle de materia prima"
        onCerrar={cerrarDetalle}
      >
        {materiaDetalle && (
          <DetalleArticulo
            clase="materia_prima"
            id={materiaDetalle.id}
            onEditar={() => {
              cerrarDetalle()
              setModal({ tipo: 'formulario', materia: materiaDetalle })
            }}
            onMovimiento={() => {
              cerrarDetalle()
              setModal({ tipo: 'movimiento', materiaId: materiaDetalle.id })
            }}
          />
        )}
      </Modal>

      <Modal
        abierto={modal?.tipo === 'formulario'}
        titulo={modal?.tipo === 'formulario' && modal.materia ? 'Editar materia prima' : 'Registrar materia prima'}
        descripcion="Los campos marcados con * son obligatorios."
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === 'formulario' && (
          <MateriaPrimaFormulario
            key={modal.materia?.id ?? 'nueva'}
            materia={modal.materia}
            onCancelar={() => setModal(null)}
            onGuardado={alGuardar}
          />
        )}
      </Modal>

      <Modal
        abierto={modal?.tipo === 'movimiento'}
        titulo="Registrar movimiento"
        descripcion="Entrada, salida o ajuste de una materia prima."
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === 'movimiento' && (
          <MovimientoFormulario
            claseInicial="materia_prima"
            articuloIdInicial={modal.materiaId}
            onCancelar={() => setModal(null)}
            onGuardado={alGuardar}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
