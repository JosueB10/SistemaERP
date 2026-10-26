import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Inventario | NeumoPad ERP'
}

export default function InventarioLayout({ children }: LayoutProps<'/inventario'>) {
  return <MarcoApp>{children}</MarcoApp>
}
