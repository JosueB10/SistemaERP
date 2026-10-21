import type { Metadata } from 'next'

import Header from '@/components/header'
import Sidebar from '@/components/sidebar'

export const metadata: Metadata = {
  title: 'Compras | NeumoPad ERP'
}

export default function ComprasLayout({ children }: LayoutProps<'/compras'>) {
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
