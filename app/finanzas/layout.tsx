import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Finanzas | NeumoPad ERP'
}

export default function FinanzasLayout({ children }: LayoutProps<'/finanzas'>) {
  return <MarcoApp>{children}</MarcoApp>
}
