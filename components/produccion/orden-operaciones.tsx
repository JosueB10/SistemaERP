'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Cpu, Play } from 'lucide-react'

import { cargarCalidad } from '@/lib/calidad/store'
import { cargarInventario } from '@/lib/inventario/store'
import { formatoCantidad, validarNumero } from '@/lib/inventario/utilidades'
import { piezasContadasOperacion } from '@/lib/iiot/store'
import { cargarProduccion, iniciarOperacion, terminarOperacion, useProduccion } from '@/lib/produccion/store'
import type { OperacionOrden, OrdenProduccion } from '@/lib/produccion/tipos'
import {
  aFechaHoraLocal,
  deFechaHoraLocal,
  duracionMin,
  duracionOperacion,
  entradaOperacion,
  formatoFechaHora,
  formatoMinutos,
  indicadores,
  operacionActual,
  tiempoCicloOrden
} from '@/lib/produccion/utilidades'
import { Campo, claseBotonPrimario, claseBotonSecundario, claseBotonTabla, claseCabeceraTabla, claseCeldaTabla, claseInput, ErrorFormulario } from '../inventario/ui'
import { InsigniaOperacion, ValorOee } from './ui'

// Operaciones de la ruta dentro de una orden: se inician y terminan en orden; con los tiempos y las
// piezas registradas se calcula el OEE de cada operación y de la orden.
export default function OrdenOperaciones({ orden, onAccion }: { orden: OrdenProduccion; onAccion: (mensaje: string) => void }) {
  const { centros, responsables, plantas } = useProduccion()
  const [error, setError] = useState<string | null>(null)
  const [abierta, setAbierta] = useState<{ tipo: 'iniciar' | 'terminar'; operacion: OperacionOrden } | null>(null)

  const centroPorId = new Map(centros.map((c) => [c.id, c]))
  // Planta (o plantas) donde se fabrica la orden, según los centros de su ruta
  const plantasOrden = [...new Set(orden.operaciones.map((op) => centroPorId.get(op.centroTrabajoId ?? '')?.plantaId).filter(Boolean))]
    .map((id) => plantas.find((p) => p.id === id)?.nombre)
    .filter(Boolean)
  const actual = operacionActual(orden)
  const total = indicadores(orden.operaciones)
  const ciclo = tiempoCicloOrden(orden)
  const editable = orden.estado === 'en_proceso'

  // Con la planta conectada las operaciones avanzan solas: se refresca mientras la orden está en proceso
  useEffect(() => {
    if (orden.estado !== 'en_proceso') return
    const temporizador = setInterval(() => { cargarProduccion(true).catch(() => undefined) }, 8000)
    return () => clearInterval(temporizador)
  }, [orden.estado])

  // Si la ruta la cerró el IIoT, se traen el lote nuevo y el inventario actualizado
  const estadoAnterior = useRef(orden.estado)
  useEffect(() => {
    if (estadoAnterior.current === 'en_proceso' && orden.estado === 'completada') {
      cargarCalidad(true).catch(() => undefined)
      cargarInventario(true).catch(() => undefined)
    }
    estadoAnterior.current = orden.estado
  }, [orden.estado])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Operaciones de la ruta{plantasOrden.length > 0 && <span className="ml-2 font-normal text-zinc-500">· se fabrica en {plantasOrden.join(' y ')}</span>}</h3>
          <p className="text-xs text-zinc-400">
            {orden.estado === 'pendiente'
              ? 'Se generan al iniciar la orden.'
              : 'Cada paso arranca solo al terminar el anterior. Con la planta IIoT conectada las máquinas los terminan solas; sin ella, pulse «Terminar».'}
          </p>
        </div>
        {total && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>OEE de la orden: <ValorOee valor={total.oee} /></span>
            <span>Disp. {Math.round(total.disponibilidad * 100)} % · Rend. {Math.round(total.rendimiento * 100)} % · Cal. {Math.round(total.calidad * 100)} %</span>
            {ciclo !== null && <span>Tiempo de ciclo: <span className="font-semibold text-zinc-800">{formatoMinutos(ciclo)}</span></span>}
          </div>
        )}
      </div>

      <ErrorFormulario mensaje={error} />

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[820px]">
          <thead className="bg-zinc-50/70">
            <tr>
              <th className={claseCabeceraTabla}>#</th>
              <th className={claseCabeceraTabla}>Operación</th>
              <th className={claseCabeceraTabla}>Estado</th>
              <th className={claseCabeceraTabla}>Inicio / fin</th>
              <th className={`${claseCabeceraTabla} text-right`}>Buenas / rech.</th>
              <th className={`${claseCabeceraTabla} text-right`}>Duración</th>
              <th className={`${claseCabeceraTabla} text-right`}>OEE</th>
              <th className={`${claseCabeceraTabla} text-right`} />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {orden.operaciones.map((op) => {
              const centro = op.centroTrabajoId ? centroPorId.get(op.centroTrabajoId) : undefined
              const ind = indicadores([op])
              const esActual = actual?.id === op.id
              return (
                <tr key={op.id} className={esActual && editable ? 'bg-sky-50/40' : undefined}>
                  <td className={`${claseCeldaTabla} text-zinc-400`}>{op.secuencia}</td>
                  <td className={`${claseCeldaTabla} whitespace-normal`}>
                    <p className="font-medium text-zinc-900">{op.nombre}</p>
                    <p className="text-xs text-zinc-400">{centro ? `${centro.codigo} · ${centro.nombre}` : 'Sin centro'} · {op.tiempoEstandarMin} min/und</p>
                  </td>
                  <td className={claseCeldaTabla}><InsigniaOperacion estado={op.estado} /></td>
                  <td className={`${claseCeldaTabla} text-xs`}>
                    <p>{formatoFechaHora(op.inicio)}</p>
                    <p className="text-zinc-400">{formatoFechaHora(op.fin)}</p>
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>
                    {op.estado === 'completada' ? <>{formatoCantidad(op.cantidadBuena)} / <span className={op.cantidadRechazada ? 'text-red-600' : 'text-zinc-400'}>{formatoCantidad(op.cantidadRechazada)}</span></> : '—'}
                  </td>
                  <td className={`${claseCeldaTabla} text-right text-xs`}>
                    {op.estado === 'completada' ? (
                      <>
                        {formatoMinutos(duracionOperacion(op))}
                        {op.tiempoParoMin > 0 && <p className="text-amber-700" title={op.motivoParo}>paro {formatoMinutos(op.tiempoParoMin)}</p>}
                        {op.registradoPor === 'iiot' && (
                          <p className="inline-flex items-center gap-1 text-sky-700" title={op.escalaTiempo > 1 ? `Simulación acelerada: minutos de planta = minutos reales × ${op.escalaTiempo}` : 'Registrado por la máquina'}>
                            <Cpu size={11} />IIoT{op.escalaTiempo > 1 ? ` ×${op.escalaTiempo}` : ''}
                          </p>
                        )}
                      </>
                    ) : op.estado === 'en_proceso' ? (
                      <span className="text-zinc-400">esperado {formatoMinutos(op.tiempoPreparacionMin + op.tiempoEstandarMin * entradaOperacion(orden, op))}</span>
                    ) : '—'}
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>{ind ? <ValorOee valor={ind.oee} /> : <span className="text-zinc-400">—</span>}</td>
                  <td className={`${claseCeldaTabla} text-right`}>
                    {editable && esActual && op.estado === 'pendiente' && (
                      <button type="button" onClick={() => { setError(null); setAbierta({ tipo: 'iniciar', operacion: op }) }} className={claseBotonTabla}><Play size={14} />Iniciar</button>
                    )}
                    {editable && op.estado === 'en_proceso' && (
                      <button type="button" onClick={() => { setError(null); setAbierta({ tipo: 'terminar', operacion: op }) }} className={claseBotonTabla}><CheckCircle2 size={14} />Terminar</button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {abierta?.tipo === 'iniciar' && (
        <IniciarOperacion
          key={abierta.operacion.id}
          operacion={abierta.operacion}
          responsables={responsables.filter((r) => r.activo)}
          empleadoSugerido={orden.empleadoId}
          onCancelar={() => setAbierta(null)}
          onError={setError}
          onHecho={(texto) => { setAbierta(null); onAccion(texto) }}
        />
      )}
      {abierta?.tipo === 'terminar' && (
        <TerminarOperacion
          key={abierta.operacion.id}
          operacion={abierta.operacion}
          entrada={entradaOperacion(orden, abierta.operacion)}
          responsables={responsables.filter((r) => r.activo)}
          onCancelar={() => setAbierta(null)}
          onHecho={(texto) => { setAbierta(null); onAccion(texto) }}
        />
      )}
    </div>
  )
}

function IniciarOperacion({
  operacion,
  responsables,
  empleadoSugerido,
  onCancelar,
  onError,
  onHecho
}: {
  operacion: OperacionOrden
  responsables: { id: string; nombre: string }[]
  empleadoSugerido?: string
  onCancelar: () => void
  onError: (mensaje: string) => void
  onHecho: (mensaje: string) => void
}) {
  const [inicio, setInicio] = useState(aFechaHoraLocal())
  const [empleadoId, setEmpleadoId] = useState(empleadoSugerido ?? '')
  const [ocupado, setOcupado] = useState(false)

  const confirmar = async () => {
    if (!inicio) return
    if (new Date(inicio).getTime() > Date.now() + 5 * 60000) { onError('El inicio no puede estar en el futuro.'); return }
    setOcupado(true)
    const resultado = await iniciarOperacion(operacion.id, deFechaHoraLocal(inicio), empleadoId || undefined)
    setOcupado(false)
    if (!resultado.ok) { onError(resultado.error); return }
    onHecho(`Operación «${operacion.nombre}» iniciada`)
  }

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-4 space-y-3">
      <p className="text-sm font-medium text-sky-900">Iniciar: {operacion.nombre}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo etiqueta="Inicio" htmlFor="op-inicio">
          <input id="op-inicio" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Operario" htmlFor="op-operario">
          <select id="op-operario" value={empleadoId} onChange={(e) => setEmpleadoId(e.target.value)} className={claseInput}>
            <option value="">Sin asignar</option>
            {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Campo>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className={claseBotonSecundario}>Volver</button>
        <button type="button" onClick={confirmar} disabled={ocupado} className={claseBotonPrimario}><Play size={15} />{ocupado ? 'Iniciando...' : 'Iniciar operación'}</button>
      </div>
    </div>
  )
}

function TerminarOperacion({
  operacion,
  entrada,
  responsables,
  onCancelar,
  onHecho
}: {
  operacion: OperacionOrden
  entrada: number
  responsables: { id: string; nombre: string }[]
  onCancelar: () => void
  onHecho: (mensaje: string) => void
}) {
  const [valores, setValores] = useState({
    inicio: aFechaHoraLocal(operacion.inicio),
    fin: aFechaHoraLocal(),
    buenas: String(entrada),
    rechazadas: '0',
    paro: '0',
    motivoParo: '',
    empleadoId: operacion.empleadoId ?? '',
    observaciones: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [piezasIiot, setPiezasIiot] = useState<number | null>(null)

  // Piezas que contó el sensor IIoT del centro mientras la operación estaba en proceso
  useEffect(() => {
    let vigente = true
    piezasContadasOperacion(operacion.id).then((n) => { if (vigente) setPiezasIiot(n) }).catch(() => undefined)
    return () => { vigente = false }
  }, [operacion.id])

  const cambiar = (campo: keyof typeof valores, valor: string) => { setValores((a) => ({ ...a, [campo]: valor })); setError(null) }

  const confirmar = async () => {
    const buenas = validarNumero(valores.buenas, { etiqueta: 'Las piezas buenas', entero: true })
    const rechazadas = validarNumero(valores.rechazadas || '0', { etiqueta: 'Las piezas rechazadas', entero: true })
    const paro = validarNumero(valores.paro || '0', { etiqueta: 'El tiempo de paro', decimales: 2 })
    const primerError = buenas.error ?? rechazadas.error ?? paro.error
    if (primerError) { setError(primerError); return }
    if (buenas.valor! + rechazadas.valor! === 0) { setError('Registre las piezas procesadas.'); return }
    if (buenas.valor! + rechazadas.valor! > entrada) { setError(`A esta operación solo llegaron ${entrada} pieza(s).`); return }
    if (!valores.inicio || !valores.fin || new Date(valores.fin) <= new Date(valores.inicio)) { setError('El fin debe ser posterior al inicio.'); return }
    if (paro.valor! >= duracionMin(deFechaHoraLocal(valores.inicio), deFechaHoraLocal(valores.fin))) { setError('El paro debe ser menor que la duración de la operación.'); return }

    setOcupado(true)
    const resultado = await terminarOperacion(operacion.id, {
      inicio: deFechaHoraLocal(valores.inicio),
      fin: deFechaHoraLocal(valores.fin),
      cantidadBuena: buenas.valor!,
      cantidadRechazada: rechazadas.valor!,
      tiempoParoMin: paro.valor!,
      motivoParo: valores.motivoParo,
      empleadoId: valores.empleadoId || undefined,
      observaciones: valores.observaciones
    })
    setOcupado(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onHecho(rechazadas.valor! > 0
      ? `Operación terminada. Se abrió una no conformidad por ${rechazadas.valor} pieza(s) rechazada(s)`
      : `Operación «${operacion.nombre}» terminada`)
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-emerald-900">Terminar: {operacion.nombre}</p>
        <p className="text-xs text-zinc-500">Llegaron {formatoCantidad(entrada)} pieza(s) a esta operación</p>
      </div>
      {piezasIiot !== null && piezasIiot > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-zinc-600">
          <Cpu size={13} className="text-zinc-400" />
          El sensor IIoT del centro contó <span className="font-semibold">{formatoCantidad(piezasIiot)}</span> pieza(s) durante esta operación.
          <button type="button" onClick={() => cambiar('buenas', String(Math.min(piezasIiot, entrada)))} className="underline">Usar</button>
        </p>
      )}
      <ErrorFormulario mensaje={error} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Campo etiqueta="Inicio" htmlFor="op-t-inicio" className="sm:col-span-2">
          <input id="op-t-inicio" type="datetime-local" value={valores.inicio} onChange={(e) => cambiar('inicio', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Fin" htmlFor="op-t-fin" className="sm:col-span-2">
          <input id="op-t-fin" type="datetime-local" value={valores.fin} onChange={(e) => cambiar('fin', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Piezas buenas" htmlFor="op-t-buenas">
          <input id="op-t-buenas" type="number" min="0" step="1" value={valores.buenas} onChange={(e) => cambiar('buenas', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Rechazadas" htmlFor="op-t-rechazadas" ayuda="Abren una NC">
          <input id="op-t-rechazadas" type="number" min="0" step="1" value={valores.rechazadas} onChange={(e) => cambiar('rechazadas', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Paros (min)" htmlFor="op-t-paro">
          <input id="op-t-paro" type="number" min="0" step="1" value={valores.paro} onChange={(e) => cambiar('paro', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Motivo del paro" htmlFor="op-t-motivo">
          <input id="op-t-motivo" value={valores.motivoParo} onChange={(e) => cambiar('motivoParo', e.target.value)} placeholder="Falla, ajuste..." className={claseInput} />
        </Campo>
        <Campo etiqueta="Operario" htmlFor="op-t-operario" className="sm:col-span-2">
          <select id="op-t-operario" value={valores.empleadoId} onChange={(e) => cambiar('empleadoId', e.target.value)} className={claseInput}>
            <option value="">Sin asignar</option>
            {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Observaciones" htmlFor="op-t-obs" className="sm:col-span-2">
          <input id="op-t-obs" value={valores.observaciones} onChange={(e) => cambiar('observaciones', e.target.value)} placeholder="Defecto de las rechazadas, incidencias..." className={claseInput} />
        </Campo>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancelar} className={claseBotonSecundario}>Volver</button>
        <button type="button" onClick={confirmar} disabled={ocupado} className={claseBotonPrimario}><CheckCircle2 size={15} />{ocupado ? 'Guardando...' : 'Terminar operación'}</button>
      </div>
    </div>
  )
}
