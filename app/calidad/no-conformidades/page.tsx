import { Suspense } from 'react'

import NoConformidadesVista from '@/components/calidad/no-conformidades-vista'

// La vista lee ?detalle= de la URL, por eso se envuelve en Suspense
export default function NoConformidadesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Cargando...</p>}>
      <NoConformidadesVista />
    </Suspense>
  )
}
