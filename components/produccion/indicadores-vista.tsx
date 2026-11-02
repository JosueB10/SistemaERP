'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Gauge, Timer, Zap } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { formatoCantidad } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { cicloEstandarUnidad, formatoMinutos, formatoPorcentaje, indicadores, nivelOee, tiempoCicloOrden } from '@/lib/produccion/utilidades'
import {
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  TarjetaIndicador
} from '../inventario/ui'
import { AvisoConexionProduccion, SECCION_PRODUCCION, ValorOee } from './ui'

type Periodo = '7' | '30' | '90' | 'todo'

export default function IndicadoresVista() {
  const { productos } = useInventario()
  const { ordenes, centros } = useProduccion()
  const [periodo, setPeriodo] = useState<Periodo>('30')
  // Momento de referencia del periodo, fijado al abrir la pantalla
  const [ahora] = useState(() => Date.now())

  // Operaciones terminadas dentro del periodo (por fecha de fin)
  const operaciones = useMemo(() => {
    const desde = periodo === 'todo' ? 0 : ahora - Number(periodo) * 86_400_000
    return ordenes.flatMap((o) => o.operaciones).filter((op) => op.estado === 'completada' && op.fin && new Date(op.fin).getTime() >= desde)
  }, [ordenes, periodo, ahora])
  const ids = new Set(operaciones.map((o) => o.id))

  const global = indicadores(operaciones)
  const porCentro = centros
    .map((c) => ({ centro: c, ind: indicadores(operaciones.filter((o) => o.centroTrabajoId === c.id)), cantidad: operaciones.filter((o) => o.centroTrabajoId === c.id).length }))
    .filter((f) => f.ind)
  const peor = [...porCentro].sort((a, b) => a.ind!.oee - b.ind!.oee)[0]
  const ordenesPeriodo = ordenes
    .filter((o) => o.operaciones.some((op) => ids.has(op.id)))
    .map((o) => ({ orden: o, ind: indicadores(o.operaciones), ciclo: tiempoCicloOrden(o) }))
  const ciclos = ordenesPeriodo.filter((f) => f.ciclo !== null)
  const cicloPromedio = ciclos.length ? ciclos.reduce((t, f) => t + f.ciclo!, 0) / ciclos.length : 0
  const productoPorId = new Map(productos.map((p) => [p.id, p]))

  return (
    <>
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Indicadores de planta"
        descripcion="OEE (disponibilidad × rendimiento × calidad) y tiempo de ciclo, calculados con las operaciones registradas en las órdenes."
        seccion={SECCION_PRODUCCION}
        acciones={
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as Periodo)} className={`${claseInput} w-44`} aria-label="Periodo">
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
            <option value="todo">Todo</option>
          </select>
        }
      />

      {!global ? (
        <div className={claseTarjeta}>
          <EstadoVacio icono={Gauge} titulo="Aún no hay operaciones terminadas en el periodo" descripcion="Inicie una orden de un producto con ruta y registre sus operaciones para calcular el OEE." />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
            <TarjetaIndicador titulo="OEE global" valor={formatoPorcentaje(global.oee)} detalle="≥ 85 % clase mundial · 65–85 % aceptable" icono={Gauge} tono={nivelOee(global.oee)} />
            <TarjetaIndicador titulo="Disponibilidad" valor={formatoPorcentaje(global.disponibilidad)} detalle={`${formatoMinutos(global.paroMin)} de paros en ${formatoMinutos(global.planificadoMin)}`} icono={Zap} />
            <TarjetaIndicador titulo="Rendimiento" valor={formatoPorcentaje(global.rendimiento)} detalle={`Estándar ${formatoMinutos(global.estandarMin)} vs. operativo ${formatoMinutos(global.operativoMin)}`} icono={Timer} />
            <TarjetaIndicador titulo="Calidad" valor={formatoPorcentaje(global.calidad)} detalle={`${formatoCantidad(global.buenas)} buenas · ${formatoCantidad(global.rechazadas)} rechazadas`} icono={CheckCircle2} tono={global.rechazadas ? 'alerta' : 'positivo'} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <TarjetaIndicador titulo="Tiempo de ciclo promedio por orden" valor={ciclos.length ? formatoMinutos(cicloPromedio) : '—'} detalle={`Desde la primera operación hasta la última · ${ciclos.length} orden(es) con ruta terminada`} icono={Timer} />
            <TarjetaIndicador titulo="Centro con menor OEE" valor={peor ? peor.centro.nombre : '—'} detalle={peor ? `OEE ${formatoPorcentaje(peor.ind!.oee)}: principal oportunidad de mejora` : ''} icono={Gauge} tono={peor ? nivelOee(peor.ind!.oee) : 'neutro'} />
          </div>

          <section className={`${claseTarjeta} mb-6`}>
            <h2 className="px-5 pt-5 pb-3 font-semibold text-zinc-900">OEE por centro de trabajo</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Centro</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Operaciones</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Piezas (buenas/rech.)</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Disponibilidad</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Rendimiento</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Calidad</th>
                    <th className={`${claseCabeceraTabla} text-right`}>OEE</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Ciclo real / und</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {porCentro.map(({ centro, ind, cantidad }) => (
                    <tr key={centro.id}>
                      <td className={claseCeldaTabla}>
                        <p className="font-medium text-zinc-900">{centro.nombre}</p>
                        <p className="font-mono text-xs text-zinc-400">{centro.codigo}</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{cantidad}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(ind!.buenas)} / {formatoCantidad(ind!.rechazadas)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoPorcentaje(ind!.disponibilidad)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoPorcentaje(ind!.rendimiento)}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoPorcentaje(ind!.calidad)}</td>
                      <td className={`${claseCeldaTabla} text-right`}><ValorOee valor={ind!.oee} /></td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoMinutos(ind!.cicloRealMin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={claseTarjeta}>
            <h2 className="px-5 pt-5 pb-3 font-semibold text-zinc-900">Tiempo de ciclo y OEE por orden</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Orden</th>
                    <th className={claseCabeceraTabla}>Producto</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Avance</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Ciclo estándar / und</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Ciclo real / und</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Tiempo de ciclo de la orden</th>
                    <th className={`${claseCabeceraTabla} text-right`}>OEE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {ordenesPeriodo.map(({ orden, ind, ciclo }) => {
                    const terminadas = orden.operaciones.filter((o) => o.estado === 'completada')
                    // Real por unidad: suma de los minutos operativos por pieza de cada operación
                    const realUnidad = terminadas.reduce((t, o) => t + (indicadores([o])?.cicloRealMin ?? 0), 0)
                    return (
                      <tr key={orden.id}>
                        <td className={`${claseCeldaTabla} font-mono text-xs`}>
                          <Link href={`/produccion?detalle=${encodeURIComponent(orden.id)}`} className="underline">{orden.codigo}</Link>
                        </td>
                        <td className={claseCeldaTabla}>{productoPorId.get(orden.productoId)?.nombre ?? 'Producto inactivo'}</td>
                        <td className={`${claseCeldaTabla} text-right`}>{terminadas.length}/{orden.operaciones.length} pasos</td>
                        <td className={`${claseCeldaTabla} text-right`}>{formatoMinutos(cicloEstandarUnidad(orden.operaciones))}</td>
                        <td className={`${claseCeldaTabla} text-right`}>{formatoMinutos(realUnidad)}</td>
                        <td className={`${claseCeldaTabla} text-right font-medium text-zinc-900`}>{ciclo !== null ? formatoMinutos(ciclo) : <span className="text-zinc-400">En curso</span>}</td>
                        <td className={`${claseCeldaTabla} text-right`}>{ind ? <ValorOee valor={ind.oee} /> : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  )
}
