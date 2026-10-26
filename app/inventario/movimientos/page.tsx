import { Suspense } from 'react'

import MovimientosVista from '@/components/inventario/movimientos-vista'

// La vista lee parámetros de la URL, por eso se envuelve en Suspense
export default function MovimientosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Cargando...</p>}>
      <MovimientosVista />
    </Suspense>
  )
}
