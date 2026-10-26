'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, RefreshCw } from 'lucide-react'

import { marcarLeidas, recargarActividad, useNotificaciones, type Notificacion } from '@/lib/actividad/store'
import { IconoNotificacion, OrigenNotificacion } from './ui'

// Campana del encabezado: cuenta lo no leído y lleva al documento que originó cada aviso
export default function Campana() {
  const router = useRouter()
  const { notificaciones, sinLeer } = useNotificaciones()
  const [abierta, setAbierta] = useState(false)
  const [actualizando, setActualizando] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierta) return
    const alClic = (evento: MouseEvent) => {
      if (!panel.current?.contains(evento.target as Node)) setAbierta(false)
    }
    const alTecla = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setAbierta(false) }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierta])

  const actualizar = async () => {
    setActualizando(true)
    await recargarActividad()
    setActualizando(false)
  }

  const alternar = () => {
    if (!abierta) actualizar()
    setAbierta(!abierta)
  }

  const abrir = (n: Notificacion) => {
    marcarLeidas([n.clave])
    setAbierta(false)
    router.push(n.href)
  }

  // Primero lo no leído; se muestran las 8 más recientes
  const visibles = [...notificaciones].sort((a, b) => Number(a.leida) - Number(b.leida)).slice(0, 8)

  return (
    <div ref={panel} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-label={sinLeer ? `Notificaciones: ${sinLeer} sin leer` : 'Notificaciones'}
        aria-expanded={abierta}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
      >
        <Bell size={20} />
        {sinLeer > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 ring-2 ring-white text-center text-[10px] font-semibold leading-[18px] text-white">
            {sinLeer > 99 ? '99+' : sinLeer}
          </span>
        )}
      </button>

      {abierta && (
        <div className="animate-aparecer absolute right-0 top-12 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-lg shadow-zinc-900/5">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Notificaciones</p>
              <p className="text-xs text-zinc-500">{sinLeer ? `${sinLeer} sin leer` : 'Todo al día'}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={actualizar} disabled={actualizando} title="Actualizar" aria-label="Actualizar" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50">
                <RefreshCw size={15} className={actualizando ? 'animate-spin' : undefined} />
              </button>
              {sinLeer > 0 && (
                <button type="button" onClick={() => marcarLeidas(notificaciones.map((n) => n.clave))} title="Marcar todas como leídas" aria-label="Marcar todas como leídas" className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800">
                  <CheckCheck size={15} />
                </button>
              )}
            </div>
          </div>

          {visibles.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-zinc-400">No hay notificaciones.</p>
          ) : (
            <ul className="max-h-[26rem] divide-y divide-zinc-100 overflow-y-auto overscroll-contain">
              {visibles.map((n) => (
                <li key={n.clave}>
                  <button type="button" onClick={() => abrir(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-zinc-50 ${n.leida ? '' : 'bg-zinc-50'}`}>
                    <IconoNotificacion notificacion={n} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.leida ? 'text-zinc-600' : 'font-medium text-zinc-900'}`}>{n.titulo}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{n.detalle}</p>
                      <OrigenNotificacion notificacion={n} />
                    </div>
                    {!n.leida && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-zinc-900" aria-label="Sin leer" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link href="/notificaciones" onClick={() => setAbierta(false)} className="block border-t border-zinc-100 px-4 py-2.5 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  )
}
