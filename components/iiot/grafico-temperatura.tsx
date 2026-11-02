'use client'

import { useState } from 'react'

import type { LecturaIiot } from '@/lib/iiot/store'
import { ETIQUETAS_ESTADO_LECTURA } from '@/lib/iiot/utilidades'

// Temperatura de una máquina en el tiempo, con la banda del rango de operación del centro.
// Una sola serie: el título la nombra (sin leyenda); las alarmas se marcan con punto y etiqueta en el tooltip.
const ANCHO = 720
const ALTO = 220
const MARGEN = { arriba: 12, derecha: 16, abajo: 26, izquierda: 44 }
const COLOR_SERIE = '#2a78d6'

export default function GraficoTemperatura({
  lecturas,
  minimo,
  maximo
}: {
  lecturas: LecturaIiot[]
  minimo?: number
  maximo?: number
}) {
  const [indice, setIndice] = useState<number | null>(null)
  const puntos = lecturas.filter((l) => l.temperatura !== undefined)
  if (puntos.length < 2) {
    return <p className="py-10 text-center text-sm text-zinc-400">Aún no hay suficientes lecturas de temperatura.</p>
  }

  const valores = puntos.map((p) => p.temperatura!)
  const piso = Math.floor(Math.min(...valores, minimo ?? Infinity) / 10) * 10 - 5
  const techo = Math.ceil(Math.max(...valores, maximo ?? -Infinity) / 10) * 10 + 5
  const ancho = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i: number) => MARGEN.izquierda + (i / (puntos.length - 1)) * ancho
  const y = (v: number) => MARGEN.arriba + (1 - (v - piso) / (techo - piso)) * alto
  const marcas = Array.from({ length: 5 }, (_, i) => piso + ((techo - piso) / 4) * i)
  const trazo = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.temperatura!).toFixed(1)}`).join(' ')
  const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const activo = indice !== null ? puntos[indice] : null

  const mover = (evento: React.PointerEvent<SVGSVGElement>) => {
    const caja = evento.currentTarget.getBoundingClientRect()
    const posicion = ((evento.clientX - caja.left) / caja.width) * ANCHO
    const i = Math.round(((posicion - MARGEN.izquierda) / ancho) * (puntos.length - 1))
    setIndice(Math.max(0, Math.min(puntos.length - 1, i)))
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full h-auto touch-none"
        role="img"
        aria-label={`Temperatura: última ${valores[valores.length - 1]} °C, mínima ${Math.min(...valores)} °C, máxima ${Math.max(...valores)} °C`}
        onPointerMove={mover}
        onPointerLeave={() => setIndice(null)}
      >
        {minimo !== undefined && maximo !== undefined && (
          <rect x={MARGEN.izquierda} y={y(maximo)} width={ancho} height={Math.max(0, y(minimo) - y(maximo))} fill="#10b981" opacity={0.08} />
        )}
        {marcas.map((v) => (
          <g key={v}>
            <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(v)} y2={y(v)} stroke="#e4e4e7" strokeWidth={1} />
            <text x={MARGEN.izquierda - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="#71717a">{Math.round(v)}°</text>
          </g>
        ))}
        {[minimo, maximo].map((v, i) => v !== undefined && (
          <line key={i} x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(v)} y2={y(v)} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} />
        ))}
        <text x={MARGEN.izquierda} y={ALTO - 6} fontSize={11} fill="#71717a">{hora(puntos[0].registradoEn)}</text>
        <text x={ANCHO - MARGEN.derecha} y={ALTO - 6} fontSize={11} fill="#71717a" textAnchor="end">{hora(puntos[puntos.length - 1].registradoEn)}</text>
        <path d={trazo} fill="none" stroke={COLOR_SERIE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {puntos.map((p, i) => p.estado === 'alarma' && (
          <circle key={p.id} cx={x(i)} cy={y(p.temperatura!)} r={4.5} fill="#dc2626" stroke="#fff" strokeWidth={2} />
        ))}
        {activo && indice !== null && (
          <>
            <line x1={x(indice)} x2={x(indice)} y1={MARGEN.arriba} y2={ALTO - MARGEN.abajo} stroke="#a1a1aa" strokeWidth={1} />
            <circle cx={x(indice)} cy={y(activo.temperatura!)} r={4.5} fill={COLOR_SERIE} stroke="#fff" strokeWidth={2} />
          </>
        )}
      </svg>
      {activo && indice !== null && (
        <div
          className="pointer-events-none absolute top-1 z-10 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${(x(indice) / ANCHO) * 100}%`, transform: `translateX(${indice > puntos.length / 2 ? 'calc(-100% - 8px)' : '8px'})` }}
        >
          <p className="font-semibold">{activo.temperatura} °C</p>
          <p className="text-zinc-300">{hora(activo.registradoEn)}</p>
          {activo.estado !== 'operando' && <p className={activo.estado === 'alarma' ? 'text-red-300' : 'text-zinc-300'}>{ETIQUETAS_ESTADO_LECTURA[activo.estado]}{activo.mensaje ? `: ${activo.mensaje}` : ''}</p>}
        </div>
      )}
    </div>
  )
}
