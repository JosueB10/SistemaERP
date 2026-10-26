import { Suspense } from 'react'

import MateriasPrimasVista from '@/components/inventario/materias-primas-vista'

// La vista lee parámetros de la URL, por eso se envuelve en Suspense
export default function MateriasPrimasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Cargando...</p>}>
      <MateriasPrimasVista />
    </Suspense>
  )
}
