'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Eye, Pencil, Plus, Truck, UserCheck, UserX } from 'lucide-react'

import { cambiarEstadoProveedor, useCompras } from '@/lib/compras/store'
import type { Compra, Proveedor } from '@/lib/compras/tipos'
import { ETIQUETAS_ESTADO_COMPRA } from '@/lib/compras/utilidades'
import { coincideBusqueda, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
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
  ErrorFormulario,
  EstadoVacio,
  Modal,
  Notificacion,
  Paginacion,
  useNotificacion,
  usePaginacion
} from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'
import { InsigniaDocumento } from '../ventas/ui'
import ProveedorFormulario from './proveedor-formulario'
import { AvisoConexionCompras, SECCION_COMPRAS } from './ui'

type FiltroEstado = 'activos' | 'inactivos' | 'todos'
type ModalActivo = { tipo: 'formulario'; proveedor?: Proveedor } | { tipo: 'detalle'; proveedorId: string } | null

interface Historial { compras: Compra[]; total: number; ultima?: string }

export default function ProveedoresVista() {
  const { proveedores, compras } = useCompras()
  const { mensaje, mostrar } = useNotificacion()

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('activos')
  const [modal, setModal] = useState<ModalActivo>(null)

  // Solo cuentan las compras no anuladas
  const historialPorProveedor = useMemo(() => {
    const mapa = new Map<string, Historial>()
    compras.forEach((compra) => {
      if (!compra.proveedorId || compra.estado === 'anulada') return
      const actual = mapa.get(compra.proveedorId) ?? { compras: [], total: 0 }
      actual.compras.push(compra)
      actual.total += compra.total
      if (!actual.ultima || compra.fecha > actual.ultima) actual.ultima = compra.fecha
      mapa.set(compra.proveedorId, actual)
    })
    return mapa
  }, [compras])

  const filtrados = useMemo(
    () =>
      proveedores.filter(
        (p) =>
          (filtroEstado === 'todos' || (filtroEstado === 'activos' ? p.activo : !p.activo)) &&
          coincideBusqueda(busqueda, p.codigo, p.nombre, p.ruc, p.contacto, p.telefono, p.correo, p.notas)
      ),
    [proveedores, busqueda, filtroEstado]
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtrados, 12)
  const proveedorDetalle = modal?.tipo === 'detalle' ? proveedores.find((p) => p.id === modal.proveedorId) : undefined

  const alGuardar = (texto: string) => {
    setModal(null)
    mostrar(texto)
  }

  return (
    <>
      <AvisoConexionCompras />
      <EncabezadoPagina
        titulo="Proveedores"
        descripcion="Proveedores de materia prima y su historial de compras."
        seccion={SECCION_COMPRAS}
        acciones={
          <button type="button" onClick={() => setModal({ tipo: 'formulario' })} className={claseBotonPrimario}>
            <Plus size={16} />
            Registrar proveedor
          </button>
        }
      />

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center">
          <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar por nombre, RUC, contacto o notas" />
          <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value as FiltroEstado); setPagina(1) }} className={`${claseInput} sm:w-44 sm:ml-auto`} aria-label="Filtrar por estado">
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>

        {filtrados.length === 0 ? (
          <EstadoVacio
            icono={Truck}
            titulo={proveedores.length ? 'No hay proveedores que coincidan' : 'Aún no hay proveedores'}
            descripcion={proveedores.length ? 'Pruebe con otra búsqueda o estado.' : 'Registre al primer proveedor para poder cargar compras.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>Código</th>
                  <th className={claseCabeceraTabla}>Proveedor</th>
                  <th className={claseCabeceraTabla}>Contacto</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Compras</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Total comprado</th>
                  <th className={claseCabeceraTabla}>Última compra</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visibles.map((proveedor) => {
                  const historial = historialPorProveedor.get(proveedor.id)
                  return (
                    <tr key={proveedor.id} className={`hover:bg-zinc-50/60 ${proveedor.activo ? '' : 'opacity-60'}`}>
                      <td className={`${claseCeldaTabla} font-mono text-xs`}>{proveedor.codigo}</td>
                      <td className={claseCeldaTabla}>
                        <p className="font-medium text-zinc-900">{proveedor.nombre}</p>
                        {proveedor.ruc && <p className="text-xs text-zinc-400">RUC {proveedor.ruc}</p>}
                      </td>
                      <td className={claseCeldaTabla}>
                        <p>{proveedor.contacto ?? proveedor.telefono ?? <span className="text-zinc-400">—</span>}</p>
                        {proveedor.contacto && proveedor.telefono && <p className="text-xs text-zinc-400">{proveedor.telefono}</p>}
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{historial?.compras.length ?? 0}</td>
                      <td className={`${claseCeldaTabla} text-right font-semibold text-zinc-900`}>{formatoCordobas(historial?.total ?? 0)}</td>
                      <td className={claseCeldaTabla}>{historial?.ultima ? formatoFecha(historial.ultima) : <span className="text-zinc-400">—</span>}</td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => setModal({ tipo: 'detalle', proveedorId: proveedor.id })} className={claseBotonTabla}>
                            <Eye size={14} />
                            Ver
                          </button>
                          <button type="button" onClick={() => setModal({ tipo: 'formulario', proveedor })} className={claseBotonTabla}>
                            <Pencil size={14} />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtrados.length} onCambiar={setPagina} />
      </div>

      <Modal abierto={Boolean(proveedorDetalle)} titulo="Ficha del proveedor" onCerrar={() => setModal(null)}>
        {proveedorDetalle && (
          <DetalleProveedor
            proveedor={proveedorDetalle}
            historial={historialPorProveedor.get(proveedorDetalle.id)}
            onEditar={() => setModal({ tipo: 'formulario', proveedor: proveedorDetalle })}
            onCambio={mostrar}
          />
        )}
      </Modal>

      <Modal
        abierto={modal?.tipo === 'formulario'}
        titulo={modal?.tipo === 'formulario' && modal.proveedor ? 'Editar proveedor' : 'Registrar proveedor'}
        descripcion="Los campos marcados con * son obligatorios."
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === 'formulario' && (
          <ProveedorFormulario key={modal.proveedor?.id ?? 'nuevo'} proveedor={modal.proveedor} onCancelar={() => setModal(null)} onGuardado={alGuardar} />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function DetalleProveedor({
  proveedor,
  historial,
  onEditar,
  onCambio
}: {
  proveedor: Proveedor
  historial?: Historial
  onEditar: () => void
  onCambio: (mensaje: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const recientes = historial?.compras.slice(0, 8) ?? []

  const cambiarEstado = async () => {
    setProcesando(true)
    const resultado = await cambiarEstadoProveedor(proveedor.id, !proveedor.activo)
    setProcesando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onCambio(proveedor.activo ? 'Proveedor desactivado' : 'Proveedor reactivado')
  }

  return (
    <div className="space-y-6">
      <ErrorFormulario mensaje={error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-zinc-400">{proveedor.codigo}</p>
          <p className="text-lg font-semibold text-zinc-900">{proveedor.nombre}</p>
          {!proveedor.activo && <p className="text-xs text-zinc-500 mt-0.5">Inactivo: no aparece al registrar compras.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={procesando} onClick={cambiarEstado} className={claseBotonSecundario}>
            {proveedor.activo ? <UserX size={15} /> : <UserCheck size={15} />}
            {proveedor.activo ? 'Desactivar' : 'Reactivar'}
          </button>
          <button type="button" onClick={onEditar} className={claseBotonSecundario}><Pencil size={15} />Editar</button>
          {proveedor.activo && (
            <Link href={`/compras/nueva?proveedor=${encodeURIComponent(proveedor.id)}`} className={claseBotonPrimario}>
              <Truck size={15} />
              Nueva compra
            </Link>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="RUC" valor={proveedor.ruc} />
        <DatoDetalle etiqueta="Contacto" valor={proveedor.contacto} />
        <DatoDetalle etiqueta="Teléfono" valor={proveedor.telefono} />
        <DatoDetalle etiqueta="Correo" valor={proveedor.correo} />
        <DatoDetalle etiqueta="Dirección" valor={proveedor.direccion} />
        <DatoDetalle etiqueta="Total comprado" valor={formatoCordobas(historial?.total ?? 0)} />
      </dl>

      {proveedor.notas && (
        <div>
          <p className="text-xs text-zinc-500 mb-1">Notas</p>
          <p className="text-sm text-zinc-700 whitespace-pre-line">{proveedor.notas}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">Últimas compras</h3>
        {recientes.length === 0 ? (
          <p className="text-sm text-zinc-400">Aún no hay compras a este proveedor.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[420px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>Fecha</th>
                  <th className={claseCabeceraTabla}>Compra</th>
                  <th className={claseCabeceraTabla}>Factura</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Total</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {recientes.map((compra) => (
                  <tr key={compra.id}>
                    <td className={claseCeldaTabla}>{formatoFecha(compra.fecha)}</td>
                    <td className={`${claseCeldaTabla} font-mono text-xs`}>
                      <Link href={`/compras?detalle=${encodeURIComponent(compra.id)}`} className="hover:underline">{compra.codigo}</Link>
                    </td>
                    <td className={claseCeldaTabla}>{compra.numeroFactura ?? '—'}</td>
                    <td className={`${claseCeldaTabla} text-right font-medium`}>{formatoCordobas(compra.total)}</td>
                    <td className={claseCeldaTabla}><InsigniaDocumento anulado={compra.estado === 'anulada'} texto={ETIQUETAS_ESTADO_COMPRA[compra.estado]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
