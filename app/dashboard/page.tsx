'use client'

import Link from 'next/link'
import {
  ShoppingCart,
  Package,
  Factory,
  Wallet,
  ArrowRight
} from 'lucide-react'

import { alertasActuales } from '@/lib/actividad/eventos'
import { useActividad, useFuentesActividad } from '@/lib/actividad/store'
import { formatoCantidad, formatoCordobas, tieneStockBajo } from '@/lib/inventario/utilidades'
import { estadoResultados, periodoDePreset } from '@/lib/reportes/calculos'
import { haceCuanto, OrigenNotificacion, IconoNotificacion } from '@/components/notificaciones/ui'

export default function DashboardPage() {
  const fuentes = useFuentesActividad()
  const actividad = useActividad()
  const { inventario, ventas, compras, produccion, finanzas } = fuentes

  const mes = periodoDePreset('este_mes')
  const resultados = estadoResultados(ventas.ventas, compras.compras, finanzas.ingresos, finanzas.gastos, mes)
  const unidadesStock = inventario.productos.reduce((t, p) => t + Math.max(p.existencias, 0), 0)
  const completadasMes = produccion.ordenes.filter((o) => o.estado === 'completada' && o.fechaFin && o.fechaFin >= mes.desde)
  const producidasMes = completadasMes.reduce((t, o) => t + o.cantidadProducida, 0)
  const stockBajo = [...inventario.productos.filter((p) => p.stockMinimo > 0), ...inventario.materiasPrimas].filter(tieneStockBajo).length
  const alertas = alertasActuales(fuentes)
  const recientes = actividad.slice(0, 8)

  return (
    <>

      {/* TITLE */}

      <div className="mb-8">

        <h1 className="text-2xl font-bold text-stone-900">
          Dashboard
        </h1>

        <p className="text-sm text-stone-500 mt-1">
          Resumen general de NeumoPad
        </p>

      </div>


      {/* CARDS */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

        <StatCard
          title="Ventas del mes"
          value={formatoCordobas(resultados.ventasNetas)}
          change={`${resultados.cantidadVentas} venta(s) sin IVA`}
          icon={ShoppingCart}
        />

        <StatCard
          title="Productos en stock"
          value={formatoCantidad(unidadesStock)}
          change={`${inventario.productos.length} producto(s) activos`}
          icon={Package}
        />

        <StatCard
          title="Producción del mes"
          value={`${formatoCantidad(producidasMes)} und`}
          change={`${completadasMes.length} orden(es) completada(s)`}
          icon={Factory}
        />

        <StatCard
          title="Utilidad del mes"
          value={formatoCordobas(resultados.utilidadNeta)}
          change="Ventas − costo de ventas − gastos"
          icon={Wallet}
        />

      </div>


      {/* CONTENT GRID */}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-6">

        {/* ALERTS */}

        <div className="xl:col-span-2 bg-white border border-stone-200 rounded-xl p-6">

          <div className="flex items-center justify-between mb-4">

            <div>
              <h2 className="font-semibold text-stone-900">
                Alertas
              </h2>

              <p className="text-xs text-stone-400 mt-1">
                Lo que necesita atención ahora
              </p>
            </div>

            <Link href="/notificaciones" className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900">
              Ver notificaciones <ArrowRight size={13} />
            </Link>

          </div>

          {alertas.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-500">Sin alertas: el inventario y la producción están en orden.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {alertas.slice(0, 6).map((a) => (
                <li key={a.clave}>
                  <Link href={a.href} className="flex gap-3 py-3 hover:bg-stone-50 -mx-2 px-2 rounded-lg">
                    <IconoNotificacion notificacion={{ clase: 'alerta', ...a, leida: true }} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900">{a.titulo}</p>
                      <p className="text-xs text-stone-500">{a.detalle}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

        </div>


        {/* STOCK */}

        <div className="bg-white border border-stone-200 rounded-xl p-6">

          <div className="mb-6">

            <h2 className="font-semibold text-stone-900">
              Inventario
            </h2>

            <p className="text-xs text-stone-400 mt-1">
              Estado actual
            </p>

          </div>

          <div className="space-y-4">

            <InventoryRow
              label="Productos terminados"
              value={String(inventario.productos.length)}
              href="/inventario/productos"
            />

            <InventoryRow
              label="Materias primas"
              value={String(inventario.materiasPrimas.length)}
              href="/inventario/materias-primas"
            />

            <InventoryRow
              label="Stock bajo"
              value={String(stockBajo)}
              href="/inventario/stock-bajo"
              warning={stockBajo > 0}
            />

          </div>

        </div>

      </div>


      {/* RECENT ACTIVITY */}

      <div className="bg-white border border-stone-200 rounded-xl p-6 mt-6">

        <div className="mb-4 flex items-center justify-between">

          <div>
            <h2 className="font-semibold text-stone-900">
              Actividad reciente
            </h2>

            <p className="text-xs text-stone-400 mt-1">
              Últimos movimientos del sistema
            </p>
          </div>

          <Link href="/reportes" className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-stone-900">
            Ver bitácora completa <ArrowRight size={13} />
          </Link>

        </div>

        {recientes.length === 0 ? (
          <div className="py-12 text-center">

            <p className="text-sm text-stone-500">
              No hay actividad registrada.
            </p>

            <p className="text-xs text-stone-400 mt-1">
              Las compras, ventas y producciones aparecerán aquí.
            </p>

          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {recientes.map((e) => (
              <li key={e.clave}>
                <Link href={e.href} className="flex gap-3 py-3 hover:bg-stone-50 -mx-2 px-2 rounded-lg">
                  <IconoNotificacion notificacion={{ clase: 'evento', ...e, leida: true }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-stone-900">{e.titulo}</p>
                    <p className="text-xs text-stone-500 truncate">{e.detalle}</p>
                    <OrigenNotificacion notificacion={{ clase: 'evento', ...e, leida: true }} />
                  </div>
                  <span className="hidden shrink-0 text-xs text-stone-400 sm:block">{haceCuanto(e.momento)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

      </div>

    </>
  )
}


function StatCard({
  title,
  value,
  change,
  icon: Icon
}: {
  title: string
  value: string
  change: string
  icon: React.ElementType
}) {

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-xs text-stone-500">
            {title}
          </p>

          <p className="text-2xl font-bold text-stone-900 mt-2">
            {value}
          </p>

        </div>

        <div className="w-10 h-10 rounded-lg bg-stone-100 flex items-center justify-center">
          <Icon size={19} className="text-stone-600" />
        </div>

      </div>

      <div className="flex items-center gap-1 mt-4">

        <span className="text-xs text-stone-400">
          {change}
        </span>

      </div>

    </div>
  )
}


function InventoryRow({
  label,
  value,
  href,
  warning = false
}: {
  label: string
  value: string
  href: string
  warning?: boolean
}) {

  return (
    <Link href={href} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0 hover:opacity-80">

      <div className="flex items-center gap-3">

        <div className={`w-2 h-2 rounded-full ${
          warning ? 'bg-amber-500' : 'bg-stone-300'
        }`} />

        <span className="text-sm text-stone-600">
          {label}
        </span>

      </div>

      <span className="text-sm font-semibold text-stone-900">
        {value}
      </span>

    </Link>
  )
}
