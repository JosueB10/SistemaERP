'use client'

import { Package, Receipt, ShoppingCart, Wallet } from 'lucide-react'

import { etiquetaMesCorta, etiquetaMesLarga } from '@/lib/finanzas/utilidades'
import { useInventario } from '@/lib/inventario/store'
import { formatoCantidad, formatoCordobas } from '@/lib/inventario/utilidades'
import {
  mesesDelPeriodo,
  porcentaje,
  type Periodo,
  ventasDelPeriodo,
  ventasPorCliente,
  ventasPorMes,
  ventasPorMetodo,
  ventasPorProducto
} from '@/lib/reportes/calculos'
import { useVentas } from '@/lib/ventas/store'
import { ETIQUETAS_METODO_PAGO, unidadesVenta } from '@/lib/ventas/utilidades'
import { claseTarjeta, TarjetaIndicador } from '../inventario/ui'
import GraficoColumnas, { COLOR_SERIE } from '../finanzas/grafico-columnas'
import { TablaReporte } from './ui'

export default function ReporteVentas({ periodo, archivo }: { periodo: Periodo; archivo: string }) {
  const { productos } = useInventario()
  const { ventas, clientes } = useVentas()

  const vigentes = ventasDelPeriodo(ventas, periodo)
  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const clientePorId = new Map(clientes.map((c) => [c.id, c]))

  const neto = vigentes.reduce((t, v) => t + v.subtotal - v.descuento, 0)
  const total = vigentes.reduce((t, v) => t + v.total, 0)
  const unidades = vigentes.reduce((t, v) => t + unidadesVenta(v), 0)
  const porProducto = ventasPorProducto(vigentes)
  const porCliente = ventasPorCliente(vigentes)
  const porMetodo = ventasPorMetodo(vigentes)
  const meses = mesesDelPeriodo(periodo, ventas.map((v) => v.fecha))
  const porMes = ventasPorMes(vigentes, meses)
  const mesesGrafico = porMes.slice(-24)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador titulo="Ventas netas" valor={formatoCordobas(neto)} detalle={`${formatoCordobas(total)} cobrados con IVA`} icono={Wallet} tono="positivo" />
        <TarjetaIndicador titulo="Ventas registradas" valor={String(vigentes.length)} detalle="Sin contar anuladas" icono={ShoppingCart} />
        <TarjetaIndicador titulo="Ticket promedio" valor={formatoCordobas(vigentes.length ? total / vigentes.length : 0)} detalle="Total cobrado por venta" icono={Receipt} />
        <TarjetaIndicador titulo="Unidades vendidas" valor={`${formatoCantidad(unidades)} und`} detalle={`${porProducto.length} producto(s) distinto(s)`} icono={Package} />
      </div>

      {mesesGrafico.length > 1 && (
        <section className={`${claseTarjeta} p-5 break-inside-avoid`}>
          <h2 className="font-semibold text-stone-900">Ventas netas por mes</h2>
          <p className="text-xs text-stone-500 mb-5">Sin IVA{porMes.length > mesesGrafico.length ? ' · últimos 24 meses del período' : ''}</p>
          <GraficoColumnas
            descripcion="Ventas netas por mes"
            categorias={mesesGrafico.map((m) => etiquetaMesCorta(m.mes))}
            formato={formatoCordobas}
            series={[{ nombre: 'Ventas netas', color: COLOR_SERIE.primaria, valores: mesesGrafico.map((m) => m.neto) }]}
          />
        </section>
      )}

      <TablaReporte
        titulo="Ventas por producto"
        descripcion="Importe antes del descuento general de cada venta. Costo según el costo de producción al vender."
        archivo={`${archivo}-por-producto`}
        columnas={[
          { etiqueta: 'Producto' },
          { etiqueta: 'SKU' },
          { etiqueta: 'Unidades', formato: 'cantidad' },
          { etiqueta: 'Fabricadas al vender', formato: 'cantidad' },
          { etiqueta: 'Importe', formato: 'cordobas' },
          { etiqueta: 'Costo', formato: 'cordobas' },
          { etiqueta: 'Margen', formato: 'cordobas' },
          { etiqueta: 'Margen %', formato: 'porcentaje' }
        ]}
        filas={porProducto.map((f) => {
          const producto = productoPorId.get(f.productoId)
          return [producto?.nombre ?? 'Producto inactivo', producto?.sku ?? '—', f.unidades, f.fabricadas, f.importe, f.costo, f.margen, porcentaje(f.margen, f.importe)]
        })}
        totales={(() => {
          const t = porProducto.reduce((a, f) => ({ u: a.u + f.unidades, fa: a.fa + f.fabricadas, i: a.i + f.importe, c: a.c + f.costo }), { u: 0, fa: 0, i: 0, c: 0 })
          return ['Total', '', t.u, t.fa, t.i, t.c, t.i - t.c, porcentaje(t.i - t.c, t.i)]
        })()}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TablaReporte
          titulo="Ventas por cliente"
          descripcion="Total cobrado, con IVA."
          archivo={`${archivo}-por-cliente`}
          columnas={[{ etiqueta: 'Cliente' }, { etiqueta: 'Ventas', formato: 'cantidad' }, { etiqueta: 'Total', formato: 'cordobas' }, { etiqueta: '% del total', formato: 'porcentaje' }]}
          filas={porCliente.map((f) => [
            f.clienteId ? clientePorId.get(f.clienteId)?.nombre ?? 'Cliente eliminado' : 'Cliente de contado',
            f.ventas,
            f.total,
            porcentaje(f.total, total)
          ])}
        />
        <TablaReporte
          titulo="Ventas por método de pago"
          descripcion="Total cobrado, con IVA."
          archivo={`${archivo}-por-metodo`}
          columnas={[{ etiqueta: 'Método' }, { etiqueta: 'Ventas', formato: 'cantidad' }, { etiqueta: 'Total', formato: 'cordobas' }, { etiqueta: '% del total', formato: 'porcentaje' }]}
          filas={porMetodo.map((f) => [f.metodo ? ETIQUETAS_METODO_PAGO[f.metodo] : 'Sin especificar', f.ventas, f.total, porcentaje(f.total, total)])}
        />
      </div>

      <TablaReporte
        titulo="Ventas por mes"
        archivo={`${archivo}-por-mes`}
        columnas={[
          { etiqueta: 'Mes' },
          { etiqueta: 'Ventas', formato: 'cantidad' },
          { etiqueta: 'Ventas netas', formato: 'cordobas' },
          { etiqueta: 'Costo', formato: 'cordobas' },
          { etiqueta: 'Margen bruto', formato: 'cordobas' },
          { etiqueta: 'Total con IVA', formato: 'cordobas' }
        ]}
        filas={[...porMes].reverse().filter((m) => m.ventas > 0).map((m) => [etiquetaMesLarga(m.mes), m.ventas, m.neto, m.costo, m.neto - m.costo, m.total])}
      />
    </div>
  )
}
