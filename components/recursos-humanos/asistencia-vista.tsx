'use client'

import { useMemo, useState } from 'react'
import { CalendarCheck, CheckCheck, Clock, Save, Trash2, UserX } from 'lucide-react'

import { fechaHoy, formatoCantidad, formatoFecha, validarNumero } from '@/lib/inventario/utilidades'
import { eliminarAsistencia, guardarAsistencias, useRecursosHumanos } from '@/lib/recursos-humanos/store'
import type { Asistencia, Empleado, EstadoAsistencia } from '@/lib/recursos-humanos/tipos'
import { ETIQUETAS_ASISTENCIA, nombreCompleto } from '@/lib/recursos-humanos/utilidades'
import {
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
  Notificacion,
  Paginacion,
  TarjetaIndicador,
  useNotificacion,
  usePaginacion
} from '../inventario/ui'
import { AvisoConexionRrhh, InsigniaAsistencia, SECCION_RRHH } from './ui'

const ESTADOS = Object.keys(ETIQUETAS_ASISTENCIA) as EstadoAsistencia[]

export default function AsistenciaVista() {
  const { empleados, asistencias } = useRecursosHumanos()
  const { mensaje, mostrar } = useNotificacion()
  const [fecha, setFecha] = useState(fechaHoy())

  // Personal que debía asistir ese día
  const convocados = useMemo(
    () =>
      empleados
        .filter((e) => e.estado !== 'inactivo' && e.fechaIngreso <= fecha)
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [empleados, fecha]
  )
  const delDia = useMemo(() => asistencias.filter((a) => a.fecha === fecha), [asistencias, fecha])

  return (
    <>
      <AvisoConexionRrhh />
      <EncabezadoPagina
        titulo="Asistencia"
        descripcion="Control diario de asistencia, ausencias y horas extra."
        seccion={SECCION_RRHH}
      />

      <div className={`${claseTarjeta} mb-6`}>
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-stone-900">Registro del día</h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {delDia.length > 0 ? `Ya hay ${delDia.length} registros guardados para esta fecha; puede corregirlos.` : 'Aún no se ha registrado asistencia para esta fecha.'}
            </p>
          </div>
          <div className="sm:w-48">
            <label htmlFor="asistencia-fecha" className="block text-xs font-medium text-stone-700 mb-1.5">Fecha</label>
            <input
              id="asistencia-fecha"
              type="date"
              value={fecha}
              max={fechaHoy()}
              onChange={(e) => e.target.value && setFecha(e.target.value)}
              className={claseInput}
            />
          </div>
        </div>

        {convocados.length === 0 ? (
          <EstadoVacio icono={CalendarCheck} titulo="No hay empleados vigentes para esta fecha" descripcion="Registre empleados en la sección Empleados." />
        ) : (
          <HojaAsistencia
            // Se reinicia al cambiar de fecha o cuando llegan datos nuevos de la base
            key={`${fecha}-${delDia.map((a) => a.id).join('.')}-${convocados.length}`}
            fecha={fecha}
            empleados={convocados}
            registrados={delDia}
            onGuardado={mostrar}
          />
        )}
      </div>

      <Historial empleados={empleados} asistencias={asistencias} onEliminado={mostrar} />

      <Notificacion mensaje={mensaje} />
    </>
  )
}

type Borrador = Record<string, { estado: EstadoAsistencia; horasExtra: string; observaciones: string }>

function HojaAsistencia({
  fecha,
  empleados,
  registrados,
  onGuardado
}: {
  fecha: string
  empleados: Empleado[]
  registrados: Asistencia[]
  onGuardado: (mensaje: string) => void
}) {
  const [borrador, setBorrador] = useState<Borrador>(() =>
    Object.fromEntries(
      empleados.map((e) => {
        const previo = registrados.find((a) => a.empleadoId === e.id)
        return [e.id, {
          estado: previo?.estado ?? (e.estado === 'vacaciones' ? 'vacaciones' : 'presente'),
          horasExtra: previo ? String(previo.horasExtra) : '0',
          observaciones: previo?.observaciones ?? ''
        }]
      })
    )
  )
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = (id: string, campo: keyof Borrador[string], valor: string) => {
    setBorrador((actual) => ({ ...actual, [id]: { ...actual[id], [campo]: valor } }))
    setError(null)
  }

  const todosPresentes = () => {
    setBorrador((actual) =>
      Object.fromEntries(Object.entries(actual).map(([id, fila]) => [id, { ...fila, estado: 'presente' as EstadoAsistencia }]))
    )
  }

  const guardar = async () => {
    const registros = []
    for (const empleado of empleados) {
      const fila = borrador[empleado.id]
      const horas = validarNumero(fila.horasExtra || '0', { etiqueta: `Las horas extra de ${nombreCompleto(empleado)}` })
      if (horas.error) return setError(horas.error)
      if (horas.valor! > 24) return setError(`Las horas extra de ${nombreCompleto(empleado)} no pueden superar 24.`)
      registros.push({ empleadoId: empleado.id, fecha, estado: fila.estado, horasExtra: horas.valor!, observaciones: fila.observaciones })
    }
    setEnviando(true)
    const resultado = await guardarAsistencias(registros)
    setEnviando(false)
    if (!resultado.ok) return setError(resultado.error)
    onGuardado(`Asistencia del ${formatoFecha(fecha)} guardada`)
  }

  return (
    <>
      {error && <div className="px-4 pt-4"><ErrorFormulario mensaje={error} /></div>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="bg-stone-50">
            <tr>
              <th className={claseCabeceraTabla}>Empleado</th>
              <th className={claseCabeceraTabla}>Estado</th>
              <th className={claseCabeceraTabla}>Horas extra</th>
              <th className={claseCabeceraTabla}>Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {empleados.map((empleado) => {
              const fila = borrador[empleado.id]
              return (
                <tr key={empleado.id}>
                  <td className={claseCeldaTabla}>
                    <p className="font-medium text-stone-900">{nombreCompleto(empleado)}</p>
                    <p className="text-xs text-stone-400">{empleado.codigo} · {empleado.cargo}</p>
                  </td>
                  <td className="px-4 py-2 w-48">
                    <select
                      value={fila.estado}
                      onChange={(e) => cambiar(empleado.id, 'estado', e.target.value)}
                      className={claseInput}
                      aria-label={`Estado de ${nombreCompleto(empleado)}`}
                    >
                      {ESTADOS.map((estado) => <option key={estado} value={estado}>{ETIQUETAS_ASISTENCIA[estado]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2 w-32">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.5"
                      inputMode="decimal"
                      value={fila.horasExtra}
                      onChange={(e) => cambiar(empleado.id, 'horasExtra', e.target.value)}
                      className={claseInput}
                      aria-label={`Horas extra de ${nombreCompleto(empleado)}`}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={fila.observaciones}
                      onChange={(e) => cambiar(empleado.id, 'observaciones', e.target.value)}
                      maxLength={250}
                      placeholder="Opcional"
                      className={claseInput}
                      aria-label={`Observaciones de ${nombreCompleto(empleado)}`}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-stone-200 p-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={todosPresentes} className={claseBotonSecundario}>
          <CheckCheck size={16} />
          Marcar todos presentes
        </button>
        <button type="button" onClick={guardar} disabled={enviando} className={claseBotonPrimario}>
          <Save size={16} />
          {enviando ? 'Guardando...' : 'Guardar asistencia'}
        </button>
      </div>
    </>
  )
}

function Historial({
  empleados,
  asistencias,
  onEliminado
}: {
  empleados: Empleado[]
  asistencias: Asistencia[]
  onEliminado: (mensaje: string) => void
}) {
  const [mes, setMes] = useState(fechaHoy().slice(0, 7))
  const [filtroEmpleado, setFiltroEmpleado] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoAsistencia | ''>('')
  const [error, setError] = useState<string | null>(null)

  const porId = useMemo(() => new Map(empleados.map((e) => [e.id, e])), [empleados])
  const delMes = useMemo(
    () => asistencias.filter((a) => (!mes || a.fecha.startsWith(mes)) && (!filtroEmpleado || a.empleadoId === filtroEmpleado)),
    [asistencias, mes, filtroEmpleado]
  )
  const filtrados = filtroEstado ? delMes.filter((a) => a.estado === filtroEstado) : delMes
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtrados, 12)

  const ausencias = delMes.filter((a) => a.estado === 'ausente').length
  const tardanzas = delMes.filter((a) => a.estado === 'tardanza').length
  const horasExtra = delMes.reduce((total, a) => total + a.horasExtra, 0)

  const eliminar = async (registro: Asistencia) => {
    const empleado = porId.get(registro.empleadoId)
    if (!window.confirm(`¿Eliminar el registro del ${formatoFecha(registro.fecha)}${empleado ? ` de ${nombreCompleto(empleado)}` : ''}?`)) return
    const resultado = await eliminarAsistencia(registro.id)
    if (!resultado.ok) return setError(resultado.error)
    setError(null)
    onEliminado('Registro eliminado')
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Ausencias" valor={formatoCantidad(ausencias)} detalle="Se descuentan en la nómina" icono={UserX} tono={ausencias ? 'peligro' : 'neutro'} />
        <TarjetaIndicador titulo="Tardanzas" valor={formatoCantidad(tardanzas)} detalle="En el período filtrado" icono={Clock} tono={tardanzas ? 'alerta' : 'neutro'} />
        <TarjetaIndicador titulo="Horas extra" valor={formatoCantidad(horasExtra)} detalle="Se pagan al doble en la nómina" icono={CalendarCheck} tono="positivo" />
      </div>

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="font-semibold text-stone-900">Historial</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex">
            <input type="month" value={mes} onChange={(e) => { setMes(e.target.value); setPagina(1) }} className={`${claseInput} lg:w-44`} aria-label="Mes" />
            <select value={filtroEmpleado} onChange={(e) => { setFiltroEmpleado(e.target.value); setPagina(1) }} className={`${claseInput} lg:w-52`} aria-label="Filtrar por empleado">
              <option value="">Todos los empleados</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{nombreCompleto(e)}</option>)}
            </select>
            <select value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value as EstadoAsistencia | ''); setPagina(1) }} className={`${claseInput} lg:w-40`} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              {ESTADOS.map((estado) => <option key={estado} value={estado}>{ETIQUETAS_ASISTENCIA[estado]}</option>)}
            </select>
          </div>
        </div>

        {error && <div className="px-4 pt-4"><ErrorFormulario mensaje={error} /></div>}

        {filtrados.length === 0 ? (
          <EstadoVacio icono={CalendarCheck} titulo="Sin registros" descripcion="No hay asistencia registrada con estos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Fecha</th>
                  <th className={claseCabeceraTabla}>Empleado</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Horas extra</th>
                  <th className={claseCabeceraTabla}>Observaciones</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((registro) => {
                  const empleado = porId.get(registro.empleadoId)
                  return (
                    <tr key={registro.id} className="hover:bg-stone-50/60">
                      <td className={claseCeldaTabla}>{formatoFecha(registro.fecha)}</td>
                      <td className={`${claseCeldaTabla} font-medium text-stone-900`}>{empleado ? nombreCompleto(empleado) : '—'}</td>
                      <td className={claseCeldaTabla}><InsigniaAsistencia estado={registro.estado} /></td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(registro.horasExtra)}</td>
                      <td className={`${claseCeldaTabla} text-stone-500 max-w-xs truncate`}>{registro.observaciones ?? ''}</td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <button type="button" onClick={() => eliminar(registro)} className={claseBotonTabla}>
                          <Trash2 size={14} />
                          Eliminar
                        </button>
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
    </>
  )
}
