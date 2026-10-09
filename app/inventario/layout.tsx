import type { Metadata } from 'next'

import Header from '@/components/header'
import Sidebar from '@/components/sidebar'

export const metadata: Metadata = {
  title: 'Inventario | NeumoPad ERP'
}

export default function InventarioLayout({ children }: LayoutProps<'/inventario'>) {
  return (
    <div className="min-h-screen bg-[#f5f3f0] flex">

      <Sidebar />

      <div className="flex-1 min-w-0">

        <Header />

        <main className="p-4 sm:p-6 lg:p-8">
          {children}
        </main>

      </div>

    </div>
  )
}
