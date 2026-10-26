import GuardiaSesion from './guardia-sesion'
import Header from './header'
import Sidebar from './sidebar'

// Estructura común de las páginas privadas: valida la sesión, menú lateral y encabezado
export default function MarcoApp({ children, claseMain = '' }: { children: React.ReactNode; claseMain?: string }) {
  return (
    <GuardiaSesion>
      <div className="min-h-screen bg-[#f5f3f0] flex print:bg-white">

        <Sidebar />

        <div className="flex-1 min-w-0">

          <Header />

          <main className={`p-4 sm:p-6 lg:p-8 ${claseMain}`}>
            {children}
          </main>

        </div>

      </div>
    </GuardiaSesion>
  )
}
