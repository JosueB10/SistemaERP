import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Dashboard | NeumoPad ERP'
}

export default function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  return <MarcoApp>{children}</MarcoApp>
}
