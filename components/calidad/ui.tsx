'use client'

import type { EstadoLote, EstadoNc, SeveridadNc } from '@/lib/calidad/tipos'
import { useErrorCalidad } from '@/lib/calidad/store'
import { ETIQUETAS_ESTADO_LOTE, ETIQUETAS_ESTADO_NC, ETIQUETAS_SEVERIDAD } from '@/lib/calidad/utilidades'

export const SECCION_CALIDAD = { etiqueta: 'Calidad', href: '/calidad/lotes' }

export function AvisoConexionCalidad() {
  const error = useErrorCalidad()
  if (!error) return null
  return <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Revisa la conexión de Supabase y que hayas aplicado la migración SQL de lotes y calidad.</div>
}

const base = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap'

const estilosLote: Record<EstadoLote, string> = {
  en_inspeccion: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  aprobado: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  aprobado_parcial: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  rechazado: 'bg-red-50 text-red-700 ring-red-600/20'
}

export function InsigniaLote({ estado }: { estado: EstadoLote }) {
  return <span className={`${base} ${estilosLote[estado]}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{ETIQUETAS_ESTADO_LOTE[estado]}</span>
}

const estilosNc: Record<EstadoNc, string> = {
  abierta: 'bg-red-50 text-red-700 ring-red-600/20',
  en_analisis: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  cerrada: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
}

export function InsigniaNc({ estado }: { estado: EstadoNc }) {
  return <span className={`${base} ${estilosNc[estado]}`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{ETIQUETAS_ESTADO_NC[estado]}</span>
}

const estilosSeveridad: Record<SeveridadNc, string> = {
  menor: 'bg-zinc-100 text-zinc-600',
  mayor: 'bg-amber-50 text-amber-700',
  critica: 'bg-red-50 text-red-700'
}

export function InsigniaSeveridad({ severidad }: { severidad: SeveridadNc }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${estilosSeveridad[severidad]}`}>{ETIQUETAS_SEVERIDAD[severidad]}</span>
}
