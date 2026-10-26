'use client'

import { useState } from 'react'

// Colores de serie validados para daltonismo sobre fondo blanco (azul y naranja)
export const COLOR_SERIE = { primaria: '#2a78d6', secundaria: '#eb6834' }

export interface SerieGrafico {
  nombre: string
  color: string
  valores: number[]
}

function pasoRedondo(maximo: number) {
  if (maximo <= 0) return 1
  const bruto = maximo / 4
  const magnitud = 10 ** Math.floor(Math.log10(bruto))
  const normal = bruto / magnitud
  return (normal <= 1 ? 1 : normal <= 2 ? 2 : normal <= 2.5 ? 2.5 : normal <= 5 ? 5 : 10) * magnitud
}

export function formatoCompacto(valor: number) {
  const abs = Math.abs(valor)
  const signo = valor < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${signo}${Number((abs / 1_000_000).toFixed(1))}M`
  if (abs >= 1_000) return `${signo}${Number((abs / 1_000).toFixed(1))}K`
  return `${signo}${Math.round(abs)}`
}

// Columnas agrupadas por categoría (p. ej. meses) con un solo eje y tooltip por grupo
export default function GraficoColumnas({
  categorias,
  series,
  formato,
  descripcion,
  alto = 220
}: {
  categorias: string[]
  series: SerieGrafico[]
  formato: (valor: number) => string
  descripcion: string
  alto?: number
}) {
  const [activo, setActivo] = useState<number | null>(null)
  const maximo = Math.max(0, ...series.flatMap((s) => s.valores))
  const paso = pasoRedondo(maximo)
  const tope = Math.max(paso, Math.ceil(maximo / paso) * paso)
  const marcas = Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso).reverse()

  return (
    <figure className="w-full" aria-label={descripcion}>
      {series.length > 1 && (
        <figcaption className="mb-3 flex flex-wrap gap-4 text-xs text-zinc-600">
          {series.map((s) => (
            <span key={s.nombre} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.nombre}
            </span>
          ))}
        </figcaption>
      )}

      <div className="flex gap-2">
        {/* Eje Y */}
        <div className="relative w-12 shrink-0 text-right text-[11px] text-zinc-400" style={{ height: alto }}>
          {marcas.map((marca) => (
            <span key={marca} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - marca / tope) * 100}%` }}>
              {formatoCompacto(marca)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: alto }}>
            {marcas.map((marca) => (
              <div key={marca} className="absolute inset-x-0 border-t border-zinc-100" style={{ top: `${(1 - marca / tope) * 100}%` }} />
            ))}

            <div className="absolute inset-0 flex">
              {categorias.map((categoria, i) => (
                <div
                  key={categoria}
                  tabIndex={0}
                  role="button"
                  aria-label={`${categoria}: ${series.map((s) => `${s.nombre} ${formato(s.valores[i] ?? 0)}`).join(', ')}`}
                  onMouseEnter={() => setActivo(i)}
                  onMouseLeave={() => setActivo(null)}
                  onFocus={() => setActivo(i)}
                  onBlur={() => setActivo(null)}
                  className={`relative flex flex-1 items-end justify-center gap-[2px] px-1 outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 transition-colors ${activo === i ? 'bg-zinc-100/70' : ''}`}
                >
                  {series.map((s) => {
                    const valor = Math.max(0, s.valores[i] ?? 0)
                    return (
                      <div
                        key={s.nombre}
                        className="w-full max-w-[24px] rounded-t-[4px]"
                        style={{ height: `${(valor / tope) * 100}%`, backgroundColor: s.color, minHeight: valor > 0 ? 2 : 0 }}
                      />
                    )
                  })}

                  {activo === i && (
                    <div
                      role="tooltip"
                      className={`pointer-events-none absolute bottom-full z-10 mb-2 w-max min-w-40 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg ${
                        i < categorias.length / 2 ? 'left-0' : 'right-0'
                      }`}
                    >
                      <p className="mb-1 font-semibold text-zinc-900">{categoria}</p>
                      {series.map((s) => (
                        <p key={s.nombre} className="flex items-center justify-between gap-4 text-zinc-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                            {s.nombre}
                          </span>
                          <span className="font-medium text-zinc-900">{formato(s.valores[i] ?? 0)}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Eje X */}
          <div className="mt-2 flex">
            {categorias.map((categoria) => (
              <span key={categoria} className="flex-1 truncate text-center text-[11px] text-zinc-500">{categoria}</span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
