'use client'

import { useState } from 'react'
import { XCircle } from 'lucide-react'

import { formatoCordobas } from '@/lib/inventario/utilidades'
import { useErrorVentas } from '@/lib/ventas/store'
import { TASA_IVA } from '@/lib/ventas/utilidades'
import { claseBotonSecundario, claseInput } from '../inventario/ui'

export const SECCION_VENTAS = { etiqueta: 'Ventas', href: '/ventas' }

export function AvisoConexionVentas() {
  const error = useErrorVentas()
  if (!error) return null
  return <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Revisa la conexión de Supabase y que hayas aplicado la migración SQL de ventas y compras.</div>
}

// Insignia para documentos completados/anulados (ventas y compras) y ventas pendientes de producción
export function InsigniaDocumento({ anulado, texto, pendiente = false }: { anulado: boolean; texto: string; pendiente?: boolean }) {
  const estilo = anulado
    ? 'bg-stone-100 text-stone-500 ring-stone-500/20'
    : pendiente
      ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
      : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${estilo}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {texto}
    </span>
  )
}

export function ResumenTotales({
  subtotal,
  descuento,
  impuesto,
  total,
  extra
}: {
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  extra?: React.ReactNode
}) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex justify-between gap-3">
        <dt className="text-stone-500">Subtotal</dt>
        <dd className="text-stone-900">{formatoCordobas(subtotal)}</dd>
      </div>
      {descuento > 0 && (
        <div className="flex justify-between gap-3">
          <dt className="text-stone-500">Descuento</dt>
          <dd className="text-stone-900">-{formatoCordobas(descuento)}</dd>
        </div>
      )}
      <div className="flex justify-between gap-3">
        <dt className="text-stone-500">IVA ({TASA_IVA * 100} %)</dt>
        <dd className="text-stone-900">{formatoCordobas(impuesto)}</dd>
      </div>
      <div className="flex justify-between gap-3 border-t border-stone-200 pt-2">
        <dt className="font-semibold text-stone-900">Total</dt>
        <dd className="text-lg font-bold text-stone-900">{formatoCordobas(total)}</dd>
      </div>
      {extra}
    </dl>
  )
}

// Confirmación con motivo antes de anular una venta o compra
export function ConfirmarAnulacion({
  aviso,
  textoBoton,
  onConfirmar
}: {
  aviso: string
  textoBoton: string
  onConfirmar: (motivo: string) => Promise<void>
}) {
  const [abierto, setAbierto] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={claseBotonSecundario}>
        <XCircle size={15} />
        Anular
      </button>
    )
  }

  return (
    <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
      <p className="text-sm text-red-800">{aviso}</p>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" className={claseInput} aria-label="Motivo de anulación" />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setAbierto(false)} className={claseBotonSecundario}>Volver</button>
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true)
            await onConfirmar(motivo)
            setOcupado(false)
          }}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
        >
          {ocupado ? 'Anulando...' : textoBoton}
        </button>
      </div>
    </div>
  )
}
