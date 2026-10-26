'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  LogOut,
  Search,
  UserRound
} from 'lucide-react'

import { cerrarSesion, useUsuario } from '@/lib/cuenta/sesion'
import { normalizarTexto } from '@/lib/inventario/utilidades'
import Campana from './notificaciones/campana'
import { PAGINAS } from './sidebar'

export default function Header() {
  return (
    <header className="h-20 bg-white border-b border-stone-200 flex items-center justify-between gap-4 px-4 sm:px-8 print:hidden">

      {/* SEARCH */}

      <BuscadorPaginas />

      {/* RIGHT */}

      <div className="flex items-center gap-3 sm:gap-5">

        <Campana />

        <div className="h-7 w-px bg-stone-200" />

        <MenuUsuario />

      </div>

    </header>
  )
}

// Busca entre las secciones del ERP y salta a la elegida
function BuscadorPaginas() {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [abierto, setAbierto] = useState(false)
  const consulta = normalizarTexto(texto)
  const resultados = consulta
    ? PAGINAS.filter((p) => normalizarTexto(`${p.seccion} ${p.label}`).includes(consulta)).slice(0, 8)
    : []

  const ir = (href: string) => {
    setTexto('')
    setAbierto(false)
    router.push(href)
  }

  return (
    <div className="relative w-full max-w-80">

      <Search
        size={18}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
      />

      <input
        type="search"
        value={texto}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && resultados[0]) ir(resultados[0].href) }}
        placeholder="Ir a… (ventas, compras, stock bajo)"
        aria-label="Buscar sección"
        className="w-full h-10 pl-10 pr-4 rounded-lg bg-stone-100 border border-transparent outline-none text-sm focus:bg-white focus:border-stone-300 transition"
      />

      {abierto && consulta && (
        <ul className="absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          {resultados.length === 0 ? (
            <li className="px-4 py-2.5 text-sm text-stone-400">Sin resultados</li>
          ) : resultados.map((p) => (
            <li key={p.href}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => ir(p.href)} className="flex w-full items-center justify-between gap-3 px-4 py-2 text-left text-sm hover:bg-stone-50">
                <span className="text-stone-800">{p.label}</span>
                <span className="text-xs text-stone-400">{p.seccion}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

    </div>
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
    document.addEventListener('mousedown', alClic)
    return () => document.removeEventListener('mousedown', alClic)
  }, [abierto])

  return (
    <div ref={contenedor} className="relative">

      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-stone-100">

        <div className="w-9 h-9 rounded-full bg-stone-800 text-white flex items-center justify-center text-sm font-semibold">
          {usuario?.iniciales ?? '…'}
        </div>

        <div className="hidden text-left sm:block">
          <p className="text-sm font-medium text-stone-800 max-w-40 truncate">
            {usuario?.nombre ?? 'Cargando…'}
          </p>

          <p className="text-xs text-stone-400">
            {usuario?.cargo ?? ''}
          </p>
        </div>

        <ChevronDown size={15} className="hidden text-stone-400 sm:block" />

      </button>

      {abierto && usuario && (
        <div className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          <div className="border-b border-stone-100 px-4 py-3">
            <p className="text-sm font-medium text-stone-900 truncate">{usuario.nombre}</p>
            <p className="text-xs text-stone-500 truncate">{usuario.correo}</p>
          </div>
          <Link href="/cuenta" onClick={() => setAbierto(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50">
            <UserRound size={16} />
            Mi cuenta
          </Link>
          <button type="button" onClick={cerrarSesion} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      )}

    </div>
  )
}
