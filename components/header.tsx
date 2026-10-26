'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  LogOut,
  Menu,
  UserRound
} from 'lucide-react'

import { cerrarSesion, useUsuario } from '@/lib/cuenta/sesion'
import Campana from './notificaciones/campana'

const formatoHoy = new Intl.DateTimeFormat('es-NI', { weekday: 'long', day: 'numeric', month: 'long' })

export default function Header({ onAbrirMenu }: { onAbrirMenu: () => void }) {
  return (
    <header className="h-16 shrink-0 bg-white/80 backdrop-blur border-b border-zinc-200/80 flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 print:hidden">

      {/* LEFT */}

      <div className="flex items-center gap-3 min-w-0">

        <button type="button" onClick={onAbrirMenu} className="-ml-1.5 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 lg:hidden" aria-label="Abrir menú">
          <Menu size={20} />
        </button>

        <p className="hidden text-sm text-zinc-500 first-letter:uppercase sm:block">
          {formatoHoy.format(new Date())}
        </p>

      </div>

      {/* RIGHT */}

      <div className="flex items-center gap-2 sm:gap-3">

        <Campana />

        <div className="h-6 w-px bg-zinc-200" />

        <MenuUsuario />

      </div>

    </header>
  )
}

function MenuUsuario() {
  const usuario = useUsuario()
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const alClic = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false)
    }
    const alTecla = (evento: KeyboardEvent) => { if (evento.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', alClic)
    document.addEventListener('keydown', alTecla)
    return () => {
      document.removeEventListener('mousedown', alClic)
      document.removeEventListener('keydown', alTecla)
    }
  }, [abierto])

  return (
    <div ref={contenedor} className="relative">

      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 hover:bg-zinc-100 transition">

        <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-semibold">
          {usuario?.iniciales ?? '…'}
        </div>

        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium leading-tight text-zinc-900 max-w-40 truncate">
            {usuario?.nombre ?? 'Cargando…'}
          </p>

          <p className="text-xs leading-tight text-zinc-500">
            {usuario?.cargo ?? ''}
          </p>
        </div>

        <ChevronDown size={14} className={`hidden text-zinc-400 transition-transform sm:block ${abierto ? 'rotate-180' : ''}`} />

      </button>

      {abierto && usuario && (
        <div className="animate-aparecer absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-1 shadow-lg shadow-zinc-900/5">
          <div className="px-3 py-2.5">
            <p className="text-sm font-medium text-zinc-900 truncate">{usuario.nombre}</p>
            <p className="text-xs text-zinc-500 truncate">{usuario.correo}</p>
          </div>
          <div className="my-1 h-px bg-zinc-100" />
          <Link href="/cuenta" onClick={() => setAbierto(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100">
            <UserRound size={16} className="text-zinc-400" />
            Mi cuenta
          </Link>
          <button type="button" onClick={cerrarSesion} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      )}

    </div>
  )
}
