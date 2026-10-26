import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Ventas | NeumoPad ERP'
}

export default function VentasLayout({ children }: LayoutProps<'/ventas'>) {
  return <MarcoApp>{children}</MarcoApp>
}
