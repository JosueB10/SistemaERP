'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, ArrowRight, BarChart3, Clock, Cpu, Leaf, Lightbulb, Plug, Radio, WifiOff, Zap } from 'lucide-react'

import { formatoCantidad } from '@/lib/inventario/utilidades'
import { piezasPorOperacion, useLecturasIiot, useResumenIiot, type LecturaIiot } from '@/lib/iiot/store'
import {
  diaManagua,
  dispositivoLuces,
  formatoKg,
  formatoKw,
  formatoKwh,
  formatoSegundos,
  SIN_SENAL_MS,
  type EstadoDispositivo
} from '@/lib/iiot/utilidades'
import { cargarProduccion, useProduccion } from '@/lib/produccion/store'
import type { CentroTrabajo, OperacionOrden, OrdenProduccion } from '@/lib/produccion/tipos'
import { codigoOrden, entradaOperacion, formatoMinutos } from '@/lib/produccion/utilidades'
import {
  claseBotonSecundario,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  TarjetaIndicador
} from '../inventario/ui'
import { AvisoConexionProduccion, SECCION_PRODUCCION } from '../produccion/ui'
import GraficoTemperatura from './grafico-temperatura'
import { ComoFunciona, InsigniaLectura, MedidorRango } from './ui'

type Dispositivo = {
  nombre: string
  ultima: LecturaIiot
  // De la más nueva a la más vieja
  historial: LecturaIiot[]
  piezasHora: number
  alarmasHora: number
}

type Evento = { id: string; momento: string; tono: 'peligro' | 'alerta' | 'info'; texto: string }

const hace = (ms: number) => formatoSegundos(ms / 1000)

export default function MonitoreoVista() {
  const { lecturas, error, actualizado } = useLecturasIiot(5000)
  const { centros, ordenes, plantas, responsables } = useProduccion()
  const hoy = diaManagua()
  const { filas: resumenHoy } = useResumenIiot(hoy, hoy, 30_000)
  const [seleccion, setSeleccion] = useState('')
  const [contadas, setContadas] = useState<Map<string, number>>(new Map())

  // Las máquinas avanzan las órdenes solas: se refresca producción mientras la pantalla está abierta
  useEffect(() => {
    const temporizador = setInterval(() => { cargarProduccion(true).catch(() => undefined) }, 10_000)
    return () => clearInterval(temporizador)
  }, [])

  const centroPorId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros])
  const plantaPorId = useMemo(() => new Map(plantas.map((p) => [p.id, p])), [plantas])

  // Operación en proceso por centro, con su orden
  const trabajoPorCentro = useMemo(() => {
    const mapa = new Map<string, { orden: OrdenProduccion; operacion: OperacionOrden }>()
    for (const orden of ordenes) {
      if (orden.estado !== 'en_proceso') continue
      for (const operacion of orden.operaciones) {
        if (operacion.estado === 'en_proceso' && operacion.centroTrabajoId) mapa.set(operacion.centroTrabajoId, { orden, operacion })
      }
    }
    return mapa
  }, [ordenes])

  // Piezas que ya contó el sensor en cada operación en proceso
  const idsActivas = [...trabajoPorCentro.values()].map((t) => t.operacion.id).sort().join(',')
  useEffect(() => {
    if (!idsActivas) return
    let vigente = true
    piezasPorOperacion(idsActivas.split(',')).then((conteo) => { if (vigente) setContadas(conteo) })
    return () => { vigente = false }
  }, [idsActivas, actualizado])

  const ahora = actualizado?.getTime() ?? 0
  const dispositivos = useMemo(() => {
    const mapa = new Map<string, Dispositivo>()
    for (const l of lecturas) {
      const actual = mapa.get(l.dispositivo) ?? { nombre: l.dispositivo, ultima: l, historial: [], piezasHora: 0, alarmasHora: 0 }
      const reciente = ahora - new Date(l.registradoEn).getTime() <= 3_600_000
      if (reciente) actual.piezasHora += l.piezas
      if (reciente && l.estado === 'alarma') actual.alarmasHora += 1
      actual.historial.push(l)
      mapa.set(l.dispositivo, actual)
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [lecturas, ahora])

  const llegadaMs = (d: Dispositivo) => ahora - new Date(d.ultima.recibidoEn).getTime()
  const estadoDe = (d: Dispositivo): EstadoDispositivo => (llegadaMs(d) > SIN_SENAL_MS ? 'sin_senal' : d.ultima.estado)
  const maquinas = dispositivos.filter((d) => d.ultima.centroTrabajoId)
  const medidoresLuces = dispositivos.filter((d) => !d.ultima.centroTrabajoId)
  const conectadas = maquinas.filter((d) => estadoDe(d) !== 'sin_senal')
  const produciendo = conectadas.filter((d) => d.ultima.estado === 'operando' || d.ultima.estado === 'alarma').length
  const alarmasHora = maquinas.reduce((t, d) => t + d.alarmasHora, 0)
  const potenciaAhora = dispositivos.filter((d) => estadoDe(d) !== 'sin_senal').reduce((t, d) => t + (d.ultima.potenciaKw ?? 0), 0)
  const energiaHoy = resumenHoy.reduce((t, f) => t + f.energiaKwh, 0)
  const co2Hoy = resumenHoy.reduce((t, f) => t + f.energiaKwh * (plantaPorId.get(f.plantaId ?? '')?.factorEmisionKgKwh ?? 0), 0)
  const ultimaLlegada = dispositivos.length ? Math.min(...dispositivos.map(llegadaMs)) : null

  // Máquinas por planta, en el orden de la línea (código del centro)
  const porDispositivo = new Map(maquinas.map((d) => [d.ultima.centroTrabajoId!, d]))
  const grupos = new Map<string, CentroTrabajo[]>()
  for (const c of centros.filter((x) => x.activo).sort((a, b) => a.codigo.localeCompare(b.codigo))) {
    grupos.set(c.plantaId ?? '', [...(grupos.get(c.plantaId ?? '') ?? []), c])
  }
  const lineas = [...grupos.entries()].map(([plantaId, lista]) => ({
    planta: plantaPorId.get(plantaId),
    estaciones: lista.map((centro) => ({ centro, dispositivo: porDispositivo.get(centro.id) }))
  }))

  const conTemperatura = maquinas.filter((d) => d.historial.some((l) => l.temperatura !== undefined))
  const elegido = conTemperatura.find((d) => d.nombre === seleccion) ?? conTemperatura[0]
  const centroElegido = elegido?.ultima.centroTrabajoId ? centroPorId.get(elegido.ultima.centroTrabajoId) : undefined

  const eventos = useMemo(() => construirEventos(dispositivos, centroPorId), [dispositivos, centroPorId])

  // Cola de trabajo: órdenes que esperan a que su encargado se desocupe
  const enCola = ordenes
    .filter((o) => o.estado === 'pendiente')
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
  const nombreResponsable = (id?: string) => responsables.find((r) => r.id === id)?.nombre ?? 'Sin encargado'
  // Cola de envío: lecturas que llegaron tarde porque la máquina estuvo sin red
  const demoradas = lecturas.filter((l) => new Date(l.recibidoEn).getTime() - new Date(l.registradoEn).getTime() > 5000)
  const esperaMax = demoradas.reduce((m, l) => Math.max(m, new Date(l.recibidoEn).getTime() - new Date(l.registradoEn).getTime()), 0)

  return (
    <>
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Monitoreo IIoT"
        descripcion="Lo que reportan en vivo los sensores de las máquinas de la planta. Se actualiza cada 5 segundos."
        seccion={SECCION_PRODUCCION}
        acciones={
          <div className="flex flex-wrap gap-2">
            <Link href="/produccion/iiot/analisis" className={claseBotonSecundario}><BarChart3 size={16} />Análisis por fecha</Link>
            <Link href="/produccion/energia" className={claseBotonSecundario}><Leaf size={16} />Energía y CO₂</Link>
          </div>
        }
      />

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <EstadoPlanta total={maquinas.length} conectadas={conectadas.length} ultimaLlegada={ultimaLlegada} cargado={Boolean(actualizado)} />

      <ComoFunciona />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <TarjetaIndicador titulo="Máquinas produciendo" valor={`${produciendo} de ${maquinas.length}`} detalle={`${conectadas.length} conectadas · el resto espera trabajo o está sin señal`} icono={Radio} tono={produciendo ? 'positivo' : 'neutro'} />
        <TarjetaIndicador titulo="Alarmas (última hora)" valor={String(alarmasHora)} detalle="Temperatura fuera del rango mientras producía" icono={AlertTriangle} tono={alarmasHora ? 'peligro' : 'neutro'} />
        <TarjetaIndicador titulo="Potencia en este momento" valor={formatoKw(potenciaAhora)} detalle="Suma de máquinas y lámparas encendidas" icono={Zap} tono="alerta" />
        <TarjetaIndicador titulo="Energía de hoy" valor={formatoKwh(energiaHoy)} detalle={`Huella de carbono: ${formatoKg(co2Hoy)}`} icono={Leaf} />
      </div>

      {lineas.map(({ planta, estaciones }) => (
        <section key={planta?.id ?? 'sin-planta'} className="mb-6">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="font-semibold text-zinc-900">Línea de producción · {planta ? `${planta.nombre} (${planta.codigo})` : 'Sin planta asignada'}</h2>
              <p className="text-xs text-zinc-400">Las piezas pasan de izquierda a derecha por cada centro de trabajo.</p>
            </div>
            {planta && (
              <MedidorLuces dispositivo={medidoresLuces.find((d) => d.nombre === dispositivoLuces(planta.codigo))} estado={(d) => estadoDe(d)} />
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {estaciones.map(({ centro, dispositivo }, i) => (
              <TarjetaMaquina
                key={centro.id}
                paso={i + 1}
                centro={centro}
                dispositivo={dispositivo}
                estado={dispositivo ? estadoDe(dispositivo) : undefined}
                llegadaMs={dispositivo ? llegadaMs(dispositivo) : 0}
                trabajo={trabajoPorCentro.get(centro.id)}
                contadas={contadas}
              />
            ))}
          </div>
        </section>
      ))}

      {dispositivos.length > 0 && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 mb-6">
          <section className={`${claseTarjeta} p-5 xl:col-span-2`}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-semibold text-zinc-900">Temperatura en vivo{centroElegido ? ` · ${centroElegido.nombre}` : ''}</h2>
                <p className="text-xs text-zinc-500">
                  {centroElegido?.temperaturaMin !== undefined && centroElegido?.temperaturaMax !== undefined
                    ? `La franja verde es la temperatura correcta (${centroElegido.temperaturaMin}–${centroElegido.temperaturaMax} °C). Si la línea azul se sale mientras produce, salta una alarma (punto rojo). Al inicio sube poco a poco: se está calentando.`
                    : 'Últimas lecturas'}
                </p>
              </div>
              {conTemperatura.length > 1 && (
                <select value={elegido?.nombre ?? ''} onChange={(e) => setSeleccion(e.target.value)} className={`${claseInput} w-48`} aria-label="Máquina">
                  {conTemperatura.map((d) => <option key={d.nombre} value={d.nombre}>{centroPorId.get(d.ultima.centroTrabajoId ?? '')?.nombre ?? d.nombre}</option>)}
                </select>
              )}
            </div>
            {elegido ? (
              <GraficoTemperatura lecturas={[...elegido.historial].slice(0, 80).reverse()} minimo={centroElegido?.temperaturaMin} maximo={centroElegido?.temperaturaMax} />
            ) : (
              <p className="py-10 text-center text-sm text-zinc-400">Ninguna máquina reporta temperatura.</p>
            )}
          </section>

          <section className={claseTarjeta}>
            <h2 className="px-5 pt-5 font-semibold text-zinc-900">Qué pasó</h2>
            <p className="px-5 pb-3 text-xs text-zinc-400">Alarmas, paros y apagones recientes</p>
            {eventos.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-zinc-400">Sin novedades: todo funciona normal.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto divide-y divide-zinc-100 border-t border-zinc-100">
                {eventos.map((e) => (
                  <li key={e.id} className="flex gap-3 px-5 py-2.5 text-xs">
                    <span className="w-14 shrink-0 tabular-nums text-zinc-400">{new Date(e.momento).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span className={e.tono === 'peligro' ? 'text-red-700' : e.tono === 'alerta' ? 'text-amber-800' : 'text-zinc-600'}>{e.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={`${claseTarjeta} p-5`}>
          <h2 className="flex items-center gap-2 font-semibold text-zinc-900"><Clock size={16} className="text-zinc-400" />Cola de trabajo</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Cada encargado trabaja una orden a la vez. Las demás esperan en cola y arrancan solas cuando él se desocupa.
          </p>
          {enCola.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No hay órdenes esperando.</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-100">
              {enCola.slice(0, 8).map((o, i) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="mr-2 text-xs text-zinc-400">#{i + 1}</span>
                    <Link href={`/produccion?detalle=${encodeURIComponent(o.id)}`} className="font-mono underline">{codigoOrden(o.id)}</Link>
                    <span className="ml-2 text-xs text-zinc-500">{formatoCantidad(o.cantidadPlanificada)} und · {nombreResponsable(o.empleadoId)}</span>
                  </span>
                  <span className="text-xs text-amber-700 whitespace-nowrap">espera {formatoMinutos((ahora - new Date(o.creadoEn).getTime()) / 60000)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${claseTarjeta} p-5`}>
          <h2 className="flex items-center gap-2 font-semibold text-zinc-900"><WifiOff size={16} className="text-zinc-400" />Cola de envío de las máquinas</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Si se cae la red, cada máquina guarda sus lecturas y las reenvía al volver la conexión, con la hora en que las tomó.
            Así no se pierde ningún dato. Aquí se ve cuánto esperaron.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-zinc-50 px-3 py-3">
              <dt className="text-[11px] text-zinc-500">Lecturas que llegaron tarde</dt>
              <dd className="text-lg font-semibold tabular-nums text-zinc-900">{demoradas.length} <span className="text-xs font-normal text-zinc-400">de {lecturas.length}</span></dd>
            </div>
            <div className="rounded-lg bg-zinc-50 px-3 py-3">
              <dt className="text-[11px] text-zinc-500">Mayor espera en cola</dt>
              <dd className="text-lg font-semibold tabular-nums text-zinc-900">{demoradas.length ? hace(esperaMax) : '—'}</dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  )
}

function EstadoPlanta({ total, conectadas, ultimaLlegada, cargado }: { total: number; conectadas: number; ultimaLlegada: number | null; cargado: boolean }) {
  if (!cargado) return null
  if (ultimaLlegada === null) {
    return (
      <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm text-zinc-700">
        <p className="flex items-center gap-2 font-semibold text-zinc-900"><Plug size={16} />La planta todavía no ha enviado datos</p>
        <ol className="mt-2 ml-5 list-decimal space-y-1 text-xs">
          <li>En <code className="font-mono">.env.local</code> defina <code className="font-mono">IIOT_API_KEY</code> y <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>.</li>
          <li>En la terminal ejecute <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-zinc-200">npm run dev:planta</code> (levanta el ERP y conecta las máquinas).</li>
          <li>Cree una orden de producción: las máquinas la toman y la fabrican solas.</li>
        </ol>
        <p className="mt-2 text-xs">¿Solo quiere ver el análisis histórico? Vaya a <Link href="/produccion/iiot/analisis" className="underline">Análisis por fecha</Link> y cargue los datos de ejemplo.</p>
      </div>
    )
  }
  if (ultimaLlegada > SIN_SENAL_MS) {
    return (
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <WifiOff size={18} className="mt-0.5 shrink-0" />
        <p><strong>La planta está desconectada.</strong> La última lectura llegó hace {hace(ultimaLlegada)}. Si quiere que las máquinas trabajen, ejecute <code className="font-mono bg-white/70 px-1 rounded">npm run dev:planta</code>.</p>
      </div>
    )
  }
  return (
    <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
      <Activity size={18} className="mt-0.5 shrink-0" />
      <p><strong>Planta conectada.</strong> {conectadas} de {total} máquinas están reportando; la última lectura llegó hace {hace(ultimaLlegada)}.</p>
    </div>
  )
}

function MedidorLuces({ dispositivo, estado }: { dispositivo?: Dispositivo; estado: (d: Dispositivo) => EstadoDispositivo }) {
  if (!dispositivo) return null
  const encendidas = estado(dispositivo) !== 'sin_senal'
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600">
      <Lightbulb size={14} className={encendidas ? 'text-amber-500' : 'text-zinc-300'} />
      Lámparas {encendidas ? `encendidas · ${formatoKw(dispositivo.ultima.potenciaKw ?? 0)}` : 'sin señal'}
    </span>
  )
}

function TarjetaMaquina({
  paso,
  centro,
  dispositivo,
  estado,
  llegadaMs,
  trabajo,
  contadas
}: {
  paso: number
  centro: CentroTrabajo
  dispositivo?: Dispositivo
  estado?: EstadoDispositivo
  llegadaMs: number
  trabajo?: { orden: OrdenProduccion; operacion: OperacionOrden }
  contadas: Map<string, number>
}) {
  const l = dispositivo?.ultima
  const entrada = trabajo ? entradaOperacion(trabajo.orden, trabajo.operacion) : 0
  const hechas = trabajo ? Math.min(contadas.get(trabajo.operacion.id) ?? 0, entrada) : 0
  const espera = l ? new Date(l.recibidoEn).getTime() - new Date(l.registradoEn).getTime() : 0

  const frase = !l
    ? 'Esta máquina todavía no ha enviado ninguna lectura.'
    : estado === 'sin_senal'
      ? `No reporta desde hace ${hace(llegadaMs)}: está apagada o sin conexión.`
      : estado === 'alarma'
        ? l.mensaje ?? 'Temperatura fuera de rango.'
        : estado === 'paro'
          ? `Detenida: ${l.mensaje ?? 'sin motivo'}.`
          : estado === 'preparacion'
            ? `${l.mensaje ?? 'Preparando'} antes de producir.`
            : estado === 'inactivo'
              ? 'Encendida, esperando que llegue una orden.'
              : 'Produciendo normalmente.'

  const borde = estado === 'alarma' ? 'border-red-300' : estado === 'paro' ? 'border-amber-300' : estado === 'sin_senal' ? 'border-zinc-400 border-dashed' : ''

  return (
    <section className={`${claseTarjeta} ${borde} relative p-4 flex flex-col`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-zinc-400">Paso {paso} · {centro.codigo}</p>
          <p className="font-semibold text-zinc-900 truncate">{centro.nombre}</p>
          <p className="font-mono text-[11px] text-zinc-400">{dispositivo?.nombre ?? 'sin dispositivo'}</p>
        </div>
        {estado ? <InsigniaLectura estado={estado} /> : <Cpu size={16} className="text-zinc-300" />}
      </div>

      <p className={`mt-2 text-xs ${estado === 'alarma' ? 'text-red-700 font-medium' : 'text-zinc-600'}`}>{frase}</p>

      {trabajo && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-zinc-500">
            <Link href={`/produccion?detalle=${encodeURIComponent(trabajo.orden.id)}`} className="truncate underline">{codigoOrden(trabajo.orden.id)} · {trabajo.operacion.nombre}</Link>
            <span className="tabular-nums whitespace-nowrap ml-2">{hechas} de {entrada} pz</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${entrada ? (hechas / entrada) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {l && (
        <div className="mt-3 space-y-2">
          {l.temperatura !== undefined && (
            <div>
              <p className="flex justify-between text-[11px] text-zinc-500"><span>Temperatura</span><span className="font-semibold text-zinc-900 tabular-nums">{l.temperatura} °C</span></p>
              {centro.temperaturaMin !== undefined && centro.temperaturaMax !== undefined && (
                <MedidorRango valor={l.temperatura} minimo={centro.temperaturaMin} maximo={centro.temperaturaMax} unidad="°C" />
              )}
            </div>
          )}
          <dl className="grid grid-cols-3 gap-1.5 text-center">
            <Medida etiqueta="Potencia" valor={l.potenciaKw !== undefined ? formatoKw(l.potenciaKw) : '—'} />
            <Medida etiqueta={l.humedad !== undefined ? 'Humedad' : 'Presión'} valor={l.humedad !== undefined ? `${l.humedad} %` : l.presion !== undefined ? `${l.presion} bar` : '—'} />
            <Medida etiqueta="Piezas/h" valor={formatoCantidad(dispositivo!.piezasHora)} />
          </dl>
        </div>
      )}

      {l && (
        <p className="mt-auto pt-3 text-[11px] text-zinc-400">
          Última lectura hace {hace(llegadaMs)}
          {espera > 5000 && <span className="text-amber-700"> · esperó {hace(espera)} en cola</span>}
        </p>
      )}
      <ArrowRight size={14} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-zinc-300 xl:block" aria-hidden="true" />
    </section>
  )
}

function Medida({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-1.5 py-1.5">
      <dt className="text-[10px] text-zinc-500">{etiqueta}</dt>
      <dd className="text-xs font-semibold tabular-nums text-zinc-900">{valor}</dd>
    </div>
  )
}

// Alarmas, paros, apagones (huecos sin lecturas) y reencendidos, en palabras simples
function construirEventos(dispositivos: Dispositivo[], centroPorId: Map<string, CentroTrabajo>): Evento[] {
  const eventos: Evento[] = []
  for (const d of dispositivos) {
    const nombre = centroPorId.get(d.ultima.centroTrabajoId ?? '')?.nombre ?? d.nombre
    const cronologico = [...d.historial].reverse()
    cronologico.forEach((l, i) => {
      const anterior = cronologico[i - 1]
      if (anterior) {
        const hueco = new Date(l.registradoEn).getTime() - new Date(anterior.registradoEn).getTime()
        if (hueco > SIN_SENAL_MS) eventos.push({ id: `${l.id}-hueco`, momento: anterior.registradoEn, tono: 'alerta', texto: `${nombre} estuvo sin señal ${hace(hueco)} (apagada o sin energía).` })
      }
      if (l.estado === 'alarma') eventos.push({ id: l.id, momento: l.registradoEn, tono: 'peligro', texto: `${nombre}: ${l.mensaje ?? 'alarma'}.` })
      else if (l.estado === 'paro' && anterior?.estado !== 'paro') eventos.push({ id: l.id, momento: l.registradoEn, tono: 'alerta', texto: `${nombre} se detuvo: ${l.mensaje ?? 'sin motivo'}.` })
      else if (l.mensaje?.startsWith('Volvió a encender')) eventos.push({ id: l.id, momento: l.registradoEn, tono: 'info', texto: `${nombre} volvió a encender.` })
    })
  }
  return eventos.sort((a, b) => b.momento.localeCompare(a.momento)).slice(0, 25)
}
