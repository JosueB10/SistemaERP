'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Eye, Pencil, Plus, ShoppingCart, UserCheck, Users, UserX } from 'lucide-react'

import { coincideBusqueda, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { cambiarEstadoCliente, useVentas } from '@/lib/ventas/store'
import type { Cliente, Venta } from '@/lib/ventas/tipos'
import { ETIQUETAS_ESTADO_VENTA } from '@/lib/ventas/utilidades'
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
import ClienteFormulario from './cliente-formulario'
import { AvisoConexionVentas, InsigniaDocumento, SECCION_VENTAS } from './ui'

type FiltroEstado = 'activos' | 'inactivos' | 'todos'
type ModalActivo = { tipo: 'formulario'; cliente?: Cliente } | { tipo: 'detalle'; clienteId: string } | null

interface Historial { ventas: Venta[]; total: number; ultima?: string }

export default function ClientesVista() {
  const { clientes, ventas } = useVentas()
  const { mensaje, mostrar } = useNotificacion()

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('activos')
  const [modal, setModal] = useState<ModalActivo>(null)

  // Solo cuentan las ventas completadas
  const historialPorCliente = useMemo(() => {
    const mapa = new Map<string, Historial>()
    ventas.forEach((venta) => {
      if (!venta.clienteId || venta.estado !== 'completada') return
      const actual = mapa.get(venta.clienteId) ?? { ventas: [], total: 0 }
      actual.ventas.push(venta)
      actual.total += venta.total
      if (!actual.ultima || venta.fecha > actual.ultima) actual.ultima = venta.fecha
      mapa.set(venta.clienteId, actual)
    })
    return mapa
  }, [ventas])

  const filtrados = useMemo(
    () =>
      clientes.filter(
        (c) =>
          (filtroEstado === 'todos' || (filtroEstado === 'activos' ? c.activo : !c.activo)) &&
          coincideBusqueda(busqueda, c.codigo, c.nombre, c.identificacion, c.telefono, c.correo)
      ),
    [clientes, busqueda, filtroEstado]
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtrados, 12)
  const clienteDetalle = modal?.tipo === 'detalle' ? clientes.find((c) => c.id === modal.clienteId) : undefined

  const alGuardar = (texto: string) => {
    setModal(null)
    mostrar(texto)
  }

  return (
    <>
      <AvisoConexionVentas />
      <EncabezadoPagina
        titulo="Clientes"
        descripcion="Cartera de clientes y su historial de compras."
        seccion={SECCION_VENTAS}
        acciones={
          <button type="button" onClick={() => setModal({ tipo: 'formulario' })} className={claseBotonPrimario}>
            <Plus size={16} />
            Registrar cliente
          </button>
        }
      />

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center">
          <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar por nombre, cédula, teléfono o correo" />
          <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value as FiltroEstado); setPagina(1) }} className={`${claseInput} sm:w-44 sm:ml-auto`} aria-label="Filtrar por estado">
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
            <option value="todos">Todos</option>
          </select>
        </div>

        {filtrados.length === 0 ? (
          <EstadoVacio
            icono={Users}
            titulo={clientes.length ? 'No hay clientes que coincidan' : 'Aún no hay clientes'}
            descripcion={clientes.length ? 'Pruebe con otra búsqueda o estado.' : 'Registre al primer cliente. Las ventas sin cliente quedan como venta de contado.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Código</th>
                  <th className={claseCabeceraTabla}>Cliente</th>
                  <th className={claseCabeceraTabla}>Contacto</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Compras</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Total comprado</th>
                  <th className={claseCabeceraTabla}>Última compra</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((cliente) => {
                  const historial = historialPorCliente.get(cliente.id)
                  return (
                    <tr key={cliente.id} className={`hover:bg-stone-50/60 ${cliente.activo ? '' : 'opacity-60'}`}>
                      <td className={`${claseCeldaTabla} font-mono text-xs`}>{cliente.codigo}</td>
                      <td className={claseCeldaTabla}>
                        <p className="font-medium text-stone-900">{cliente.nombre}</p>
                        {cliente.identificacion && <p className="text-xs text-stone-400">{cliente.identificacion}</p>}
                      </td>
                      <td className={claseCeldaTabla}>
                        <p>{cliente.telefono ?? <span className="text-stone-400">—</span>}</p>
                        {cliente.correo && <p className="text-xs text-stone-400">{cliente.correo}</p>}
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{historial?.ventas.length ?? 0}</td>
                      <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCordobas(historial?.total ?? 0)}</td>
                      <td className={claseCeldaTabla}>{historial?.ultima ? formatoFecha(historial.ultima) : <span className="text-stone-400">—</span>}</td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => setModal({ tipo: 'detalle', clienteId: cliente.id })} className={claseBotonTabla}>
                            <Eye size={14} />
                            Ver
                          </button>
                          <button type="button" onClick={() => setModal({ tipo: 'formulario', cliente })} className={claseBotonTabla}>
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

      <Modal abierto={Boolean(clienteDetalle)} titulo="Ficha del cliente" onCerrar={() => setModal(null)}>
        {clienteDetalle && (
          <DetalleCliente
            cliente={clienteDetalle}
            historial={historialPorCliente.get(clienteDetalle.id)}
            onEditar={() => setModal({ tipo: 'formulario', cliente: clienteDetalle })}
            onCambio={mostrar}
          />
        )}
      </Modal>

      <Modal
        abierto={modal?.tipo === 'formulario'}
        titulo={modal?.tipo === 'formulario' && modal.cliente ? 'Editar cliente' : 'Registrar cliente'}
        descripcion="Los campos marcados con * son obligatorios."
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === 'formulario' && (
          <ClienteFormulario key={modal.cliente?.id ?? 'nuevo'} cliente={modal.cliente} onCancelar={() => setModal(null)} onGuardado={alGuardar} />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function DetalleCliente({
  cliente,
  historial,
  onEditar,
  onCambio
}: {
  cliente: Cliente
  historial?: Historial
  onEditar: () => void
  onCambio: (mensaje: string) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const recientes = historial?.ventas.slice(0, 8) ?? []

  const cambiarEstado = async () => {
    setProcesando(true)
    const resultado = await cambiarEstadoCliente(cliente.id, !cliente.activo)
    setProcesando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onCambio(cliente.activo ? 'Cliente desactivado' : 'Cliente reactivado')
  }

  return (
    <div className="space-y-6">
      <ErrorFormulario mensaje={error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-stone-400">{cliente.codigo}</p>
          <p className="text-lg font-semibold text-stone-900">{cliente.nombre}</p>
          {!cliente.activo && <p className="text-xs text-stone-500 mt-0.5">Inactivo: no aparece al registrar ventas.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={procesando} onClick={cambiarEstado} className={claseBotonSecundario}>
            {cliente.activo ? <UserX size={15} /> : <UserCheck size={15} />}
            {cliente.activo ? 'Desactivar' : 'Reactivar'}
          </button>
          <button type="button" onClick={onEditar} className={claseBotonSecundario}><Pencil size={15} />Editar</button>
          {cliente.activo && (
            <Link href={`/ventas/nueva?cliente=${encodeURIComponent(cliente.id)}`} className={claseBotonPrimario}>
              <ShoppingCart size={15} />
              Nueva venta
            </Link>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Cédula o RUC" valor={cliente.identificacion} />
        <DatoDetalle etiqueta="Teléfono" valor={cliente.telefono} />
        <DatoDetalle etiqueta="Correo" valor={cliente.correo} />
        <DatoDetalle etiqueta="Dirección" valor={cliente.direccion} />
        <DatoDetalle etiqueta="Total comprado" valor={formatoCordobas(historial?.total ?? 0)} />
        <DatoDetalle etiqueta="Compras" valor={String(historial?.ventas.length ?? 0)} />
      </dl>

      {cliente.notas && (
        <div>
          <p className="text-xs text-stone-500 mb-1">Notas</p>
          <p className="text-sm text-stone-700 whitespace-pre-line">{cliente.notas}</p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-stone-900 mb-2">Últimas compras</h3>
        {recientes.length === 0 ? (
          <p className="text-sm text-stone-400">Este cliente aún no tiene compras.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200">
            <table className="w-full min-w-[420px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Fecha</th>
                  <th className={claseCabeceraTabla}>Venta</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Total</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {recientes.map((venta) => (
                  <tr key={venta.id}>
                    <td className={claseCeldaTabla}>{formatoFecha(venta.fecha)}</td>
                    <td className={`${claseCeldaTabla} font-mono text-xs`}>
                      <Link href={`/ventas?detalle=${encodeURIComponent(venta.id)}`} className="hover:underline">{venta.codigo}</Link>
                    </td>
                    <td className={`${claseCeldaTabla} text-right font-medium`}>{formatoCordobas(venta.total)}</td>
                    <td className={claseCeldaTabla}><InsigniaDocumento anulado={venta.estado === 'anulada'} pendiente={venta.estado === 'pendiente'} texto={ETIQUETAS_ESTADO_VENTA[venta.estado]} /></td>
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
