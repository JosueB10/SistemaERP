'use client'

import { useState } from 'react'

import { etiquetaDia } from '@/lib/iiot/utilidades'

export interface PuntoDiario {
  dia: string
  promedio: number
  minimo: number
  maximo: number
  alarmas: number
}

// Temperatura por día: una barra de la mínima a la máxima y un punto en el promedio, sobre la franja del rango
// correcto del centro. Los días con alarmas van en rojo. Una sola serie: el título la nombra.
const ANCHO = 760
const ALTO = 240
const MARGEN = { arriba: 12, derecha: 12, abajo: 28, izquierda: 44 }
const COLOR = '#2a78d6'
const COLOR_ALARMA = '#dc2626'

export default function GraficoRangoDiario({
  puntos,
  minimo,
  maximo,
  seleccionado,
  onSeleccionar
}: {
  puntos: PuntoDiario[]
  minimo?: number
  maximo?: number
  seleccionado?: string
  onSeleccionar: (dia: string) => void
}) {
  const [activo, setActivo] = useState<number | null>(null)
  if (puntos.length === 0) return <p className="py-10 text-center text-sm text-zinc-400">No hay lecturas de temperatura en estas fechas.</p>

  const valores = puntos.flatMap((p) => [p.minimo, p.maximo])
  const piso = Math.floor(Math.min(...valores, minimo ?? Infinity) / 10) * 10 - 5
  const techo = Math.ceil(Math.max(...valores, maximo ?? -Infinity) / 10) * 10 + 5
  const ancho = ANCHO - MARGEN.izquierda - MARGEN.derecha
  const alto = ALTO - MARGEN.arriba - MARGEN.abajo
  const banda = ancho / puntos.length
  const x = (i: number) => MARGEN.izquierda + banda * (i + 0.5)
  const y = (v: number) => MARGEN.arriba + (1 - (v - piso) / (techo - piso)) * alto
  const marcas = Array.from({ length: 5 }, (_, i) => piso + ((techo - piso) / 4) * i)
  const cadaCuanto = Math.ceil(puntos.length / 10)
  const punto = activo !== null ? puntos[activo] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full h-auto" role="img"
        aria-label={`Temperatura diaria de ${puntos.length} días; ${puntos.filter((p) => p.alarmas > 0).length} días con alarmas`}
        onPointerLeave={() => setActivo(null)}>
        {minimo !== undefined && maximo !== undefined && (
          <rect x={MARGEN.izquierda} y={y(maximo)} width={ancho} height={Math.max(0, y(minimo) - y(maximo))} fill="#10b981" opacity={0.1} />
        )}
        {marcas.map((v) => (
          <g key={v}>
            <line x1={MARGEN.izquierda} x2={ANCHO - MARGEN.derecha} y1={y(v)} y2={y(v)} stroke="#e4e4e7" strokeWidth={1} />
            <text x={MARGEN.izquierda - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="#71717a">{Math.round(v)}°</text>
          </g>
        ))}
        {puntos.map((p, i) => {
          const color = p.alarmas > 0 ? COLOR_ALARMA : COLOR
          const elegido = p.dia === seleccionado
          return (
            <g key={p.dia} onPointerEnter={() => setActivo(i)} onClick={() => onSeleccionar(p.dia)} className="cursor-pointer">
              <rect x={MARGEN.izquierda + banda * i} y={MARGEN.arriba} width={banda} height={alto} fill={elegido ? '#f4f4f5' : activo === i ? '#fafafa' : 'transparent'} />
              <line x1={x(i)} x2={x(i)} y1={y(p.maximo)} y2={y(p.minimo)} stroke={color} strokeWidth={Math.min(8, Math.max(3, banda * 0.35))} strokeLinecap="round" opacity={0.35} />
              <circle cx={x(i)} cy={y(p.promedio)} r={4} fill={color} stroke="#fff" strokeWidth={1.5} />
              {i % cadaCuanto === 0 && <text x={x(i)} y={ALTO - 8} fontSize={10} fill="#71717a" textAnchor="middle">{etiquetaDia(p.dia)}</text>}
            </g>
          )
        })}
      </svg>
      {punto && activo !== null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${(x(activo) / ANCHO) * 100}%`, transform: `translateX(${activo > puntos.length / 2 ? 'calc(-100% - 10px)' : '10px'})` }}>
          <p className="font-semibold">{etiquetaDia(punto.dia)}</p>
          <p>Promedio {punto.promedio} °C</p>
          <p className="text-zinc-300">Mín {punto.minimo} · Máx {punto.maximo} °C</p>
          {punto.alarmas > 0 && <p className="text-red-300">{punto.alarmas} alarma(s)</p>}
          <p className="mt-1 text-zinc-400">Clic para ver el día completo</p>
        </div>
      )}
    </div>
  )
}
