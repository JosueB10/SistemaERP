'use client'

import { useMemo, useState } from 'react'
import { Eye, Pencil, Plus, UserCheck, UserX, Users } from 'lucide-react'

import { categoriasUnicas, coincideBusqueda, fechaHoy, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { cambiarEstadoEmpleado, useRecursosHumanos } from '@/lib/recursos-humanos/store'
import type { Empleado, EstadoEmpleado } from '@/lib/recursos-humanos/tipos'
import {
  antiguedad,
  ETIQUETAS_CONTRATO,
  ETIQUETAS_ESTADO_EMPLEADO,
  iniciales,
  nombreCompleto,
  salarioDiario
} from '@/lib/recursos-humanos/utilidades'
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
import EmpleadoFormulario from './empleado-formulario'
import { AvisoConexionRrhh, DatoDetalle, InsigniaAsistencia, InsigniaEmpleado, SECCION_RRHH } from './ui'

type ModalActivo = { tipo: 'formulario'; empleado?: Empleado } | { tipo: 'detalle'; empleadoId: string } | null

export default function EmpleadosVista() {
  const { empleados } = useRecursosHumanos()
  const { mensaje, mostrar } = useNotificacion()

  const [busqueda, setBusqueda] = useState('')
  const [filtroArea, setFiltroArea] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoEmpleado | 'vigentes' | ''>('vigentes')
  const [modal, setModal] = useState<ModalActivo>(null)

  const filtrados = useMemo(
    () =>
      empleados.filter(
        (item) =>
          coincideBusqueda(busqueda, item.codigo, item.nombres, item.apellidos, item.cedula, item.cargo) &&
          (!filtroArea || item.area === filtroArea) &&
          (filtroEstado === '' || (filtroEstado === 'vigentes' ? item.estado !== 'inactivo' : item.estado === filtroEstado))
      ),
    [empleados, busqueda, filtroArea, filtroEstado]
  )

  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtrados, 10)
  const areas = categoriasUnicas(empleados.filter((e) => e.area).map((e) => ({ categoria: e.area })))
  const hayFiltros = busqueda || filtroArea || filtroEstado !== 'vigentes'
  const empleadoDetalle = modal?.tipo === 'detalle' ? empleados.find((e) => e.id === modal.empleadoId) : undefined

  const limpiarFiltros = () => {
    setBusqueda('')
    setFiltroArea('')
    setFiltroEstado('vigentes')
  }

  const alGuardar = (texto: string) => {
    setModal(null)
    mostrar(texto)
  }

  return (
    <>
      <AvisoConexionRrhh />
      <EncabezadoPagina
        titulo="Empleados"
        descripcion="Expediente del personal, cargos y salarios."
        seccion={SECCION_RRHH}
        acciones={
          <button type="button" onClick={() => setModal({ tipo: 'formulario' })} className={claseBotonPrimario}>
            <Plus size={16} />
            Registrar empleado
          </button>
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
            placeholder="Buscar por nombre, código, cédula o cargo"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-1 lg:justify-end">
            <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} className={`${claseInput} lg:w-44`} aria-label="Filtrar por área">
              <option value="">Todas las áreas</option>
              {areas.map((area) => <option key={area} value={area}>{area}</option>)}
            </select>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoEmpleado | 'vigentes' | '')}
              className={`${claseInput} lg:w-44`}
              aria-label="Filtrar por estado"
            >
              <option value="vigentes">Personal vigente</option>
              <option value="">Todos, incluso bajas</option>
              {(Object.keys(ETIQUETAS_ESTADO_EMPLEADO) as EstadoEmpleado[]).map((estado) => (
                <option key={estado} value={estado}>{ETIQUETAS_ESTADO_EMPLEADO[estado]}</option>
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
            icono={Users}
            titulo={hayFiltros ? 'No hay empleados que coincidan' : 'Aún no hay empleados'}
            descripcion={hayFiltros ? 'Pruebe con otros filtros o términos de búsqueda.' : 'Registre al primer colaborador.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Código</th>
                  <th className={claseCabeceraTabla}>Empleado</th>
                  <th className={claseCabeceraTabla}>Cargo</th>
                  <th className={claseCabeceraTabla}>Área</th>
                  <th className={claseCabeceraTabla}>Ingreso</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Salario mensual</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((empleado) => (
                  <tr key={empleado.id} className="hover:bg-stone-50/60">
                    <td className={`${claseCeldaTabla} font-mono text-xs`}>{empleado.codigo}</td>
                    <td className={claseCeldaTabla}>
                      <p className="font-medium text-stone-900">{nombreCompleto(empleado)}</p>
                      {empleado.cedula && <p className="text-xs text-stone-400">{empleado.cedula}</p>}
                    </td>
                    <td className={claseCeldaTabla}>{empleado.cargo}</td>
                    <td className={claseCeldaTabla}>{empleado.area || <span className="text-stone-400">—</span>}</td>
                    <td className={claseCeldaTabla}>{formatoFecha(empleado.fechaIngreso)}</td>
                    <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCordobas(empleado.salarioMensual)}</td>
                    <td className={claseCeldaTabla}><InsigniaEmpleado estado={empleado.estado} /></td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => setModal({ tipo: 'detalle', empleadoId: empleado.id })} className={claseBotonTabla}>
                          <Eye size={14} />
                          Ver
                        </button>
                        <button type="button" onClick={() => setModal({ tipo: 'formulario', empleado })} className={claseBotonTabla}>
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

      <Modal abierto={Boolean(empleadoDetalle)} titulo="Expediente del empleado" onCerrar={() => setModal(null)}>
        {empleadoDetalle && (
          <DetalleEmpleado
            empleado={empleadoDetalle}
            onEditar={() => setModal({ tipo: 'formulario', empleado: empleadoDetalle })}
            onCambio={mostrar}
          />
        )}
      </Modal>

      <Modal
        abierto={modal?.tipo === 'formulario'}
        titulo={modal?.tipo === 'formulario' && modal.empleado ? 'Editar empleado' : 'Registrar empleado'}
        descripcion="Los campos marcados con * son obligatorios."
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === 'formulario' && (
          <EmpleadoFormulario
            key={modal.empleado?.id ?? 'nuevo'}
            empleado={modal.empleado}
            onCancelar={() => setModal(null)}
            onGuardado={alGuardar}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function DetalleEmpleado({
  empleado,
  onEditar,
  onCambio
}: {
  empleado: Empleado
  onEditar: () => void
  onCambio: (mensaje: string) => void
}) {
  const { asistencias } = useRecursosHumanos()
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const hoy = fechaHoy()
  const recientes = asistencias.filter((a) => a.empleadoId === empleado.id).slice(0, 8)
  const esBaja = empleado.estado === 'inactivo'

  const cambiarEstado = async () => {
    if (!esBaja && !window.confirm(`¿Dar de baja a ${nombreCompleto(empleado)}? Dejará de aparecer en asistencia y nómina.`)) return
    setProcesando(true)
    const resultado = await cambiarEstadoEmpleado(empleado.id, esBaja ? 'activo' : 'inactivo')
    setProcesando(false)
    if (!resultado.ok) {
      setError(resultado.error)
      return
    }
    onCambio(esBaja ? 'Empleado reactivado' : 'Empleado dado de baja')
  }

  return (
    <div className="space-y-6">
      <ErrorFormulario mensaje={error} />

      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-stone-800 text-white flex items-center justify-center text-lg font-semibold shrink-0">
          {iniciales(empleado)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-stone-900 text-lg truncate">{nombreCompleto(empleado)}</p>
          <p className="text-sm text-stone-500">{empleado.cargo}{empleado.area ? ` · ${empleado.area}` : ''}</p>
        </div>
        <div className="ml-auto"><InsigniaEmpleado estado={empleado.estado} /></div>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Código" valor={<span className="font-mono text-xs">{empleado.codigo}</span>} />
        <DatoDetalle etiqueta="Cédula" valor={empleado.cedula} />
        <DatoDetalle etiqueta="N.º INSS" valor={empleado.numeroInss} />
        <DatoDetalle etiqueta="Teléfono" valor={empleado.telefono} />
        <DatoDetalle etiqueta="Correo" valor={empleado.correo} />
        <DatoDetalle etiqueta="Dirección" valor={empleado.direccion} />
      </dl>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 border-t border-stone-200 pt-5">
        <DatoDetalle etiqueta="Fecha de ingreso" valor={formatoFecha(empleado.fechaIngreso)} />
        <DatoDetalle etiqueta="Antigüedad" valor={antiguedad(empleado.fechaIngreso, empleado.fechaBaja ?? hoy)} />
        <DatoDetalle etiqueta="Contrato" valor={ETIQUETAS_CONTRATO[empleado.tipoContrato]} />
        <DatoDetalle etiqueta="Salario mensual" valor={formatoCordobas(empleado.salarioMensual)} />
        <DatoDetalle etiqueta="Salario diario" valor={formatoCordobas(salarioDiario(empleado.salarioMensual))} />
        {empleado.fechaBaja && <DatoDetalle etiqueta="Fecha de baja" valor={formatoFecha(empleado.fechaBaja)} />}
      </dl>

      <div className="border-t border-stone-200 pt-5">
        <h3 className="text-sm font-semibold text-stone-900 mb-3">Asistencia reciente</h3>
        {recientes.length === 0 ? (
          <p className="text-sm text-stone-400">Sin registros de asistencia.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recientes.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-stone-600">{formatoFecha(a.fecha)}</span>
                <span className="flex items-center gap-3">
                  {a.horasExtra > 0 && <span className="text-xs text-stone-500">{a.horasExtra} h extra</span>}
                  <InsigniaAsistencia estado={a.estado} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={cambiarEstado} disabled={procesando} className={claseBotonSecundario}>
          {esBaja ? <UserCheck size={16} /> : <UserX size={16} />}
          {esBaja ? 'Reactivar' : 'Dar de baja'}
        </button>
        <button type="button" onClick={onEditar} className={claseBotonPrimario}>
          <Pencil size={16} />
          Editar
        </button>
      </div>
    </div>
  )
}
