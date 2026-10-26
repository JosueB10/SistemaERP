import { Suspense } from 'react'

import ProductosVista from '@/components/inventario/productos-vista'

// La vista lee parámetros de la URL, por eso se envuelve en Suspense
export default function ProductosPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Cargando...</p>}>
      <ProductosVista />
    </Suspense>
  )
}
