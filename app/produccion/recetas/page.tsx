import { Suspense } from 'react'

import RecetasVista from '@/components/produccion/recetas-vista'

// La vista lee parámetros de la URL, por eso se envuelve en Suspense
export default function RecetasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Cargando...</p>}>
      <RecetasVista />
    </Suspense>
  )
}
