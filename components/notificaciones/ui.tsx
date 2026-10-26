'use client'

import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  CheckCircle2,
  Clock,
  Factory,
  ShoppingCart,
  Truck,
  Users,
  Wallet
} from 'lucide-react'

import type { TipoEvento } from '@/lib/actividad/eventos'
import { ETIQUETAS_MODULO } from '@/lib/actividad/eventos'
import type { Notificacion } from '@/lib/actividad/store'
import { formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'

const ICONOS_EVENTO: Record<TipoEvento, React.ElementType> = {
  venta: ShoppingCart,
  venta_pendiente: Clock,
  venta_completada: CheckCircle2,
  venta_anulada: Ban,
  compra: Truck,
  compra_anulada: Ban,
  orden_creada: Factory,
  orden_completada: CheckCircle2,
  orden_cancelada: Ban,
  movimiento: ArrowLeftRight,
  ingreso: Wallet,
  gasto: Wallet,
  nomina: Users
}

export function IconoNotificacion({ notificacion }: { notificacion: Notificacion }) {
  if (notificacion.clase === 'alerta') {
    const Icono = notificacion.nivel === 'peligro' ? AlertOctagon : AlertTriangle
    return (
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${notificacion.nivel === 'peligro' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
        <Icono size={17} />
      </span>
    )
  }
  const Icono = ICONOS_EVENTO[notificacion.tipo]
  const anulado = notificacion.tipo === 'venta_anulada' || notificacion.tipo === 'compra_anulada' || notificacion.tipo === 'orden_cancelada'
  const positivo = notificacion.tipo === 'orden_completada' || notificacion.tipo === 'venta' || notificacion.tipo === 'venta_completada'
  return (
    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${anulado ? 'bg-stone-100 text-stone-400' : positivo ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-600'}`}>
      <Icono size={17} />
    </span>
  )
}

// Hace cuánto ocurrió, en palabras
export function haceCuanto(ms: number) {
  const minutos = Math.round((Date.now() - ms) / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  if (dias < 7) return `hace ${dias} día${dias === 1 ? '' : 's'}`
  return formatoFecha(new Date(ms).toISOString())
}

// Línea "Ventas · VTA-00012 · hace 2 h" que dice de dónde salió la notificación
export function OrigenNotificacion({ notificacion }: { notificacion: Notificacion }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-stone-400">
      <span className="rounded bg-stone-100 px-1.5 py-0.5 font-medium text-stone-600">{ETIQUETAS_MODULO[notificacion.modulo]}</span>
      <span className="font-mono">{notificacion.documento}</span>
      <span>·</span>
      <span>{notificacion.clase === 'alerta' ? 'Vigente' : haceCuanto(notificacion.momento)}</span>
      {notificacion.clase === 'evento' && notificacion.monto !== undefined && (
        <>
          <span>·</span>
          <span className="text-stone-500">{formatoCordobas(notificacion.monto)}</span>
        </>
      )}
    </p>
  )
}
