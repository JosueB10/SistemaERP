import Sidebar from '@/components/sidebar'
import Header from '@/components/header'
import {
  ShoppingCart,
  Package,
  Factory,
  Wallet,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'

export default function DashboardPage() {

  return (
    <div className="min-h-screen bg-[#f5f3f0] flex">

      <Sidebar />

      <div className="flex-1 min-w-0">

        <Header />

        <main className="p-8">

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
              value="C$ 0.00"
              change="Sin datos todavía"
              icon={ShoppingCart}
            />

            <StatCard
              title="Productos en stock"
              value="0"
              change="Sin productos"
              icon={Package}
            />

            <StatCard
              title="Producción"
              value="0"
              change="Unidades producidas"
              icon={Factory}
            />

            <StatCard
              title="Utilidad"
              value="C$ 0.00"
              change="Sin datos todavía"
              icon={Wallet}
            />

          </div>


          {/* CONTENT GRID */}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-6">

            {/* SALES */}

            <div className="xl:col-span-2 bg-white border border-stone-200 rounded-xl p-6">

              <div className="flex items-center justify-between mb-6">

                <div>
                  <h2 className="font-semibold text-stone-900">
                    Ventas
                  </h2>

                  <p className="text-xs text-stone-400 mt-1">
                    Resumen de ventas recientes
                  </p>
                </div>

                <span className="text-xs text-stone-400">
                  Este mes
                </span>

              </div>

              <div className="h-64 flex items-center justify-center">

                <div className="text-center">

                  <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart
                      size={22}
                      className="text-stone-400"
                    />
                  </div>

                  <p className="text-sm font-medium text-stone-700">
                    Aún no hay ventas
                  </p>

                  <p className="text-xs text-stone-400 mt-1">
                    Los datos aparecerán aquí cuando registremos ventas.
                  </p>

                </div>

              </div>

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
                  value="0"
                />

                <InventoryRow
                  label="Materias primas"
                  value="0"
                />

                <InventoryRow
                  label="Stock bajo"
                  value="0"
                  warning
                />

              </div>

            </div>

          </div>


          {/* RECENT ACTIVITY */}

          <div className="bg-white border border-stone-200 rounded-xl p-6 mt-6">

            <div className="mb-6">

              <h2 className="font-semibold text-stone-900">
                Actividad reciente
              </h2>

              <p className="text-xs text-stone-400 mt-1">
                Últimos movimientos del sistema
              </p>

            </div>

            <div className="py-12 text-center">

              <p className="text-sm text-stone-500">
                No hay actividad registrada.
              </p>

              <p className="text-xs text-stone-400 mt-1">
                Las compras, ventas y producciones aparecerán aquí.
              </p>

            </div>

          </div>

        </main>

      </div>

    </div>
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
  warning = false
}: {
  label: string
  value: string
  warning?: boolean
}) {

  return (
    <div className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">

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

    </div>
  )
}