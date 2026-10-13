'use client'

import { useState } from 'react'
import { BadgeCheck, Eye, Plus, Trash2, Wallet } from 'lucide-react'

import { fechaHoy, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { eliminarNomina, marcarNominaPagada, useRecursosHumanos } from '@/lib/recursos-humanos/store'
import type { Nomina } from '@/lib/recursos-humanos/tipos'
import { ETIQUETAS_PERIODICIDAD, nombreCompleto } from '@/lib/recursos-humanos/utilidades'
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
  InsigniaNeutra,
  Modal,
  Notificacion,
  Paginacion,
  useNotificacion,
  usePaginacion
} from '../inventario/ui'
import NominaGenerar from './nomina-generar'
import { AvisoConexionRrhh, DatoDetalle, InsigniaNomina, SECCION_RRHH } from './ui'

type ModalActivo = { tipo: 'generar' } | { tipo: 'detalle'; nominaId: string } | null

export default function NominaVista() {
  const { nominas } = useRecursosHumanos()
  const { mensaje, mostrar } = useNotificacion()
  const [modal, setModal] = useState<ModalActivo>(null)
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(nominas, 10)

  const nominaDetalle = modal?.tipo === 'detalle' ? nominas.find((n) => n.id === modal.nominaId) : undefined

  const cerrarConMensaje = (texto: string) => {
    setModal(null)
    mostrar(texto)
  }

  return (
    <>
      <AvisoConexionRrhh />
      <EncabezadoPagina
        titulo="Nómina"
        descripcion="Planillas de pago con INSS, IR, horas extra y deducciones."
        seccion={SECCION_RRHH}
        acciones={
          <button type="button" onClick={() => setModal({ tipo: 'generar' })} className={claseBotonPrimario}>
            <Plus size={16} />
            Generar planilla
          </button>
        }
      />

      <div className={claseTarjeta}>
        {nominas.length === 0 ? (
          <EstadoVacio icono={Wallet} titulo="Aún no hay planillas" descripcion="Genere la primera planilla del período." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Período</th>
                  <th className={claseCabeceraTabla}>Tipo</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Empleados</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Devengado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Deducciones</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Neto a pagar</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((nomina) => (
                  <tr key={nomina.id} className="hover:bg-stone-50/60">
                    <td className={`${claseCeldaTabla} font-medium text-stone-900`}>
                      {formatoFecha(nomina.periodoInicio)} – {formatoFecha(nomina.periodoFin)}
                    </td>
                    <td className={claseCeldaTabla}><InsigniaNeutra>{ETIQUETAS_PERIODICIDAD[nomina.periodicidad]}</InsigniaNeutra></td>
                    <td className={`${claseCeldaTabla} text-right`}>{nomina.lineas.length}</td>
                    <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(nomina.totalDevengado)}</td>
                    <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCordobas(nomina.totalDeducciones)}</td>
                    <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCordobas(nomina.totalNeto)}</td>
                    <td className={claseCeldaTabla}><InsigniaNomina estado={nomina.estado} /></td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      <button type="button" onClick={() => setModal({ tipo: 'detalle', nominaId: nomina.id })} className={claseBotonTabla}>
                        <Eye size={14} />
                        Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={nominas.length} onCambiar={setPagina} />
      </div>

      <Modal
        abierto={modal?.tipo === 'generar'}
        titulo="Generar planilla"
        descripcion="Revise los montos antes de guardar. La planilla queda como borrador hasta marcarla pagada."
        onCerrar={() => setModal(null)}
        ancho="max-w-7xl"
      >
        {modal?.tipo === 'generar' && <NominaGenerar onCancelar={() => setModal(null)} onGuardado={cerrarConMensaje} />}
      </Modal>

      <Modal
        abierto={Boolean(nominaDetalle)}
        titulo="Detalle de la planilla"
        onCerrar={() => setModal(null)}
        ancho="max-w-7xl"
      >
        {nominaDetalle && <DetalleNomina key={nominaDetalle.id} nomina={nominaDetalle} onAccion={cerrarConMensaje} />}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function DetalleNomina({ nomina, onAccion }: { nomina: Nomina; onAccion: (mensaje: string) => void }) {
  const { empleados } = useRecursosHumanos()
  const [fechaPago, setFechaPago] = useState(fechaHoy())
  const [error, setError] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const porId = new Map(empleados.map((e) => [e.id, e]))
  const lineas = [...nomina.lineas].sort((a, b) =>
    (porId.get(a.empleadoId)?.codigo ?? '').localeCompare(porId.get(b.empleadoId)?.codigo ?? '')
  )

  const ejecutar = async (accion: () => Promise<{ ok: true } | { ok: false; error: string }>, mensaje: string) => {
    setProcesando(true)
    const resultado = await accion()
    setProcesando(false)
    if (!resultado.ok) return setError(resultado.error)
    onAccion(mensaje)
  }

  const pagar = () => {
    if (!fechaPago) return setError('Indique la fecha de pago.')
    ejecutar(() => marcarNominaPagada(nomina.id, fechaPago), 'Planilla marcada como pagada')
  }

  const eliminar = () => {
    if (!window.confirm('¿Eliminar esta planilla en borrador? Esta acción no se puede deshacer.')) return
    ejecutar(() => eliminarNomina(nomina.id), 'Planilla eliminada')
  }

  return (
    <div className="space-y-5">
      <ErrorFormulario mensaje={error} />

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <DatoDetalle etiqueta="Período" valor={`${formatoFecha(nomina.periodoInicio)} – ${formatoFecha(nomina.periodoFin)}`} />
        <DatoDetalle etiqueta="Tipo" valor={ETIQUETAS_PERIODICIDAD[nomina.periodicidad]} />
        <DatoDetalle etiqueta="Estado" valor={<InsigniaNomina estado={nomina.estado} />} />
        <DatoDetalle etiqueta="Fecha de pago" valor={nomina.fechaPago ? formatoFecha(nomina.fechaPago) : ''} />
        <DatoDetalle etiqueta="Neto a pagar" valor={<span className="font-semibold">{formatoCordobas(nomina.totalNeto)}</span>} />
        <DatoDetalle etiqueta="Aportes patronales" valor={formatoCordobas(nomina.totalAportesPatronales)} />
      </dl>
      {nomina.observaciones && <p className="text-sm text-stone-500">{nomina.observaciones}</p>}

      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[1100px]">
          <thead className="bg-stone-50">
            <tr>
              <th className={claseCabeceraTabla}>Empleado</th>
              <th className={`${claseCabeceraTabla} text-right`}>Salario</th>
              <th className={`${claseCabeceraTabla} text-right`}>Ausencias</th>
              <th className={`${claseCabeceraTabla} text-right`}>Horas extra</th>
              <th className={`${claseCabeceraTabla} text-right`}>Bonos</th>
              <th className={`${claseCabeceraTabla} text-right`}>Devengado</th>
              <th className={`${claseCabeceraTabla} text-right`}>INSS</th>
              <th className={`${claseCabeceraTabla} text-right`}>IR</th>
              <th className={`${claseCabeceraTabla} text-right`}>Otras</th>
              <th className={`${claseCabeceraTabla} text-right`}>Neto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lineas.map((linea) => {
              const empleado = porId.get(linea.empleadoId)
              return (
                <tr key={linea.empleadoId}>
                  <td className={claseCeldaTabla}>
                    <p className="font-medium text-stone-900">{empleado ? nombreCompleto(empleado) : 'Empleado eliminado'}</p>
                    {empleado && <p className="text-xs text-stone-400">{empleado.codigo} · {empleado.numeroInss || 'Sin N.º INSS'}</p>}
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.salarioBase)}</td>
                  <td className={`${claseCeldaTabla} text-right`}>
                    {linea.diasAusencia > 0 ? <span className="text-red-600">{linea.diasAusencia} d · -{formatoCordobas(linea.descuentoAusencias)}</span> : '—'}
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>
                    {linea.horasExtra > 0 ? `${linea.horasExtra} h · ${formatoCordobas(linea.montoHorasExtra)}` : '—'}
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.bonificaciones)}</td>
                  <td className={`${claseCeldaTabla} text-right font-medium`}>{formatoCordobas(linea.totalDevengado)}</td>
                  <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCordobas(linea.inssLaboral)}</td>
                  <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCordobas(linea.ir)}</td>
                  <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCordobas(linea.otrasDeducciones)}</td>
                  <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCordobas(linea.netoPagar)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-stone-50 border-t border-stone-200">
            <tr>
              <td className={`${claseCeldaTabla} font-semibold`} colSpan={5}>Totales</td>
              <td className={`${claseCeldaTabla} text-right font-semibold`}>{formatoCordobas(nomina.totalDevengado)}</td>
              <td className={`${claseCeldaTabla} text-right font-semibold`} colSpan={3}>Deducciones {formatoCordobas(nomina.totalDeducciones)}</td>
              <td className={`${claseCeldaTabla} text-right font-bold text-stone-900`}>{formatoCordobas(nomina.totalNeto)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {nomina.estado === 'borrador' && (
        <div className="flex flex-col gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:items-end sm:justify-end">
          <button type="button" onClick={eliminar} disabled={procesando} className={claseBotonSecundario}>
            <Trash2 size={16} />
            Eliminar borrador
          </button>
          <div className="sm:w-44">
            <label htmlFor="nomina-fecha-pago" className="block text-xs font-medium text-stone-700 mb-1.5">Fecha de pago</label>
            <input id="nomina-fecha-pago" type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={claseInput} />
          </div>
          <button type="button" onClick={pagar} disabled={procesando} className={claseBotonPrimario}>
            <BadgeCheck size={16} />
            Marcar como pagada
          </button>
        </div>
      )}
    </div>
  )
}
