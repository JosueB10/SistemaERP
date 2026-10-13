'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  ShoppingCart,
  Package,
  Factory,
  Truck,
  Wallet,
  Users,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

import { useState } from 'react'

type MenuItem = {
  label: string
  href?: string
  icon: React.ElementType
  children?: {
    label: string
    href: string
  }[]
}

const menuItems: MenuItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: BarChart3
  },

  {
    label: 'Ventas',
    icon: ShoppingCart,
    children: [
      {
        label: 'Nueva venta',
        href: '/ventas/nueva'
      },
      {
        label: 'Historial',
        href: '/ventas'
      },
      {
        label: 'Clientes',
        href: '/clientes'
      }
    ]
  },

  {
    label: 'Inventario',
    icon: Package,
    children: [
      {
        label: 'Resumen',
        href: '/inventario'
      },
      {
        label: 'Productos',
        href: '/inventario/productos'
      },
      {
        label: 'Materias primas',
        href: '/inventario/materias-primas'
      },
      {
        label: 'Movimientos',
        href: '/inventario/movimientos'
      },
      {
        label: 'Stock bajo',
        href: '/inventario/stock-bajo'
      }
    ]
  },

  {
    label: 'Producción',
    icon: Factory,
    children: [
      {
        label: 'Órdenes',
        href: '/produccion'
      },
      {
        label: 'Recetas',
        href: '/produccion/recetas'
      },
      {
        label: 'Historial',
        href: '/produccion/historial'
      }
    ]
  },

  {
    label: 'Compras',
    icon: Truck,
    children: [
      {
        label: 'Nueva compra',
        href: '/compras/nueva'
      },
      {
        label: 'Historial',
        href: '/compras'
      },
      {
        label: 'Proveedores',
        href: '/proveedores'
      }
    ]
  },

  {
    label: 'Finanzas',
    icon: Wallet,
    children: [
      {
        label: 'Ingresos',
        href: '/finanzas/ingresos'
      },
      {
        label: 'Gastos',
        href: '/finanzas/gastos'
      },
      {
        label: 'Resumen',
        href: '/finanzas'
      }
    ]
  },

  {
    label: 'Recursos Humanos',
    icon: Users,
    children: [
      {
        label: 'Resumen',
        href: '/recursos-humanos'
      },
      {
        label: 'Empleados',
        href: '/recursos-humanos/empleados'
      },
      {
        label: 'Asistencia',
        href: '/recursos-humanos/asistencia'
      },
      {
        label: 'Nómina',
        href: '/recursos-humanos/nomina'
      }
    ]
  },

  {
    label: 'Reportes',
    href: '/reportes',
    icon: FileText
  },

  {
    label: 'Configuración',
    href: '/configuracion',
    icon: Settings
  }
]

export default function Sidebar() {
  const pathname = usePathname()

  const [openMenus, setOpenMenus] = useState<string[]>([
    'Ventas',
    'Inventario',
    'Producción'
  ])

  const toggleMenu = (label: string) => {
    setOpenMenus((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    )
  }

  return (
    <aside className="w-64 min-h-screen bg-[#242424] text-white flex flex-col">

      {/* LOGO */}
      <div className="h-20 flex items-center px-6 border-b border-white/10">

        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mr-3">
          <span className="text-[#242424] font-bold text-lg">
            N
          </span>
        </div>

        <div>
          <h1 className="font-bold text-lg leading-none">
            NeumoPad
          </h1>

          <span className="text-xs text-stone-400">
            ERP
          </span>
        </div>

      </div>

      {/* MENU */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto">

        <p className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold px-3 mb-3">
          Menú principal
        </p>

        <div className="space-y-1">

          {menuItems.map((item) => {

            const Icon = item.icon

            const hasChildren = item.children && item.children.length > 0

            const isOpen = openMenus.includes(item.label)

            const isActive =
              item.href === pathname ||
              item.children?.some((child) => pathname.startsWith(child.href))

            if (hasChildren) {
              return (
                <div key={item.label}>

                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-stone-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >

                    <div className="flex items-center gap-3">

                      <Icon size={18} />

                      <span>
                        {item.label}
                      </span>

                    </div>

                    {isOpen ? (
                      <ChevronDown size={15} />
                    ) : (
                      <ChevronRight size={15} />
                    )}

                  </button>

                  {isOpen && (
                    <div className="ml-9 mt-1 space-y-1">

                      {item.children?.map((child) => (

                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-3 py-2 rounded-md text-xs transition ${
                            pathname === child.href
                              ? 'bg-white/10 text-white'
                              : 'text-stone-500 hover:text-stone-200'
                          }`}
                        >
                          {child.label}
                        </Link>

                      ))}

                    </div>
                  )}

                </div>
              )
            }

            return (
              <Link
                key={item.label}
                href={item.href || '#'}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-white text-stone-900'
                    : 'text-stone-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} />

                <span>
                  {item.label}
                </span>
              </Link>
            )
          })}

        </div>

      </nav>

      {/* USER */}
      <div className="border-t border-white/10 p-3">

        <div className="flex items-center gap-3 px-3 py-3">

          <div className="w-9 h-9 rounded-full bg-stone-700 flex items-center justify-center">
            <span className="text-sm font-semibold">
              A
            </span>
          </div>

          <div className="flex-1 min-w-0">

            <p className="text-sm font-medium truncate">
              Administrador
            </p>

            <p className="text-xs text-stone-500">
              Administrador
            </p>

          </div>

        </div>

        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-400 hover:bg-white/5 hover:text-white transition">
          <LogOut size={18} />
          Cerrar sesión
        </button>

      </div>

    </aside>
  )
}