'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Database, Lightbulb, PauseCircle, Thermometer, Trash2 } from 'lucide-react'

import { formatoCantidad, formatoFecha } from '@/lib/inventario/utilidades'
import { borrarHistoricoIiot, generarHistoricoIiot, lecturasDelDia, useResumenIiot, type LecturaIiot } from '@/lib/iiot/store'
import { diaManagua, etiquetaDia, formatoKwh, formatoSegundos, sumarDias } from '@/lib/iiot/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import {
  Campo,
  claseBotonPrimario,
  claseBotonSecundario,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  ErrorFormulario,
  EstadoVacio,
  Notificacion,
  TarjetaIndicador,
  useNotificacion
} from '../inventario/ui'
import { AvisoConexionProduccion } from '../produccion/ui'
import GraficoRangoDiario from './grafico-rango-diario'
import GraficoTemperatura from './grafico-temperatura'

const SECCION = { etiqueta: 'Monitoreo IIoT', href: '/produccion/iiot' }

export default function AnalisisVista() {
  const { centros } = useProduccion()
  const { mensaje, mostrar } = useNotificacion()
  const hoy = diaManagua()
  const [desde, setDesde] = useState(() => sumarDias(diaManagua(), -30))
  const [hasta, setHasta] = useState(hoy)
  const { filas, error, cargando, recargar } = useResumenIiot(desde, hasta)
  const [dispositivo, setDispositivo] = useState('')
  const [diaElegido, setDiaElegido] = useState<string | null>(null)
  const [lecturasDia, setLecturasDia] = useState<LecturaIiot[] | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const centroPorId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros])
  const nombreDe = (d: string, centroId?: string) => centroPorId.get(centroId ?? '')?.nombre ?? d

  const conTemperatura = useMemo(() => {
    const vistos = new Map<string, string | undefined>()
    for (const f of filas) if (f.tempProm !== undefined) vistos.set(f.dispositivo, f.centroTrabajoId)
    return [...vistos.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filas])
  const elegido = conTemperatura.find(([d]) => d === dispositivo) ?? conTemperatura.find(([d]) => d === 'PRENSA-01') ?? conTemperatura[0]
  const centro = elegido ? centroPorId.get(elegido[1] ?? '') : undefined
  const delDispositivo = filas.filter((f) => f.dispositivo === elegido?.[0] && f.tempProm !== undefined)

  // Curva completa del día elegido
  useEffect(() => {
    if (!diaElegido || !elegido) return
    let vigente = true
    lecturasDelDia(elegido[0], diaElegido).then((l) => { if (vigente) setLecturasDia(l) })
    return () => { vigente = false }
  }, [diaElegido, elegido])

  const lecturasTotales = delDispositivo.reduce((t, f) => t + f.operando, 0)
  const alarmas = delDispositivo.reduce((t, f) => t + f.alarmas, 0)
  const paros = delDispositivo.reduce((t, f) => t + f.paros, 0)
  const promedio = lecturasTotales ? delDispositivo.reduce((t, f) => t + (f.tempProm ?? 0) * f.operando, 0) / lecturasTotales : 0
  const diasConAlarma = delDispositivo.filter((f) => f.alarmas > 0)
  const peor = [...delDispositivo].sort((a, b) => b.alarmas - a.alarmas)[0]

  // Comparativo de todas las máquinas en el período
  const comparativo = useMemo(() => {
    const mapa = new Map<string, { dispositivo: string; centroId?: string; lecturas: number; operando: number; sumaTemp: number; alarmas: number; paros: number; piezas: number; kwh: number; sumaEspera: number; esperaMax: number }>()
    for (const f of filas) {
      const a = mapa.get(f.dispositivo) ?? { dispositivo: f.dispositivo, centroId: f.centroTrabajoId, lecturas: 0, operando: 0, sumaTemp: 0, alarmas: 0, paros: 0, piezas: 0, kwh: 0, sumaEspera: 0, esperaMax: 0 }
      a.lecturas += f.lecturas
      a.operando += f.operando
      a.sumaTemp += (f.tempProm ?? 0) * (f.tempProm !== undefined ? f.operando : 0)
      a.alarmas += f.alarmas
      a.paros += f.paros
      a.piezas += f.piezas
      a.kwh += f.energiaKwh
      a.sumaEspera += f.esperaPromS * f.lecturas
      a.esperaMax = Math.max(a.esperaMax, f.esperaMaxS)
      mapa.set(f.dispositivo, a)
    }
    return [...mapa.values()].sort((a, b) => a.dispositivo.localeCompare(b.dispositivo))
  }, [filas])

  const cargarEjemplo = async () => {
    setErrorAccion(null)
    setTrabajando(true)
    const r = await generarHistoricoIiot(30)
    setTrabajando(false)
    if (!r.ok) { setErrorAccion(r.error); return }
    setDesde(sumarDias(hoy, -30))
    setHasta(hoy)
    recargar()
    mostrar(`Se cargaron ${formatoCantidad(r.lecturas ?? 0)} lecturas de ejemplo de los últimos 30 días`)
  }

  const borrarEjemplo = async () => {
    if (!window.confirm('¿Borrar las lecturas de ejemplo? Las lecturas reales de la planta no se tocan.')) return
    setErrorAccion(null)
    setTrabajando(true)
    const r = await borrarHistoricoIiot()
    setTrabajando(false)
    if (!r.ok) { setErrorAccion(r.error); return }
    setDiaElegido(null)
    recargar()
    mostrar(`Se borraron ${formatoCantidad(r.lecturas ?? 0)} lecturas de ejemplo`)
  }

  return (
    <>
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Análisis de sensores por fecha"
        descripcion="¿A qué temperatura trabajó cada máquina cada día, cuántas alarmas y paros tuvo? Resumen de todas las lecturas guardadas."
        seccion={SECCION}
      />

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <ErrorFormulario mensaje={errorAccion} />

      <section className={`${claseTarjeta} p-5 mb-6`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <Campo etiqueta="Desde" htmlFor="an-desde">
            <input id="an-desde" type="date" value={desde} max={hasta} onChange={(e) => { setDesde(e.target.value); setDiaElegido(null) }} className={claseInput} />
          </Campo>
          <Campo etiqueta="Hasta" htmlFor="an-hasta">
            <input id="an-hasta" type="date" value={hasta} min={desde} max={hoy} onChange={(e) => { setHasta(e.target.value); setDiaElegido(null) }} className={claseInput} />
          </Campo>
          <Campo etiqueta="Máquina" htmlFor="an-maquina">
            <select id="an-maquina" value={elegido?.[0] ?? ''} onChange={(e) => { setDispositivo(e.target.value); setDiaElegido(null) }} className={claseInput} disabled={!conTemperatura.length}>
              {conTemperatura.map(([d, c]) => <option key={d} value={d}>{nombreDe(d, c)} ({d})</option>)}
            </select>
          </Campo>
          <div className="flex gap-2">
            <button type="button" onClick={cargarEjemplo} disabled={trabajando} className={claseBotonPrimario}><Database size={16} />Datos de ejemplo</button>
            <button type="button" onClick={borrarEjemplo} disabled={trabajando} className={claseBotonSecundario} aria-label="Borrar datos de ejemplo"><Trash2 size={16} /></button>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          <strong>Datos de ejemplo:</strong> crea 30 días de lecturas simuladas (turno de 7:00 a 15:00, una lectura cada 10 minutos por máquina)
          para practicar el análisis sin tener la planta encendida. Hace entre 8 y 10 días la prensa térmica trabajó demasiado caliente,
          así que esas fechas salen con alarmas. Borrarlos no toca las lecturas reales.
        </p>
      </section>

      {!cargando && filas.length === 0 ? (
        <div className={claseTarjeta}>
          <EstadoVacio icono={CalendarDays} titulo="No hay lecturas en estas fechas" descripcion="Conecte la planta (npm run dev:planta) o pulse «Datos de ejemplo» para cargar un histórico." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            <TarjetaIndicador titulo="Temperatura promedio" valor={lecturasTotales ? `${Math.round(promedio * 10) / 10} °C` : '—'}
              detalle={centro?.temperaturaMin !== undefined ? `Rango correcto: ${centro.temperaturaMin}–${centro.temperaturaMax} °C` : 'Mientras producía'} icono={Thermometer} />
            <TarjetaIndicador titulo="Días con alarmas" valor={`${diasConAlarma.length} de ${delDispositivo.length}`} detalle={`${alarmas} alarma(s) en el período`} icono={AlertTriangle} tono={diasConAlarma.length ? 'peligro' : 'positivo'} />
            <TarjetaIndicador titulo="Paros registrados" valor={String(paros)} detalle="Lecturas con la máquina detenida" icono={PauseCircle} tono={paros ? 'alerta' : 'neutro'} />
            <TarjetaIndicador titulo="Lecturas analizadas" valor={formatoCantidad(delDispositivo.reduce((t, f) => t + f.lecturas, 0))} detalle={`${delDispositivo.length} día(s) con datos`} icono={CalendarDays} />
          </div>

          {peor && peor.alarmas > 0 && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
              <Lightbulb size={18} className="mt-0.5 shrink-0" />
              <p>
                <strong>Conclusión:</strong> {nombreDe(peor.dispositivo, peor.centroTrabajoId)} tuvo más alarmas el {formatoFecha(peor.dia)} ({peor.alarmas}).
                Ese día trabajó en promedio a {peor.tempProm} °C (mínima {peor.tempMin} °C, máxima {peor.tempMax} °C)
                {centro?.temperaturaMax !== undefined && peor.tempProm !== undefined && peor.tempProm > centro.temperaturaMax - 5 ? ', muy cerca del límite superior: conviene revisar el resistor o el termostato.' : '.'}
                {diasConAlarma.length > 1 && ` En total hubo alarmas en ${diasConAlarma.length} días: ${diasConAlarma.slice(0, 6).map((f) => etiquetaDia(f.dia)).join(', ')}${diasConAlarma.length > 6 ? '…' : ''}.`}
              </p>
            </div>
          )}

          <section className={`${claseTarjeta} p-5 mb-6`}>
            <h2 className="font-semibold text-zinc-900">Temperatura de cada día · {elegido ? nombreDe(elegido[0], elegido[1]) : ''}</h2>
            <p className="mb-3 text-xs text-zinc-500">
              El punto es el promedio del día y la barra va de la mínima a la máxima (solo mientras producía). La franja verde es el rango correcto.
              Los días en rojo tuvieron alarmas. Haga clic en un día para ver su curva completa.
            </p>
            <GraficoRangoDiario
              puntos={delDispositivo.map((f) => ({ dia: f.dia, promedio: f.tempProm!, minimo: f.tempMin ?? f.tempProm!, maximo: f.tempMax ?? f.tempProm!, alarmas: f.alarmas }))}
              minimo={centro?.temperaturaMin}
              maximo={centro?.temperaturaMax}
              seleccionado={diaElegido ?? undefined}
              onSeleccionar={(d) => { setLecturasDia(null); setDiaElegido(d) }}
            />
            {diaElegido && (
              <div className="mt-5 border-t border-zinc-100 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-900">{formatoFecha(diaElegido)} · lectura por lectura</h3>
                  <button type="button" onClick={() => setDiaElegido(null)} className="text-xs text-zinc-500 underline">Cerrar</button>
                </div>
                {lecturasDia === null
                  ? <p className="py-8 text-center text-sm text-zinc-400">Cargando…</p>
                  : <GraficoTemperatura lecturas={lecturasDia} minimo={centro?.temperaturaMin} maximo={centro?.temperaturaMax} />}
              </div>
            )}
          </section>

          <section className={`${claseTarjeta} mb-6`}>
            <h2 className="px-5 pt-5 pb-3 font-semibold text-zinc-900">Detalle por día</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Fecha</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Promedio</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Mínima</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Máxima</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Alarmas</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Paros</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Piezas</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Energía</th>
                    <th className={claseCabeceraTabla}>Cómo estuvo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {[...delDispositivo].reverse().map((f) => (
                    <tr key={f.dia} onClick={() => { setLecturasDia(null); setDiaElegido(f.dia) }} className={`cursor-pointer hover:bg-zinc-50/60 ${f.dia === diaElegido ? 'bg-zinc-50' : ''}`}>
                      <td className={claseCeldaTabla}>{formatoFecha(f.dia)}</td>
                      <td className={`${claseCeldaTabla} text-right font-medium`}>{f.tempProm} °C</td>
                      <td className={`${claseCeldaTabla} text-right`}>{f.tempMin} °C</td>
                      <td className={`${claseCeldaTabla} text-right`}>{f.tempMax} °C</td>
                      <td className={`${claseCeldaTabla} text-right ${f.alarmas ? 'font-semibold text-red-600' : ''}`}>{f.alarmas}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{f.paros}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(f.piezas)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoKwh(f.energiaKwh)}</td>
                      <td className={claseCeldaTabla}>
                        {f.alarmas === 0
                          ? <span className="text-emerald-700">Normal</span>
                          : f.alarmas >= 3 ? <span className="font-medium text-red-600">Muchas alarmas</span> : <span className="text-amber-700">Alguna alarma</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={claseTarjeta}>
            <h2 className="px-5 pt-5 font-semibold text-zinc-900">Comparativo de máquinas</h2>
            <p className="px-5 pb-3 text-xs text-zinc-500">Todo el período, todas las máquinas y medidores. «Espera en cola» es el tiempo que tardaron las lecturas en llegar por cortes de red.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Máquina</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Lecturas</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Temp. promedio</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Alarmas</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Paros</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Piezas</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Energía</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Espera en cola (prom. / máx.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {comparativo.map((c) => (
                    <tr key={c.dispositivo}>
                      <td className={claseCeldaTabla}>
                        <p className="font-medium text-zinc-900">{c.centroId ? nombreDe(c.dispositivo, c.centroId) : 'Iluminación'}</p>
                        <p className="font-mono text-xs text-zinc-400">{c.dispositivo}</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(c.lecturas)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{c.sumaTemp ? `${Math.round((c.sumaTemp / c.operando) * 10) / 10} °C` : '—'}</td>
                      <td className={`${claseCeldaTabla} text-right ${c.alarmas ? 'text-red-600 font-medium' : ''}`}>{c.alarmas}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{c.paros}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(c.piezas)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoKwh(c.kwh)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoSegundos(c.lecturas ? c.sumaEspera / c.lecturas : 0)} / {formatoSegundos(c.esperaMax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Notificacion mensaje={mensaje} />
    </>
  )
}
