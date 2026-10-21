'use client'

import { Receipt, Truck, Users, Wallet } from 'lucide-react'

import { useCompras } from '@/lib/compras/store'
import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { comprasDelPeriodo, comprasPorMateria, comprasPorProveedor, porcentaje, type Periodo } from '@/lib/reportes/calculos'
import { TarjetaIndicador } from '../inventario/ui'
import { TablaReporte } from './ui'

export default function ReporteCompras({ periodo, archivo }: { periodo: Periodo; archivo: string }) {
  const { materiasPrimas } = useInventario()
  const { compras, proveedores } = useCompras()

  const vigentes = comprasDelPeriodo(compras, periodo)
  const materiaPorId = new Map(materiasPrimas.map((m) => [m.id, m]))
  const proveedorPorId = new Map(proveedores.map((p) => [p.id, p]))

  const total = vigentes.reduce((t, c) => t + c.total, 0)
  const iva = vigentes.reduce((t, c) => t + c.impuesto, 0)
  const porProveedor = comprasPorProveedor(vigentes)
  const porMateria = comprasPorMateria(vigentes)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador titulo="Total comprado" valor={formatoCordobas(total)} detalle="Con IVA" icono={Wallet} />
        <TarjetaIndicador titulo="Compras registradas" valor={String(vigentes.length)} detalle="Sin contar anuladas" icono={Truck} />
        <TarjetaIndicador titulo="IVA pagado" valor={formatoCordobas(iva)} detalle="Crédito fiscal" icono={Receipt} />
        <TarjetaIndicador titulo="Proveedores usados" valor={String(porProveedor.length)} detalle={`${porMateria.length} materia(s) prima(s) distinta(s)`} icono={Users} />
      </div>

      <TablaReporte
        titulo="Compras por proveedor"
        archivo={`${archivo}-por-proveedor`}
        columnas={[
          { etiqueta: 'Proveedor' },
          { etiqueta: 'Compras', formato: 'cantidad' },
          { etiqueta: 'Total', formato: 'cordobas' },
          { etiqueta: '% del total', formato: 'porcentaje' },
          { etiqueta: 'Última compra' }
        ]}
        filas={porProveedor.map((f) => [
          proveedorPorId.get(f.proveedorId)?.nombre ?? 'Proveedor eliminado',
          f.compras,
          f.total,
          porcentaje(f.total, total),
          f.ultima ? formatoFecha(f.ultima) : '—'
        ])}
        totales={['Total', vigentes.length, total, 100, '']}
      />

      <TablaReporte
        titulo="Compras por materia prima"
        descripcion="Importe antes de descuento e IVA de cada compra."
        archivo={`${archivo}-por-materia`}
        columnas={[
          { etiqueta: 'Materia prima' },
          { etiqueta: 'Código' },
          { etiqueta: 'Cantidad', formato: 'cantidad' },
          { etiqueta: 'Unidad' },
          { etiqueta: 'Importe', formato: 'cordobas' },
          { etiqueta: 'Costo promedio', formato: 'cordobas' },
          { etiqueta: 'Mínimo', formato: 'cordobas' },
          { etiqueta: 'Máximo', formato: 'cordobas' }
        ]}
        filas={porMateria.map((f) => {
          const materia = materiaPorId.get(f.materiaPrimaId)
          return [materia?.nombre ?? 'Materia prima inactiva', materia?.codigo ?? '—', f.cantidad, materia ? ABREVIATURAS_UNIDAD[materia.unidad] : '', f.importe, f.promedio, f.minimo, f.maximo]
        })}
      />
    </div>
  )
}
