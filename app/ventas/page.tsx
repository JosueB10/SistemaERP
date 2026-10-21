import { Suspense } from 'react'

import VentasVista from '@/components/ventas/ventas-vista'

// La vista lee parámetros de la URL, por eso se envuelve en Suspense
export default function VentasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Cargando...</p>}>
      <VentasVista />
    </Suspense>
  )
}
