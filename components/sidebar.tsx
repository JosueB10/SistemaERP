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
  ChevronRight,
  X
} from 'lucide-react'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type MenuItem = {
  label: string
  href?: string
  icon: React.ElementType
  children?: {
    label: string
    href: string
  }[]
}

const grupos: { titulo: string; items: MenuItem[] }[] = [
  {
    titulo: 'General',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: BarChart3 }
    ]
  },
  {
    titulo: 'Operaciones',
    items: [
      {
        label: 'Ventas',
        icon: ShoppingCart,
        children: [
          { label: 'Nueva venta', href: '/ventas/nueva' },
          { label: 'Historial', href: '/ventas' },
          { label: 'Clientes', href: '/ventas/clientes' }
        ]
      },
      {
        label: 'Inventario',
        icon: Package,
        children: [
          { label: 'Resumen', href: '/inventario' },
          { label: 'Productos', href: '/inventario/productos' },
          { label: 'Materias primas', href: '/inventario/materias-primas' },
          { label: 'Movimientos', href: '/inventario/movimientos' },
          { label: 'Stock bajo', href: '/inventario/stock-bajo' }
        ]
      },
      {
        label: 'Producción',
        icon: Factory,
        children: [
          { label: 'Órdenes', href: '/produccion' },
          { label: 'Recetas', href: '/produccion/recetas' },
          { label: 'Historial', href: '/produccion/historial' }
        ]
      },
      {
        label: 'Compras',
        icon: Truck,
        children: [
          { label: 'Nueva compra', href: '/compras/nueva' },
          { label: 'Historial', href: '/compras' },
          { label: 'Proveedores', href: '/compras/proveedores' }
        ]
      }
    ]
  },
  {
    titulo: 'Gestión',
    items: [
      {
        label: 'Finanzas',
        icon: Wallet,
        children: [
          { label: 'Resumen', href: '/finanzas' },
          { label: 'Ingresos', href: '/finanzas/ingresos' },
          { label: 'Gastos', href: '/finanzas/gastos' }
        ]
      },
      {
        label: 'Recursos Humanos',
        icon: Users,
        children: [
          { label: 'Resumen', href: '/recursos-humanos' },
          { label: 'Empleados', href: '/recursos-humanos/empleados' },
          { label: 'Asistencia', href: '/recursos-humanos/asistencia' },
          { label: 'Nómina', href: '/recursos-humanos/nomina' }
        ]
      },
      { label: 'Reportes', href: '/reportes', icon: FileText }
    ]
  }
]

// Cada módulo tiene su propio layout y el menú se vuelve a montar al cambiar de módulo;
// se guarda en la sesión del navegador qué secciones estaban abiertas y hasta dónde se había desplazado.
const CLAVE_ABIERTOS = 'neumopad:menu-abierto'
const CLAVE_SCROLL = 'neumopad:menu-scroll'

function leerSesion(clave: string) {
  try {
    return sessionStorage.getItem(clave)
  } catch {
    return null
  }
}

function guardarSesion(clave: string, valor: string) {
  try {
    sessionStorage.setItem(clave, valor)
  } catch {
    // Sin almacenamiento disponible el menú simplemente no recuerda su estado
  }
}

// Sección activa: la de la subpágina con la ruta más específica que coincide
function seccionActiva(pathname: string) {
  let mejor: { seccion: string; href: string } | null = null
  for (const grupo of grupos) {
    for (const item of grupo.items) {
      for (const child of item.children ?? []) {
        const coincide = pathname === child.href || pathname.startsWith(`${child.href}/`)
        if (coincide && (!mejor || child.href.length > mejor.href.length)) mejor = { seccion: item.label, href: child.href }
      }
    }
  }
  return mejor
}

export default function Sidebar({ abiertoMovil, onCerrarMovil }: { abiertoMovil: boolean; onCerrarMovil: () => void }) {
  const pathname = usePathname()
  const activa = seccionActiva(pathname)
  const nav = useRef<HTMLElement>(null)

  const [openMenus, setOpenMenus] = useState<string[]>(() => {
    let guardados: string[] = []
    try {
      guardados = JSON.parse(leerSesion(CLAVE_ABIERTOS) ?? '[]')
    } catch {
      guardados = []
    }
    return activa && !guardados.includes(activa.seccion) ? [...guardados, activa.seccion] : guardados
  })

  useEffect(() => {
    guardarSesion(CLAVE_ABIERTOS, JSON.stringify(openMenus))
  }, [openMenus])

  useLayoutEffect(() => {
    const guardado = Number(leerSesion(CLAVE_SCROLL))
    if (nav.current && guardado) nav.current.scrollTop = guardado
  }, [])

  // En móvil, el panel se cierra al navegar
  useEffect(() => {
    onCerrarMovil()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  const toggleMenu = (label: string) => {
    setOpenMenus((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    )
  }

  return (
    <>
      {abiertoMovil && (
        <div className="fixed inset-0 z-40 bg-zinc-950/30 backdrop-blur-[2px] lg:hidden" onClick={onCerrarMovil} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 bg-white border-r border-zinc-200/80 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 print:hidden ${
          abiertoMovil ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >

        {/* LOGO */}
        <div className="h-16 shrink-0 flex items-center justify-between px-5">

          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-semibold text-sm">N</span>
            </div>
            <div className="leading-tight">
              <p className="font-semibold text-[15px] text-zinc-900">NeumoPad</p>
              <p className="text-[11px] text-zinc-400">ERP</p>
            </div>
          </Link>

          <button type="button" onClick={onCerrarMovil} className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 lg:hidden" aria-label="Cerrar menú">
            <X size={18} />
          </button>

        </div>

        {/* MENU */}
        <nav
          ref={nav}
          onScroll={(e) => guardarSesion(CLAVE_SCROLL, String(e.currentTarget.scrollTop))}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pt-2 pb-6"
        >

          {grupos.map((grupo) => (
            <div key={grupo.titulo} className="mb-5 last:mb-0">

              <p className="px-3 mb-1.5 text-[11px] font-medium text-zinc-400">
                {grupo.titulo}
              </p>

              <div className="space-y-0.5">

                {grupo.items.map((item) => {

                  const Icon = item.icon

                  const isOpen = openMenus.includes(item.label)

                  const isActive = item.href ? pathname.startsWith(item.href) : activa?.seccion === item.label

                  if (item.children) {
                    return (
                      <div key={item.label}>

                        <button
                          type="button"
                          onClick={() => toggleMenu(item.label)}
                          aria-expanded={isOpen}
                          className={`w-full flex items-center gap-3 px-3 h-9 rounded-lg text-sm transition ${
                            isActive
                              ? 'text-zinc-900 font-medium'
                              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                          }`}
                        >
                          <Icon size={17} className={isActive ? 'text-zinc-900' : 'text-zinc-400'} />
                          <span className="flex-1 text-left">{item.label}</span>
                          <ChevronRight size={14} className={`text-zinc-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {isOpen && (
                          <div className="ml-[22px] mt-0.5 mb-1 border-l border-zinc-200 pl-3 space-y-0.5">

                            {item.children.map((child) => {
                              const hijoActivo = activa?.href === child.href
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  aria-current={hijoActivo ? 'page' : undefined}
                                  className={`relative flex items-center h-8 px-2.5 rounded-md text-[13px] transition ${
                                    hijoActivo
                                      ? 'bg-zinc-100 text-zinc-900 font-medium before:absolute before:-left-[13px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-zinc-900'
                                      : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              )
                            })}

                          </div>
                        )}

                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.label}
                      href={item.href ?? '/dashboard'}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-3 px-3 h-9 rounded-lg text-sm transition ${
                        isActive
                          ? 'bg-zinc-100 text-zinc-900 font-medium'
                          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                      }`}
                    >
                      <Icon size={17} className={isActive ? 'text-zinc-900' : 'text-zinc-400'} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}

              </div>

            </div>
          ))}

        </nav>

      </aside>
    </>
  )
}
