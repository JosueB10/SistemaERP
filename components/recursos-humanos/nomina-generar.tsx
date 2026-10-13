'use client'

import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'

import { fechaHoy, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { guardarNomina, useRecursosHumanos } from '@/lib/recursos-humanos/store'
import type { Periodicidad } from '@/lib/recursos-humanos/tipos'
import {
  calcularLinea,
  empleadosParaNomina,
  ETIQUETAS_PERIODICIDAD,
  nombreCompleto,
  periodoSugerido,
  TASAS_NOMINA,
  totalesNomina,
  variablesAsistencia
} from '@/lib/recursos-humanos/utilidades'
import { Campo, claseCabeceraTabla, claseCeldaTabla, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

type Variables = { diasAusencia: string; horasExtra: string; bonificaciones: string; otrasDeducciones: string }

const aNumero = (valor: string) => {
  const numero = Number(valor)
  return Number.isFinite(numero) && numero > 0 ? numero : 0
}

export default function NominaGenerar({
  onCancelar,
  onGuardado
}: {
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { empleados, asistencias } = useRecursosHumanos()
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>('quincenal')
  const [periodo, setPeriodo] = useState(() => periodoSugerido(fechaHoy(), 'quincenal'))
  const [observaciones, setObservaciones] = useState('')
  // Solo se guardan los valores que el usuario cambia; el resto sale de la asistencia
  const [ajustes, setAjustes] = useState<Record<string, Partial<Variables>>>({})
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const incluidos = useMemo(() => empleadosParaNomina(empleados, periodo.fin), [empleados, periodo.fin])

  const filas = useMemo(
    () =>
      incluidos.map((empleado) => {
        const asistencia = variablesAsistencia(asistencias, empleado.id, periodo.inicio, periodo.fin)
        const variables: Variables = {
          diasAusencia: String(asistencia.diasAusencia),
          horasExtra: String(asistencia.horasExtra),
          bonificaciones: '0',
          otrasDeducciones: '0',
          ...ajustes[empleado.id]
        }
        const linea = calcularLinea(empleado, periodicidad, {
          diasAusencia: aNumero(variables.diasAusencia),
          horasExtra: aNumero(variables.horasExtra),
          bonificaciones: aNumero(variables.bonificaciones),
          otrasDeducciones: aNumero(variables.otrasDeducciones)
        })
        return { empleado, variables, linea }
      }),
    [incluidos, asistencias, periodo, periodicidad, ajustes]
  )
  const totales = totalesNomina(filas.map((f) => f.linea))

  const cambiarPeriodicidad = (valor: Periodicidad) => {
    setPeriodicidad(valor)
    setPeriodo(periodoSugerido(periodo.inicio, valor))
  }

  const ajustar = (empleadoId: string, campo: keyof Variables, valor: string) => {
    setAjustes((actual) => ({ ...actual, [empleadoId]: { ...actual[empleadoId], [campo]: valor } }))
    setError(null)
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!periodo.inicio || !periodo.fin) return setError('Indique las fechas del período.')
    if (periodo.fin < periodo.inicio) return setError('La fecha final no puede ser anterior a la inicial.')
    const negativo = filas.find((f) => f.linea.netoPagar < 0)
    if (negativo) return setError(`El neto a pagar de ${nombreCompleto(negativo.empleado)} es negativo; revise sus deducciones.`)

    setEnviando(true)
    const resultado = await guardarNomina({
      periodicidad,
      periodoInicio: periodo.inicio,
      periodoFin: periodo.fin,
      observaciones,
      lineas: filas.map((f) => f.linea)
    })
    setEnviando(false)
    if (!resultado.ok) return setError(resultado.error)
    onGuardado(`Planilla del ${formatoFecha(periodo.inicio)} al ${formatoFecha(periodo.fin)} generada`)
  }

  const entrada = (empleadoId: string, campo: keyof Variables, valor: string, etiqueta: string) => (
    <input
      type="number"
      min="0"
      step={campo === 'diasAusencia' || campo === 'horasExtra' ? '0.5' : '0.01'}
      inputMode="decimal"
      value={valor}
      onChange={(e) => ajustar(empleadoId, campo, e.target.value)}
      className={`${claseInput} h-8 w-24 text-right`}
      aria-label={etiqueta}
    />
  )

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo etiqueta="Periodicidad" htmlFor="nomina-periodicidad" requerido>
          <select id="nomina-periodicidad" value={periodicidad} onChange={(e) => cambiarPeriodicidad(e.target.value as Periodicidad)} className={claseInput}>
            {(Object.keys(ETIQUETAS_PERIODICIDAD) as Periodicidad[]).map((p) => <option key={p} value={p}>{ETIQUETAS_PERIODICIDAD[p]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Desde" htmlFor="nomina-inicio" requerido>
          <input id="nomina-inicio" type="date" value={periodo.inicio} onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))} className={claseInput} />
        </Campo>
        <Campo etiqueta="Hasta" htmlFor="nomina-fin" requerido>
          <input id="nomina-fin" type="date" value={periodo.fin} onChange={(e) => setPeriodo((p) => ({ ...p, fin: e.target.value }))} className={claseInput} />
        </Campo>
      </div>

      <div className="flex gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600">
        <Info size={15} className="shrink-0 mt-0.5 text-stone-400" />
        <p>
          Ausencias y horas extra se toman de la asistencia del período y puede corregirlas aquí.
          INSS laboral {TASAS_NOMINA.inssLaboral * 100} %, IR según tabla progresiva anual,
          INSS patronal {TASAS_NOMINA.inssPatronal * 100} % e INATEC {TASAS_NOMINA.inatec * 100} %.
          Verifique las tasas vigentes con su contador.
        </p>
      </div>

      {filas.length === 0 ? (
        <p className="text-sm text-stone-500 text-center py-8">No hay empleados vigentes para este período.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-stone-50">
              <tr>
                <th className={claseCabeceraTabla}>Empleado</th>
                <th className={`${claseCabeceraTabla} text-right`}>Salario</th>
                <th className={`${claseCabeceraTabla} text-right`}>Días ausente</th>
                <th className={`${claseCabeceraTabla} text-right`}>Horas extra</th>
                <th className={`${claseCabeceraTabla} text-right`}>Bonos</th>
                <th className={`${claseCabeceraTabla} text-right`}>Devengado</th>
                <th className={`${claseCabeceraTabla} text-right`}>INSS</th>
                <th className={`${claseCabeceraTabla} text-right`}>IR</th>
                <th className={`${claseCabeceraTabla} text-right`}>Otras deduc.</th>
                <th className={`${claseCabeceraTabla} text-right`}>Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.map(({ empleado, variables, linea }) => {
                const nombre = nombreCompleto(empleado)
                return (
                  <tr key={empleado.id}>
                    <td className={claseCeldaTabla}>
                      <p className="font-medium text-stone-900">{nombre}</p>
                      <p className="text-xs text-stone-400">{empleado.cargo}</p>
                    </td>
                    <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.salarioBase)}</td>
                    <td className="px-4 py-2 text-right">
                      {entrada(empleado.id, 'diasAusencia', variables.diasAusencia, `Días de ausencia de ${nombre}`)}
                      {linea.descuentoAusencias > 0 && <p className="text-[11px] text-red-600 mt-0.5">-{formatoCordobas(linea.descuentoAusencias)}</p>}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {entrada(empleado.id, 'horasExtra', variables.horasExtra, `Horas extra de ${nombre}`)}
                      {linea.montoHorasExtra > 0 && <p className="text-[11px] text-emerald-700 mt-0.5">+{formatoCordobas(linea.montoHorasExtra)}</p>}
                    </td>
                    <td className="px-4 py-2 text-right">{entrada(empleado.id, 'bonificaciones', variables.bonificaciones, `Bonificaciones de ${nombre}`)}</td>
                    <td className={`${claseCeldaTabla} text-right font-medium`}>{formatoCordobas(linea.totalDevengado)}</td>
                    <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCordobas(linea.inssLaboral)}</td>
                    <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCordobas(linea.ir)}</td>
                    <td className="px-4 py-2 text-right">{entrada(empleado.id, 'otrasDeducciones', variables.otrasDeducciones, `Otras deducciones de ${nombre}`)}</td>
                    <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>{formatoCordobas(linea.netoPagar)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-stone-50 border-t border-stone-200">
              <tr>
                <td className={`${claseCeldaTabla} font-semibold`} colSpan={5}>Totales ({filas.length} empleados)</td>
                <td className={`${claseCeldaTabla} text-right font-semibold`}>{formatoCordobas(totales.devengado)}</td>
                <td className={`${claseCeldaTabla} text-right font-semibold`} colSpan={3}>Deducciones {formatoCordobas(totales.deducciones)}</td>
                <td className={`${claseCeldaTabla} text-right font-bold text-stone-900`}>{formatoCordobas(totales.neto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
        <Campo etiqueta="Observaciones" htmlFor="nomina-observaciones" className="sm:col-span-2">
          <input id="nomina-observaciones" value={observaciones} maxLength={250} onChange={(e) => setObservaciones(e.target.value)} className={claseInput} placeholder="Opcional" />
        </Campo>
        <div className="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs text-stone-600">
          Aportes patronales (INSS + INATEC)
          <p className="text-sm font-semibold text-stone-900">{formatoCordobas(totales.aportesPatronales)}</p>
        </div>
      </div>

      <PieFormulario onCancelar={onCancelar} textoGuardar="Generar planilla" enviando={enviando} />
    </form>
  )
}
