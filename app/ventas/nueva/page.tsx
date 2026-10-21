import { Suspense } from 'react'

import NuevaVenta from '@/components/ventas/nueva-venta'

// La vista lee parámetros de la URL, por eso se envuelve en Suspense
export default function NuevaVentaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-stone-400">Cargando...</p>}>
      <NuevaVenta />
    </Suspense>
  )
}
