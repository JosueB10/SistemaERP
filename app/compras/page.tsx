import { Suspense } from 'react'

import ComprasVista from '@/components/compras/compras-vista'

// La vista lee parámetros de la URL, por eso se envuelve en Suspense
export default function ComprasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Cargando...</p>}>
      <ComprasVista />
    </Suspense>
  )
}
