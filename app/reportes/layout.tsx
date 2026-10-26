import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Reportes | NeumoPad ERP'
}

export default function ReportesLayout({ children }: LayoutProps<'/reportes'>) {
  return <MarcoApp claseMain="print:p-0">{children}</MarcoApp>
}
