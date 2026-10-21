'use client'

import { CheckCircle2, Factory, Package, Wallet } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { formatoCantidad, formatoCordobas } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { enRango } from '@/lib/finanzas/utilidades'
import { produccionPorProducto, type Periodo } from '@/lib/reportes/calculos'
import { TarjetaIndicador } from '../inventario/ui'
import { TablaReporte } from './ui'

export default function ReporteProduccion({ periodo, archivo }: { periodo: Periodo; archivo: string }) {
  const { productos } = useInventario()
  const { ordenes } = useProduccion()

  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const porProducto = produccionPorProducto(ordenes, periodo)
  const unidades = porProducto.reduce((t, f) => t + f.unidades, 0)
  const costo = porProducto.reduce((t, f) => t + f.costo, 0)
  const cantidadOrdenes = porProducto.reduce((t, f) => t + f.ordenes, 0)
  const canceladas = ordenes.filter((o) => o.estado === 'cancelada' && o.fechaFin && enRango(o.fechaFin, periodo.desde, periodo.hasta)).length
  const abiertas = ordenes.filter((o) => o.estado === 'pendiente' || o.estado === 'en_proceso').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador titulo="Órdenes completadas" valor={String(cantidadOrdenes)} detalle={`${canceladas} cancelada(s) en el período`} icono={CheckCircle2} tono="positivo" />
        <TarjetaIndicador titulo="Unidades producidas" valor={`${formatoCantidad(unidades)} und`} detalle={`${porProducto.length} producto(s)`} icono={Package} />
        <TarjetaIndicador titulo="Materia prima consumida" valor={formatoCordobas(costo)} detalle={unidades ? `${formatoCordobas(costo / unidades)} por unidad en promedio` : 'Sin producción'} icono={Wallet} />
        <TarjetaIndicador titulo="Órdenes abiertas hoy" valor={String(abiertas)} detalle="Pendientes o en proceso" icono={Factory} tono={abiertas ? 'alerta' : 'neutro'} />
      </div>

      <TablaReporte
        titulo="Producción por producto"
        descripcion="Órdenes completadas en el período según su fecha de finalización. No incluye lo fabricado al momento de vender."
        archivo={`${archivo}-por-producto`}
        columnas={[
          { etiqueta: 'Producto' },
          { etiqueta: 'SKU' },
          { etiqueta: 'Órdenes', formato: 'cantidad' },
          { etiqueta: 'Unidades', formato: 'cantidad' },
          { etiqueta: 'Costo materia prima', formato: 'cordobas' },
          { etiqueta: 'Costo por unidad', formato: 'cordobas' },
          { etiqueta: 'Costo de ficha', formato: 'cordobas' }
        ]}
        filas={porProducto.map((f) => {
          const producto = productoPorId.get(f.productoId)
          return [producto?.nombre ?? 'Producto inactivo', producto?.sku ?? '—', f.ordenes, f.unidades, f.costo, f.costoUnitario, producto?.costoProduccion ?? 0]
        })}
        totales={['Total', '', cantidadOrdenes, unidades, costo, unidades ? costo / unidades : 0, '']}
      />
    </div>
  )
}
