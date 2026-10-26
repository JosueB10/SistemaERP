import { Suspense } from 'react'

import OrdenesVista from '@/components/produccion/ordenes-vista'

// La vista lee ?detalle= de la URL, por eso se envuelve en Suspense
export default function ProduccionPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Cargando...</p>}>
      <OrdenesVista />
    </Suspense>
  )
}
