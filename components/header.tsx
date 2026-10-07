'use client'

import {
  Bell,
  Search
} from 'lucide-react'

export default function Header() {
  return (
    <header className="h-20 bg-white border-b border-stone-200 flex items-center justify-between px-8">

      {/* SEARCH */}

      <div className="relative w-80">

        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
        />

        <input
          type="text"
          placeholder="Buscar..."
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-stone-100 border border-transparent outline-none text-sm focus:bg-white focus:border-stone-300 transition"
        />

      </div>

      {/* RIGHT */}

      <div className="flex items-center gap-5">

        <button className="relative text-stone-500 hover:text-stone-800">
          <Bell size={20} />

          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        <div className="h-7 w-px bg-stone-200" />

        <div className="flex items-center gap-3">

          <div className="w-9 h-9 rounded-full bg-stone-800 text-white flex items-center justify-center text-sm font-semibold">
            A
          </div>

          <div>
            <p className="text-sm font-medium text-stone-800">
              Administrador
            </p>

            <p className="text-xs text-stone-400">
              Administrador
            </p>
          </div>

        </div>

      </div>

    </header>
  )
}