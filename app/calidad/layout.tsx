import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Calidad | NeumoPad ERP'
}

export default function CalidadLayout({ children }: LayoutProps<'/calidad'>) {
  return <MarcoApp>{children}</MarcoApp>
}
