'use client'

import { AlertTriangle, Layers, Package, Tag } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, formatoCordobas, tieneStockBajo } from '@/lib/inventario/utilidades'
import { inventarioValorizado } from '@/lib/reportes/calculos'
import { TarjetaIndicador } from '../inventario/ui'
import { TablaReporte } from './ui'

// Foto del inventario actual; no depende del período
export default function ReporteInventario({ archivo }: { archivo: string }) {
  const { productos, materiasPrimas } = useInventario()
  const inv = inventarioValorizado(productos, materiasPrimas)
  const bajos = [...productos, ...materiasPrimas].filter(tieneStockBajo).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador titulo="Valor total al costo" valor={formatoCordobas(inv.totalProductos + inv.totalMaterias)} detalle="Productos y materia prima" icono={Layers} />
        <TarjetaIndicador titulo="Productos terminados" valor={formatoCordobas(inv.totalProductos)} detalle={`${formatoCordobas(inv.totalVentaProductos)} a precio de venta`} icono={Package} tono="positivo" />
        <TarjetaIndicador titulo="Materia prima" valor={formatoCordobas(inv.totalMaterias)} detalle={`${materiasPrimas.length} material(es)`} icono={Tag} />
        <TarjetaIndicador titulo="Artículos en stock bajo" valor={String(bajos)} detalle="En o por debajo del mínimo" icono={AlertTriangle} tono={bajos ? 'alerta' : 'positivo'} />
      </div>

      <TablaReporte
        titulo="Productos terminados"
        descripcion="Valorizados al costo de producción."
        archivo={`${archivo}-productos`}
        columnas={[
          { etiqueta: 'Producto' },
          { etiqueta: 'SKU' },
          { etiqueta: 'Existencias', formato: 'cantidad' },
          { etiqueta: 'Mínimo', formato: 'cantidad' },
          { etiqueta: 'Costo unitario', formato: 'cordobas' },
          { etiqueta: 'Valor al costo', formato: 'cordobas' },
          { etiqueta: 'Valor de venta', formato: 'cordobas' },
          { etiqueta: 'Estado' }
        ]}
        filas={inv.productos.map((f) => [f.nombre, f.codigo, f.existencias, f.minimo, f.costo, f.valor, f.valorVenta, f.existencias <= f.minimo ? 'Stock bajo' : 'OK'])}
        totales={['Total', '', inv.productos.reduce((t, f) => t + f.existencias, 0), '', '', inv.totalProductos, inv.totalVentaProductos, '']}
        vacio="No hay productos registrados."
      />

      <TablaReporte
        titulo="Materia prima"
        descripcion="Valorizada al costo unitario actual."
        archivo={`${archivo}-materia-prima`}
        columnas={[
          { etiqueta: 'Materia prima' },
          { etiqueta: 'Código' },
          { etiqueta: 'Existencias', formato: 'cantidad' },
          { etiqueta: 'Unidad' },
          { etiqueta: 'Mínimo', formato: 'cantidad' },
          { etiqueta: 'Costo unitario', formato: 'cordobas' },
          { etiqueta: 'Valor', formato: 'cordobas' },
          { etiqueta: 'Estado' }
        ]}
        filas={inv.materias.map((f) => [f.nombre, f.codigo, f.existencias, ABREVIATURAS_UNIDAD[f.unidad], f.minimo, f.costo, f.valor, f.existencias <= f.minimo ? 'Stock bajo' : 'OK'])}
        totales={['Total', '', '', '', '', '', inv.totalMaterias, '']}
        vacio="No hay materia prima registrada."
      />
    </div>
  )
}
