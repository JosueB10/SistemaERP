import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Mi cuenta | NeumoPad ERP'
}

export default function CuentaLayout({ children }: LayoutProps<'/cuenta'>) {
  return <MarcoApp>{children}</MarcoApp>
}
