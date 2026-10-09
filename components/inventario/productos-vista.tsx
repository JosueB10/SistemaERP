'use client'

import { useMemo, useState } from 'react'
import { ArrowRightLeft, Eye, Package, Pencil, Plus } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { AvisoConexion } from './ui'
import type { EstadoStock, Producto, TipoProducto } from '@/lib/inventario/tipos'
import {
  categoriasUnicas,
  coincideBusqueda,
  estadoStock,
  ETIQUETAS_ESTADO,
  ETIQUETAS_TIPO_PRODUCTO,
  formatoCantidad,
  formatoCordobas
} from '@/lib/inventario/utilidades'
import DetalleArticulo from './detalle-articulo'
import MovimientoFormulario from './movimiento-formulario'
import ProductoFormulario from './producto-formulario'
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
  | { tipo: 'formulario'; producto?: Producto }
  | { tipo: 'movimiento'; productoId?: string }
  | null

export default function ProductosVista() {
  const { productos } = useInventario()
  const { detalleId, abrirDetalle, cerrarDetalle } = useDetalleEnUrl()
  const { mensaje, mostrar } = useNotificacion()

  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoProducto | ''>('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoStock | ''>('')
  const [modal, setModal] = useState<ModalActivo>(null)

  const filtrados = useMemo(
    () =>
      productos
        .filter(
          (item) =>
            coincideBusqueda(busqueda, item.sku, item.nombre, item.categoria) &&
            (!filtroTipo || item.tipo === filtroTipo) &&
            (!filtroCategoria || item.categoria === filtroCategoria) &&
            (!filtroEstado || estadoStock(item.existencias, item.stockMinimo) === filtroEstado)
        )
        .sort((a, b) => a.sku.localeCompare(b.sku)),
    [productos, busqueda, filtroTipo, filtroCategoria, filtroEstado]
  )

  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtrados, 8)
  const hayFiltros = busqueda || filtroTipo || filtroCategoria || filtroEstado
  const productoDetalle = detalleId ? productos.find((item) => item.id === detalleId) : undefined

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroTipo('')
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
        titulo="Productos terminados"
        descripcion="Mousepads listos para la venta, estándar y personalizados."
        acciones={
          <>
            <button type="button" onClick={() => setModal({ tipo: 'movimiento' })} className={claseBotonSecundario}>
              <ArrowRightLeft size={16} />
              Movimiento
            </button>
            <button type="button" onClick={() => setModal({ tipo: 'formulario' })} className={claseBotonPrimario}>
              <Plus size={16} />
              Registrar producto
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
            placeholder="Buscar por SKU, nombre o categoría"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-1 lg:justify-end">
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as TipoProducto | '')}
              className={`${claseInput} lg:w-40`}
              aria-label="Filtrar por tipo"
            >
              <option value="">Todos los tipos</option>
              {(Object.keys(ETIQUETAS_TIPO_PRODUCTO) as TipoProducto[]).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {ETIQUETAS_TIPO_PRODUCTO[tipo]}
                </option>
              ))}
            </select>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className={`${claseInput} lg:w-44`}
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {categoriasUnicas(productos).map((categoria) => (
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

        {filtrados.length === 0 ? (
          <EstadoVacio
            icono={Package}
            titulo={hayFiltros ? 'No hay productos que coincidan' : 'Aún no hay productos'}
            descripcion={hayFiltros ? 'Pruebe con otros filtros o términos de búsqueda.' : 'Registre el primer producto terminado.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>SKU</th>
                  <th className={claseCabeceraTabla}>Nombre</th>
                  <th className={claseCabeceraTabla}>Tipo</th>
                  <th className={claseCabeceraTabla}>Categoría</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Precio venta</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Costo prod.</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Existencias</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Mínimo</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((producto) => (
                  <tr key={producto.id} className="hover:bg-stone-50/60">
                    <td className={`${claseCeldaTabla} font-mono text-xs`}>{producto.sku}</td>
                    <td className={`${claseCeldaTabla} font-medium text-stone-900`}>{producto.nombre}</td>
                    <td className={claseCeldaTabla}>
                      <InsigniaNeutra>{ETIQUETAS_TIPO_PRODUCTO[producto.tipo]}</InsigniaNeutra>
                    </td>
                    <td className={claseCeldaTabla}>{producto.categoria}</td>
                    <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(producto.precioVenta)}</td>
                    <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCordobas(producto.costoProduccion)}</td>
                    <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCantidad(producto.existencias)}</td>
                    <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCantidad(producto.stockMinimo)}</td>
                    <td className={claseCeldaTabla}>
                      <InsigniaEstado estado={estadoStock(producto.existencias, producto.stockMinimo)} />
                    </td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => abrirDetalle(producto.id)} className={claseBotonTabla}>
                          <Eye size={14} />
                          Ver
                        </button>
                        <button type="button" onClick={() => setModal({ tipo: 'formulario', producto })} className={claseBotonTabla}>
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

        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtrados.length} onCambiar={setPagina} />
      </div>

      <Modal
        abierto={Boolean(productoDetalle) && modal === null}
        titulo="Detalle del producto"
        onCerrar={cerrarDetalle}
      >
        {productoDetalle && (
          <DetalleArticulo
            clase="producto"
            id={productoDetalle.id}
            onEditar={() => {
              cerrarDetalle()
              setModal({ tipo: 'formulario', producto: productoDetalle })
            }}
            onMovimiento={() => {
              cerrarDetalle()
              setModal({ tipo: 'movimiento', productoId: productoDetalle.id })
            }}
          />
        )}
      </Modal>

      <Modal
        abierto={modal?.tipo === 'formulario'}
        titulo={modal?.tipo === 'formulario' && modal.producto ? 'Editar producto' : 'Registrar producto'}
        descripcion="Los campos marcados con * son obligatorios."
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === 'formulario' && (
          <ProductoFormulario
            key={modal.producto?.id ?? 'nuevo'}
            producto={modal.producto}
            onCancelar={() => setModal(null)}
            onGuardado={alGuardar}
          />
        )}
      </Modal>

      <Modal
        abierto={modal?.tipo === 'movimiento'}
        titulo="Registrar movimiento"
        descripcion="Entrada, salida o ajuste de un producto terminado."
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === 'movimiento' && (
          <MovimientoFormulario
            claseInicial="producto"
            articuloIdInicial={modal.productoId}
            onCancelar={() => setModal(null)}
            onGuardado={alGuardar}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
