import { Suspense } from 'react'

import NuevaCompra from '@/components/compras/nueva-compra'

// La vista lee parámetros de la URL, por eso se envuelve en Suspense
export default function NuevaCompraPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Cargando...</p>}>
      <NuevaCompra />
    </Suspense>
  )
}
