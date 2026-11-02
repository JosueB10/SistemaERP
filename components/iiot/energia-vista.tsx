'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Car, Coins, Factory, Leaf, Lightbulb, TreePine, Zap } from 'lucide-react'

import { formatoCantidad, formatoCordobas, formatoNumero } from '@/lib/inventario/utilidades'
import { useResumenIiot } from '@/lib/iiot/store'
import {
  diaManagua,
  diasEntre,
  etiquetaDia,
  formatoKg,
  formatoKw,
  formatoKwh,
  KG_CO2_ABSORBE_ARBOL_ANIO,
  KG_CO2_POR_KM_AUTO,
  sumarDias
} from '@/lib/iiot/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import GraficoColumnas, { COLOR_SERIE } from '../finanzas/grafico-columnas'
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
import { AvisoConexionProduccion, SECCION_PRODUCCION } from '../produccion/ui'

export default function EnergiaVista() {
  const { centros, plantas, ordenes } = useProduccion()
  const hoy = diaManagua()
  const [desde, setDesde] = useState(() => sumarDias(diaManagua(), -30))
  const [hasta, setHasta] = useState(hoy)
  const [plantaId, setPlantaId] = useState('')
  const { filas: todas, error, cargando } = useResumenIiot(desde, hasta)

  const centroPorId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros])
  const plantaPorId = useMemo(() => new Map(plantas.map((p) => [p.id, p])), [plantas])
  const filas = plantaId ? todas.filter((f) => f.plantaId === plantaId) : todas
  const factor = (id?: string) => plantaPorId.get(id ?? '')?.factorEmisionKgKwh ?? 0
  const tarifa = (id?: string) => plantaPorId.get(id ?? '')?.tarifaKwh ?? 0
  const esLuz = (centroId?: string) => !centroId

  const kwh = filas.reduce((t, f) => t + f.energiaKwh, 0)
  const kwhLuces = filas.filter((f) => esLuz(f.centroTrabajoId)).reduce((t, f) => t + f.energiaKwh, 0)
  const co2 = filas.reduce((t, f) => t + f.energiaKwh * factor(f.plantaId), 0)
  const costo = filas.reduce((t, f) => t + f.energiaKwh * tarifa(f.plantaId), 0)

  // Mousepads terminados en el período: órdenes cerradas; sin órdenes, las piezas que contó la última estación
  const unidadesOrdenes = ordenes
    .filter((o) => o.estado === 'completada' && o.fechaFin && o.fechaFin >= desde && o.fechaFin <= hasta)
    .reduce((t, o) => t + o.cantidadProducida, 0)
  const ultimaEstacion = [...centros].filter((c) => c.activo && (!plantaId || c.plantaId === plantaId)).sort((a, b) => b.codigo.localeCompare(a.codigo))[0]
  const unidadesSensor = filas.filter((f) => f.centroTrabajoId === ultimaEstacion?.id).reduce((t, f) => t + f.piezas, 0)
  const unidades = unidadesOrdenes || unidadesSensor
  const origenUnidades = unidadesOrdenes ? 'órdenes cerradas en el período' : ultimaEstacion ? `piezas contadas en ${ultimaEstacion.nombre}` : ''

  const dias = diasEntre(desde, hasta)
  const porDia = (filtro: (centroId?: string) => boolean) => dias.map((d) => filas.filter((f) => f.dia === d && filtro(f.centroTrabajoId)).reduce((t, f) => t + f.energiaKwh, 0))

  const porMaquina = useMemo(() => {
    const mapa = new Map<string, { dispositivo: string; centroId?: string; plantaId?: string; kwh: number; potenciaMax: number }>()
    for (const f of filas) {
      const a = mapa.get(f.dispositivo) ?? { dispositivo: f.dispositivo, centroId: f.centroTrabajoId, plantaId: f.plantaId, kwh: 0, potenciaMax: 0 }
      a.kwh += f.energiaKwh
      a.potenciaMax = Math.max(a.potenciaMax, f.potenciaMax ?? 0)
      mapa.set(f.dispositivo, a)
    }
    return [...mapa.values()].sort((a, b) => b.kwh - a.kwh)
  }, [filas])

  const porPlanta = plantas
    .filter((p) => !plantaId || p.id === plantaId)
    .map((p) => {
      const propias = filas.filter((f) => f.plantaId === p.id)
      const luces = propias.filter((f) => esLuz(f.centroTrabajoId)).reduce((t, f) => t + f.energiaKwh, 0)
      const total = propias.reduce((t, f) => t + f.energiaKwh, 0)
      return { planta: p, maquinas: total - luces, luces, total }
    })

  const mayor = porMaquina.find((m) => m.centroId)
  const nombre = (m: { dispositivo: string; centroId?: string }) => m.centroId ? centroPorId.get(m.centroId)?.nombre ?? m.dispositivo : 'Iluminación (lámparas)'

  return (
    <>
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Energía y huella de carbono"
        descripcion="Cuánta electricidad gastan las máquinas y las lámparas, cuánto cuesta y cuánto CO₂ genera. Los datos vienen de los medidores IIoT."
        seccion={SECCION_PRODUCCION}
      />

      {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className={`${claseTarjeta} p-5 mb-6`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo etiqueta="Desde" htmlFor="en-desde">
            <input id="en-desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={claseInput} />
          </Campo>
          <Campo etiqueta="Hasta" htmlFor="en-hasta">
            <input id="en-hasta" type="date" value={hasta} min={desde} max={hoy} onChange={(e) => setHasta(e.target.value)} className={claseInput} />
          </Campo>
          <Campo etiqueta="Planta" htmlFor="en-planta">
            <select id="en-planta" value={plantaId} onChange={(e) => setPlantaId(e.target.value)} className={claseInput}>
              <option value="">Todas las plantas</option>
              {plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>)}
            </select>
          </Campo>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          <strong>Cómo se calcula:</strong> cada lectura trae la energía (kWh) que gastó el equipo desde la anterior.
          Huella de carbono = kWh × factor de emisión de la red ({plantas.map((p) => `${p.codigo}: ${formatoNumero(p.factorEmisionKgKwh, 3)} kg CO₂/kWh`).join(' · ') || '—'}).
          Costo = kWh × tarifa. Ambos valores son de referencia y se ajustan en <Link href="/produccion/plantas" className="underline">Plantas</Link>.
        </p>
      </section>

      {!cargando && filas.length === 0 ? (
        <div className={claseTarjeta}>
          <EstadoVacio icono={Zap} titulo="No hay mediciones de energía en estas fechas" descripcion="Conecte la planta (npm run dev:planta) o cargue los datos de ejemplo en Monitoreo IIoT → Análisis por fecha." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            <TarjetaIndicador titulo="Energía consumida" valor={formatoKwh(kwh)} detalle={`${kwh ? Math.round((kwhLuces / kwh) * 100) : 0} % es iluminación`} icono={Zap} tono="alerta" />
            <TarjetaIndicador titulo="Costo de la energía" valor={formatoCordobas(costo)} detalle="Según la tarifa de cada planta" icono={Coins} />
            <TarjetaIndicador titulo="Huella de carbono" valor={formatoKg(co2)} detalle="CO₂ emitido por generar esa electricidad" icono={Leaf} tono="peligro" />
            <TarjetaIndicador titulo="CO₂ por mousepad" valor={unidades ? `${formatoNumero((co2 / unidades) * 1000, 0)} g` : '—'}
              detalle={unidades ? `${formatoNumero(kwh / unidades, 3)} kWh por unidad · ${formatoCantidad(unidades)} ${origenUnidades}` : 'Sin unidades terminadas en el período'} icono={Factory} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 mb-6">
            <section className={`${claseTarjeta} p-5 xl:col-span-2`}>
              <h2 className="font-semibold text-zinc-900">Consumo por día</h2>
              <p className="mb-3 text-xs text-zinc-500">kWh de las máquinas y de las lámparas cada día.</p>
              <GraficoColumnas
                categorias={dias.map(etiquetaDia)}
                series={[
                  { nombre: 'Máquinas', color: COLOR_SERIE.primaria, valores: porDia((c) => !esLuz(c)) },
                  { nombre: 'Iluminación', color: COLOR_SERIE.secundaria, valores: porDia(esLuz) }
                ]}
                formato={formatoKwh}
                descripcion="Energía consumida por día, máquinas e iluminación"
              />
            </section>

            <section className={`${claseTarjeta} p-5`}>
              <h2 className="font-semibold text-zinc-900">¿Eso es mucho?</h2>
              <p className="mb-4 text-xs text-zinc-500">Equivalencias aproximadas de la huella del período.</p>
              <ul className="space-y-4 text-sm text-zinc-700">
                <li className="flex gap-3"><Car size={20} className="shrink-0 text-zinc-400" /><span>Igual que recorrer <strong>{formatoCantidad(Math.round(co2 / KG_CO2_POR_KM_AUTO))} km</strong> en un carro de gasolina ({KG_CO2_POR_KM_AUTO} kg CO₂/km).</span></li>
                <li className="flex gap-3"><TreePine size={20} className="shrink-0 text-emerald-600" /><span>Se necesitarían <strong>{formatoCantidad(Math.ceil(co2 / KG_CO2_ABSORBE_ARBOL_ANIO))} árboles</strong> durante un año para absorber ese CO₂ (≈ {KG_CO2_ABSORBE_ARBOL_ANIO} kg por árbol al año).</span></li>
                {mayor && kwh > 0 && (
                  <li className="flex gap-3"><Zap size={20} className="shrink-0 text-amber-500" /><span><strong>{nombre(mayor)}</strong> gasta el {Math.round((mayor.kwh / kwh) * 100)} % de la energía: es donde más conviene ahorrar (apagarla en vez de dejarla en espera, revisar su aislamiento térmico).</span></li>
                )}
                {kwhLuces > 0 && (
                  <li className="flex gap-3"><Lightbulb size={20} className="shrink-0 text-amber-500" /><span>Las lámparas gastaron {formatoKwh(kwhLuces)}. Aprovechar la luz natural o usar sensores de presencia reduce ese consumo.</span></li>
                )}
              </ul>
            </section>
          </div>

          <section className={`${claseTarjeta} mb-6`}>
            <h2 className="px-5 pt-5 pb-3 font-semibold text-zinc-900">Consumo por equipo</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Equipo</th>
                    <th className={claseCabeceraTabla}>Participación</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Energía</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Costo</th>
                    <th className={`${claseCabeceraTabla} text-right`}>CO₂</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Potencia máx. medida</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Potencia nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {porMaquina.map((m) => {
                    const parte = kwh ? m.kwh / kwh : 0
                    return (
                      <tr key={m.dispositivo}>
                        <td className={claseCeldaTabla}>
                          <p className="font-medium text-zinc-900">{nombre(m)}</p>
                          <p className="font-mono text-xs text-zinc-400">{m.dispositivo}</p>
                        </td>
                        <td className={`${claseCeldaTabla} w-48`}>
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-zinc-100"><div className="h-full rounded-full" style={{ width: `${parte * 100}%`, backgroundColor: m.centroId ? COLOR_SERIE.primaria : COLOR_SERIE.secundaria }} /></div>
                            <span className="w-10 text-right text-xs tabular-nums">{Math.round(parte * 100)} %</span>
                          </div>
                        </td>
                        <td className={`${claseCeldaTabla} text-right font-medium`}>{formatoKwh(m.kwh)}</td>
                        <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(m.kwh * tarifa(m.plantaId))}</td>
                        <td className={`${claseCeldaTabla} text-right`}>{formatoKg(m.kwh * factor(m.plantaId))}</td>
                        <td className={`${claseCeldaTabla} text-right`}>{formatoKw(m.potenciaMax)}</td>
                        <td className={`${claseCeldaTabla} text-right text-zinc-500`}>
                          {m.centroId ? formatoKw(centroPorId.get(m.centroId)?.potenciaKw ?? 0) : formatoKw(plantaPorId.get(m.plantaId ?? '')?.iluminacionKw ?? 0)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={claseTarjeta}>
            <h2 className="px-5 pt-5 pb-3 font-semibold text-zinc-900">Por planta</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Planta</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Máquinas</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Iluminación</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Total</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Costo</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Huella</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {porPlanta.map(({ planta, maquinas, luces, total }) => (
                    <tr key={planta.id}>
                      <td className={claseCeldaTabla}>
                        <p className="font-medium text-zinc-900">{planta.nombre}</p>
                        <p className="font-mono text-xs text-zinc-400">{planta.codigo}</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoKwh(maquinas)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoKwh(luces)}</td>
                      <td className={`${claseCeldaTabla} text-right font-medium`}>{formatoKwh(total)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(total * planta.tarifaKwh)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoKg(total * planta.factorEmisionKgKwh)}</td>
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
