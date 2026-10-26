import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Recursos Humanos | NeumoPad ERP'
}

export default function RecursosHumanosLayout({ children }: LayoutProps<'/recursos-humanos'>) {
  return <MarcoApp>{children}</MarcoApp>
}
