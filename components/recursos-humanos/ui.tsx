'use client'

import type { EstadoAsistencia, EstadoEmpleado, EstadoNomina } from '@/lib/recursos-humanos/tipos'
import {
  ETIQUETAS_ASISTENCIA,
  ETIQUETAS_ESTADO_EMPLEADO,
  ETIQUETAS_ESTADO_NOMINA
} from '@/lib/recursos-humanos/utilidades'
import { useErrorRecursosHumanos } from '@/lib/recursos-humanos/store'

export const SECCION_RRHH = { etiqueta: 'Recursos Humanos', href: '/recursos-humanos' }

export function AvisoConexionRrhh() {
  const error = useErrorRecursosHumanos()
  if (!error) return null
  return <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Revisa la conexión de Supabase y que hayas aplicado la migración SQL de recursos humanos.</div>
}

function Insignia({ estilo, texto }: { estilo: string; texto: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${estilo}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {texto}
    </span>
  )
}

const estilosEmpleado: Record<EstadoEmpleado, string> = {
  activo: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  vacaciones: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  suspendido: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  inactivo: 'bg-zinc-100 text-zinc-500 ring-zinc-500/20'
}

export function InsigniaEmpleado({ estado }: { estado: EstadoEmpleado }) {
  return <Insignia estilo={estilosEmpleado[estado]} texto={ETIQUETAS_ESTADO_EMPLEADO[estado]} />
}

const estilosAsistencia: Record<EstadoAsistencia, string> = {
  presente: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  tardanza: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  ausente: 'bg-red-50 text-red-700 ring-red-600/20',
  permiso: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  vacaciones: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  subsidio: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20'
}

export function InsigniaAsistencia({ estado }: { estado: EstadoAsistencia }) {
  return <Insignia estilo={estilosAsistencia[estado]} texto={ETIQUETAS_ASISTENCIA[estado]} />
}

const estilosNomina: Record<EstadoNomina, string> = {
  borrador: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  pagada: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
}

export function InsigniaNomina({ estado }: { estado: EstadoNomina }) {
  return <Insignia estilo={estilosNomina[estado]} texto={ETIQUETAS_ESTADO_NOMINA[estado]} />
}

export function DatoDetalle({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{etiqueta}</dt>
      <dd className="text-sm text-zinc-900 mt-0.5">{valor || <span className="text-zinc-400">—</span>}</dd>
    </div>
  )
}
