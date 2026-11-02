import { Suspense } from 'react'

import LotesVista from '@/components/calidad/lotes-vista'

// La vista lee ?detalle= de la URL, por eso se envuelve en Suspense
export default function LotesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Cargando...</p>}>
      <LotesVista />
    </Suspense>
  )
}
