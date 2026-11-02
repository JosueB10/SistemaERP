'use client'

import { useState } from 'react'
import { AlertTriangle, Gauge, Hourglass, UserCheck, Users } from 'lucide-react'

import { categoriasUnicas, formatoCantidad, formatoNumero, normalizarTexto } from '@/lib/inventario/utilidades'
import { diaManagua } from '@/lib/iiot/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { formatoPorcentaje } from '@/lib/produccion/utilidades'
import {
  analizarPersonal,
  diasHabiles,
  ETIQUETAS_OCUPACION,
  horasPendientes,
  UMBRAL_SUBUTILIZADO,
  type NivelOcupacion
} from '@/lib/recursos-humanos/productividad'
import { useRecursosHumanos } from '@/lib/recursos-humanos/store'
import { nombreCompleto, TASAS_NOMINA } from '@/lib/recursos-humanos/utilidades'
import {
  Campo,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  TarjetaIndicador
} from '../inventario/ui'
import { AvisoConexionRrhh, SECCION_RRHH } from './ui'

const estilosNivel: Record<NivelOcupacion, string> = {
  sin_produccion: 'bg-red-50 text-red-700 ring-red-600/20',
  subutilizado: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  adecuado: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  sobrecargado: 'bg-violet-50 text-violet-700 ring-violet-600/20'
}
const colorBarra: Record<NivelOcupacion, string> = {
  sin_produccion: 'bg-red-500',
  subutilizado: 'bg-amber-500',
  adecuado: 'bg-emerald-600',
  sobrecargado: 'bg-violet-600'
}

export default function ProductividadVista() {
  const { empleados, asistencias } = useRecursosHumanos()
  const { ordenes, centros, rutas } = useProduccion()
  const hoy = diaManagua()
  const [desde, setDesde] = useState(() => `${diaManagua().slice(0, 8)}01`)
  const [hasta, setHasta] = useState(hoy)
  const areas = categoriasUnicas(empleados.filter((e) => e.area).map((e) => ({ categoria: e.area })))
  const [area, setArea] = useState<string | null>(null)
  const areaElegida = area ?? areas.find((a) => normalizarTexto(a).includes('produc')) ?? ''
  const [diasMeta, setDiasMeta] = useState(3)

  const vigentes = empleados.filter((e) => e.estado !== 'inactivo' && (!areaElegida || e.area === areaElegida))
  const filas = analizarPersonal({ empleados: vigentes, asistencias, ordenes, centros, inicio: desde, fin: hasta })
    .sort((a, b) => a.utilizacion - b.utilizacion)

  const disponibles = filas.reduce((t, f) => t + f.horasDisponibles, 0)
  const producidas = filas.reduce((t, f) => t + f.horasProduccion, 0)
  const ocupacion = disponibles ? producidas / disponibles : 0
  const ociosos = filas.filter((f) => f.nivel === 'sin_produccion' || f.nivel === 'subutilizado')
  const sobrecargados = filas.filter((f) => f.nivel === 'sobrecargado')

  // ¿Cuántas personas hacían falta para lo que se produjo? Horas producidas ÷ horas de una persona en el período
  const finEfectivo = hasta > hoy ? hoy : hasta
  const horasPersona = diasHabiles(desde, finEfectivo) * TASAS_NOMINA.horasPorDia
  const necesariasPeriodo = horasPersona ? producidas / horasPersona : 0
  const activos = filas.filter((f) => f.empleado.estado === 'activo').length
  const pendientes = horasPendientes(ordenes, rutas)
  const necesariasCola = Math.ceil(pendientes / (TASAS_NOMINA.horasPorDia * diasMeta))
  const diasConActuales = activos ? pendientes / (activos * TASAS_NOMINA.horasPorDia) : Infinity

  const conclusion = (() => {
    if (!filas.length) return null
    const sobran = activos - Math.ceil(necesariasPeriodo)
    if (producidas === 0) return { tono: 'alerta' as const, texto: `En este período nadie registró operaciones de producción: los ${activos} empleados estuvieron sin producir. Revise si faltan órdenes o si las operaciones no se están asignando.` }
    if (sobran > 0 && ocupacion < UMBRAL_SUBUTILIZADO) return { tono: 'alerta' as const, texto: `Lo que se produjo se podía hacer con unas ${Math.max(1, Math.ceil(necesariasPeriodo))} persona(s) a tiempo completo y hay ${activos}. Sobra personal (${sobran}) o falta trabajo: conviene programar más órdenes o reasignar gente a otras áreas.` }
    if (ocupacion > 1) return { tono: 'peligro' as const, texto: `El personal trabajó más horas de producción (${formatoNumero(producidas, 1)} h) que las disponibles (${formatoNumero(disponibles, 1)} h). Faltan empleados o se están pagando muchas horas extra.` }
    return { tono: 'positivo' as const, texto: `La ocupación del personal es de ${formatoPorcentaje(ocupacion)}: la cantidad de empleados corresponde a la producción del período.` }
  })()

  return (
    <>
      <AvisoConexionRrhh />
      <EncabezadoPagina
        titulo="Productividad del personal"
        descripcion="¿Tengo empleados suficientes o hay gente sin hacer nada? Compara las horas que cada persona estuvo disponible con las que pasó produciendo en las órdenes."
        seccion={SECCION_RRHH}
      />

      <section className={`${claseTarjeta} p-5 mb-6`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo etiqueta="Desde" htmlFor="pr-desde">
            <input id="pr-desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={claseInput} />
          </Campo>
          <Campo etiqueta="Hasta" htmlFor="pr-hasta">
            <input id="pr-hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className={claseInput} />
          </Campo>
          <Campo etiqueta="Área" htmlFor="pr-area">
            <select id="pr-area" value={areaElegida} onChange={(e) => setArea(e.target.value)} className={claseInput}>
              <option value="">Todas las áreas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </Campo>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          <strong>Horas disponibles:</strong> días presentes según la asistencia × {TASAS_NOMINA.horasPorDia} h (si no se pasó asistencia, los días hábiles de lunes a sábado).{' '}
          <strong>Horas produciendo:</strong> duración de las operaciones de órdenes que el empleado terminó (en minutos de planta).{' '}
          Menos del {Math.round(UMBRAL_SUBUTILIZADO * 100)} % = poco ocupado; más del 100 % = sobrecargado.
        </p>
      </section>

      {filas.length === 0 ? (
        <div className={claseTarjeta}>
          <EstadoVacio icono={Users} titulo="No hay empleados en esta área" descripcion="Elija otra área o registre empleados en Recursos Humanos." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            <TarjetaIndicador titulo="Ocupación del personal" valor={formatoPorcentaje(ocupacion)} detalle={`${formatoNumero(producidas, 1)} h produciendo de ${formatoNumero(disponibles, 1)} h disponibles`} icono={Gauge}
              tono={ocupacion > 1 ? 'peligro' : ocupacion < UMBRAL_SUBUTILIZADO ? 'alerta' : 'positivo'} />
            <TarjetaIndicador titulo="Sin producir o poco ocupados" valor={String(ociosos.length)} detalle={`de ${filas.length} empleado(s) analizados`} icono={AlertTriangle} tono={ociosos.length ? 'alerta' : 'neutro'} />
            <TarjetaIndicador titulo="Sobrecargados" valor={String(sobrecargados.length)} detalle="Trabajan más horas que las disponibles" icono={Hourglass} tono={sobrecargados.length ? 'peligro' : 'neutro'} />
            <TarjetaIndicador titulo="Personas necesarias" valor={formatoNumero(necesariasPeriodo, 1)} detalle={`Para lo producido en el período · hay ${activos} activa(s)`} icono={UserCheck} />
          </div>

          {conclusion && (
            <div className={`mb-6 rounded-xl border px-5 py-4 text-sm ${conclusion.tono === 'positivo' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : conclusion.tono === 'peligro' ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <strong>Conclusión:</strong> {conclusion.texto}
            </div>
          )}

          <section className={`${claseTarjeta} p-5 mb-6`}>
            <h2 className="font-semibold text-zinc-900">¿Alcanza el personal para lo que falta producir?</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Las órdenes abiertas suman <strong>{formatoNumero(pendientes, 1)} h</strong> de trabajo estándar.
              {activos > 0 && pendientes > 0 && <> Con los {activos} empleado(s) activo(s) se terminan en unos <strong>{formatoNumero(diasConActuales, 1)} día(s)</strong> de turno.</>}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-700">
              <label htmlFor="pr-meta">Para terminarlas en</label>
              <select id="pr-meta" value={diasMeta} onChange={(e) => setDiasMeta(Number(e.target.value))} className={`${claseInput} w-28`}>
                {[1, 2, 3, 5, 10].map((d) => <option key={d} value={d}>{d} día{d > 1 ? 's' : ''}</option>)}
              </select>
              <span>
                se necesitan <strong>{necesariasCola}</strong> persona(s).{' '}
                {pendientes === 0
                  ? 'No hay trabajo pendiente.'
                  : necesariasCola > activos
                    ? <span className="font-medium text-red-600">Faltan {necesariasCola - activos}: contrate, pague horas extra o amplíe el plazo.</span>
                    : <span className="font-medium text-emerald-700">Alcanza{activos - necesariasCola > 0 ? ` y sobran ${activos - necesariasCola}` : ''}.</span>}
              </span>
            </div>
          </section>

          <section className={claseTarjeta}>
            <h2 className="px-5 pt-5 pb-3 font-semibold text-zinc-900">Detalle por empleado</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Empleado</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Días</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Disponible</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Produciendo</th>
                    <th className={claseCabeceraTabla}>Ocupación</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Operaciones</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Piezas</th>
                    <th className={`${claseCabeceraTabla} text-right`}>En cola</th>
                    <th className={claseCabeceraTabla}>Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filas.map((f) => (
                    <tr key={f.empleado.id}>
                      <td className={claseCeldaTabla}>
                        <p className="font-medium text-zinc-900">{nombreCompleto(f.empleado)}</p>
                        <p className="text-xs text-zinc-400">{f.empleado.cargo}{f.empleado.area ? ` · ${f.empleado.area}` : ''}{f.empleado.tipoPago === 'destajo' ? ' · destajo' : ''}</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        {f.diasTrabajados}
                        <p className="text-[11px] text-zinc-400">{f.segunAsistencia ? 'asistencia' : 'días hábiles'}</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoNumero(f.horasDisponibles, 1)} h</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoNumero(f.horasProduccion, 1)} h</td>
                      <td className={`${claseCeldaTabla} w-44`}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-zinc-100">
                            <div className={`h-full rounded-full ${colorBarra[f.nivel]}`} style={{ width: `${Math.min(100, f.utilizacion * 100)}%` }} />
                          </div>
                          <span className="w-12 text-right text-xs tabular-nums">{Math.round(f.utilizacion * 100)} %</span>
                        </div>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        {f.operaciones}
                        <p className="text-[11px] text-zinc-400">{f.ordenes} orden(es)</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(f.piezas)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{f.enCola || '—'}</td>
                      <td className={claseCeldaTabla}>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${estilosNivel[f.nivel]}`}>{ETIQUETAS_OCUPACION[f.nivel]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
