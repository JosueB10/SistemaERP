import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Compras | NeumoPad ERP'
}

export default function ComprasLayout({ children }: LayoutProps<'/compras'>) {
  return <MarcoApp>{children}</MarcoApp>
}
