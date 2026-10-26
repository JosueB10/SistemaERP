'use client'

import { useState } from 'react'

import GuardiaSesion from './guardia-sesion'
import Header from './header'
import Sidebar from './sidebar'

// Estructura común de las páginas privadas: valida la sesión, menú lateral y encabezado.
// El menú y el contenido tienen cada uno su propio scroll; la ventana no se desplaza.
export default function MarcoApp({ children, claseMain = '' }: { children: React.ReactNode; claseMain?: string }) {
  const [menuMovil, setMenuMovil] = useState(false)

  return (
    <GuardiaSesion>
      <div className="h-dvh flex overflow-hidden bg-background print:block print:h-auto print:overflow-visible print:bg-white">

        <Sidebar abiertoMovil={menuMovil} onCerrarMovil={() => setMenuMovil(false)} />

        <div className="flex-1 min-w-0 flex flex-col print:block">

          <Header onAbrirMenu={() => setMenuMovil(true)} />

          <main className="flex-1 overflow-y-auto overscroll-contain print:overflow-visible">
            <div className={`mx-auto w-full max-w-[1400px] p-4 sm:p-6 lg:p-8 ${claseMain}`}>
              {children}
            </div>
          </main>

        </div>

      </div>
    </GuardiaSesion>
  )
}
