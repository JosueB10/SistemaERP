import type { Metadata } from 'next'

import MarcoApp from '@/components/marco-app'

export const metadata: Metadata = {
  title: 'Notificaciones | NeumoPad ERP'
}

export default function NotificacionesLayout({ children }: LayoutProps<'/notificaciones'>) {
  return <MarcoApp>{children}</MarcoApp>
}
