'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  Layers,
  Package,
  Wallet
} from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { AvisoConexion } from './ui'
import {
  articulosStockBajo,
  buscarArticulo,
  estadoStock,
  ETIQUETAS_CLASE,
  ETIQUETAS_TIPO_PRODUCTO,
  formatoCantidad,
  formatoCordobas,
  formatoFecha,
  ordenarMovimientos,
  rutaDetalle,
  valorInventario,
  variacionMovimiento
} from '@/lib/inventario/utilidades'
import {
  claseCabeceraTabla,
  claseCeldaTabla,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  InsigniaEstado,
  InsigniaMovimiento,
  TarjetaIndicador
} from './ui'

const accesosRapidos = [
  {
    titulo: 'Productos terminados',
    descripcion: 'Catálogo de mousepads y existencias',
    href: '/inventario/productos',
    icono: Package
  },
  {
    titulo: 'Materias primas',
    descripcion: 'Materiales de fabricación',
    href: '/inventario/materias-primas',
    icono: Layers
  },
  {
    titulo: 'Movimientos',
    descripcion: 'Entradas, salidas y ajustes',
    href: '/inventario/movimientos',
    icono: ArrowRightLeft
  },
  {
    titulo: 'Stock bajo',
    descripcion: 'Artículos por reabastecer',
    href: '/inventario/stock-bajo',
    icono: AlertTriangle
  }
]

export default function ResumenVista() {
  const datos = useInventario()

  const alertas = useMemo(() => articulosStockBajo(datos), [datos])
  const valor = useMemo(() => valorInventario(datos), [datos])
  const productosBajos = alertas.filter((item) => item.clase === 'producto').length
  const unidadesProductos = datos.productos.reduce((total, item) => total + item.existencias, 0)

  const productosRecientes = useMemo(
    () => [...datos.productos].sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn)).slice(0, 5),
    [datos.productos]
  )
  const ultimosMovimientos = useMemo(() => ordenarMovimientos(datos.movimientos).slice(0, 5), [datos.movimientos])

  return (
    <>
      <AvisoConexion />
      <EncabezadoPagina
        titulo="Inventario"
        descripcion="Resumen general de productos terminados y materias primas."
        migas={false}
      />

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <TarjetaIndicador
          titulo="Productos terminados"
          valor={String(datos.productos.length)}
          detalle={`${formatoCantidad(unidadesProductos)} unidades en existencia`}
          icono={Package}
        />
        <TarjetaIndicador
          titulo="Materias primas"
          valor={String(datos.materiasPrimas.length)}
          detalle="Materiales registrados"
          icono={Layers}
        />
        <TarjetaIndicador
          titulo="Productos con stock bajo"
          valor={String(productosBajos)}
          detalle={`${alertas.length - productosBajos} materias primas también en alerta`}
          icono={AlertTriangle}
          tono={productosBajos > 0 ? 'alerta' : 'positivo'}
        />
        <TarjetaIndicador
          titulo="Valor estimado del inventario"
          valor={formatoCordobas(valor.total)}
          detalle={`Productos ${formatoCordobas(valor.productos)} · Materiales ${formatoCordobas(valor.materias)}`}
          icono={Wallet}
          tono="positivo"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mt-6">
        {accesosRapidos.map(({ titulo, descripcion, href, icono: Icono }) => (
          <Link
            key={href}
            href={href}
            className={`${claseTarjeta} group flex items-center gap-4 p-4 hover:border-zinc-400 transition`}
          >
            <div className="w-10 h-10 shrink-0 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Icono size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900">{titulo}</p>
              <p className="text-xs text-zinc-500 truncate">{descripcion}</p>
            </div>
            <ArrowRight size={16} className="text-zinc-300 group-hover:text-zinc-700 transition" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3 mt-6">
        {/* PRODUCTOS RECIENTES */}
        <div className={`${claseTarjeta} xl:col-span-2`}>
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div>
              <h2 className="font-semibold text-zinc-900">Productos recientes</h2>
              <p className="text-xs text-zinc-400 mt-1">Últimos productos actualizados</p>
            </div>
            <Link href="/inventario/productos" className="text-xs font-medium text-zinc-600 hover:text-zinc-900">
              Ver todos
            </Link>
          </div>
          {productosRecientes.length === 0 ? (
            <EstadoVacio icono={Package} titulo="Aún no hay productos" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="bg-zinc-50/70">
                  <tr>
                    <th className={claseCabeceraTabla}>Producto</th>
                    <th className={claseCabeceraTabla}>Tipo</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Precio</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Existencias</th>
                    <th className={claseCabeceraTabla}>Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {productosRecientes.map((producto) => (
                    <tr key={producto.id} className="hover:bg-zinc-50/60">
                      <td className={claseCeldaTabla}>
                        <Link href={rutaDetalle('producto', producto.id)} className="group">
                          <span className="block font-medium text-zinc-900 group-hover:underline">{producto.nombre}</span>
                          <span className="block text-xs text-zinc-400 font-mono">{producto.sku}</span>
                        </Link>
                      </td>
                      <td className={claseCeldaTabla}>{ETIQUETAS_TIPO_PRODUCTO[producto.tipo]}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(producto.precioVenta)}</td>
                      <td className={`${claseCeldaTabla} text-right font-semibold text-zinc-900`}>{formatoCantidad(producto.existencias)}</td>
                      <td className={claseCeldaTabla}>
                        <InsigniaEstado estado={estadoStock(producto.existencias, producto.stockMinimo)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ALERTAS */}
        <div className={`${claseTarjeta} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-zinc-900">Alertas de existencias</h2>
              <p className="text-xs text-zinc-400 mt-1">Iguales o inferiores al mínimo</p>
            </div>
            {alertas.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {alertas.length}
              </span>
            )}
          </div>

          {alertas.length === 0 ? (
            <EstadoVacio icono={CheckCircle2} titulo="Sin alertas" descripcion="Todas las existencias están sobre el mínimo." />
          ) : (
            <ul className="space-y-2">
              {alertas.slice(0, 5).map((item) => (
                <li key={`${item.clase}-${item.id}`}>
                  <Link
                    href={rutaDetalle(item.clase, item.id)}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition hover:shadow-sm ${
                      item.estado === 'agotado' ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">{item.nombre}</p>
                      <p className="text-xs text-zinc-500">
                        {item.codigo} · {ETIQUETAS_CLASE[item.clase]}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-semibold ${item.estado === 'agotado' ? 'text-red-700' : 'text-amber-700'}`}>
                        {formatoCantidad(item.existencias)} {item.unidad}
                      </p>
                      <p className="text-[11px] text-zinc-400">mín. {formatoCantidad(item.stockMinimo)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {alertas.length > 0 && (
            <Link
              href="/inventario/stock-bajo"
              className="mt-4 flex items-center justify-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              Ver todas las alertas
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* ÚLTIMOS MOVIMIENTOS */}
      <div className={`${claseTarjeta} p-6 mt-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-zinc-900">Últimos movimientos</h2>
            <p className="text-xs text-zinc-400 mt-1">Entradas, salidas y ajustes recientes</p>
          </div>
          <Link href="/inventario/movimientos" className="text-xs font-medium text-zinc-600 hover:text-zinc-900">
            Ver historial
          </Link>
        </div>
        {ultimosMovimientos.length === 0 ? (
          <EstadoVacio icono={ArrowRightLeft} titulo="Aún no hay movimientos" />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {ultimosMovimientos.map((mov) => {
              const articulo = buscarArticulo(datos, mov.claseArticulo, mov.articuloId)
              const variacion = variacionMovimiento(mov)
              return (
                <li key={mov.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <InsigniaMovimiento tipo={mov.tipo} />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-800">{articulo?.nombre ?? 'Artículo no disponible'}</p>
                      <p className="text-xs text-zinc-400">
                        {formatoFecha(mov.fecha)} · {mov.motivo}
                      </p>
                    </div>
                  </div>
                  <span className={`font-semibold whitespace-nowrap ${variacion >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {variacion >= 0 ? '+' : ''}
                    {formatoCantidad(variacion)} {articulo?.unidad}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
