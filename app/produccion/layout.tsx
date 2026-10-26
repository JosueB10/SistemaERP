import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Producción | NeumoPad ERP'
}

export default function ProduccionLayout({ children }: LayoutProps<'/produccion'>) {
  return <MarcoApp>{children}</MarcoApp>
}
