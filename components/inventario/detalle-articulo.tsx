'use client'

import Link from 'next/link'
import { ArrowRightLeft, Pencil } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { useProduccion } from '@/lib/produccion/store'
import { capacidadProduccion, costoReceta, recetaDeProducto, requerimientos, tieneMateriaDefinida } from '@/lib/produccion/utilidades'
import type { ClaseArticulo } from '@/lib/inventario/tipos'
import {
  buscarArticulo,
  ETIQUETAS_CLASE,
  ETIQUETAS_TIPO_PRODUCTO,
  ETIQUETAS_UNIDAD,
  formatoCantidad,
  formatoCordobas,
  formatoFecha,
  ordenarMovimientos,
  variacionMovimiento
} from '@/lib/inventario/utilidades'
import {
  claseBotonPrimario,
  claseBotonSecundario,
  InsigniaEstado,
  InsigniaMovimiento
} from './ui'

export default function DetalleArticulo({
  clase,
  id,
  onEditar,
  onMovimiento
}: {
  clase: ClaseArticulo
  id: string
  onEditar: () => void
  onMovimiento: () => void
}) {
  const datos = useInventario()
  const articulo = buscarArticulo(datos, clase, id)

  if (!articulo) {
    return <p className="text-sm text-stone-500">El artículo solicitado no existe.</p>
  }

  const producto = clase === 'producto' ? datos.productos.find((item) => item.id === id) : undefined
  const materia = clase === 'materia_prima' ? datos.materiasPrimas.find((item) => item.id === id) : undefined

  const movimientos = ordenarMovimientos(
    datos.movimientos.filter((mov) => mov.claseArticulo === clase && mov.articuloId === id)
  )

  const filas: [string, React.ReactNode][] = [
    ['Código', <span key="codigo" className="font-mono">{articulo.codigo}</span>],
    ['Clase', ETIQUETAS_CLASE[clase]],
    ['Categoría', articulo.categoria],
    ...(producto
      ? ([
          ['Tipo', ETIQUETAS_TIPO_PRODUCTO[producto.tipo]],
          ['Precio de venta', formatoCordobas(producto.precioVenta)],
          ['Costo de producción', formatoCordobas(producto.costoProduccion)],
          ['Margen estimado', formatoCordobas(producto.precioVenta - producto.costoProduccion)]
        ] as [string, React.ReactNode][])
      : []),
    ...(materia
      ? ([
          ['Unidad de medida', ETIQUETAS_UNIDAD[materia.unidad]],
          ['Costo unitario', formatoCordobas(materia.costoUnitario)]
        ] as [string, React.ReactNode][])
      : []),
    ['Existencias', `${formatoCantidad(articulo.existencias)} ${articulo.unidad}`],
    ['Stock mínimo', `${formatoCantidad(articulo.stockMinimo)} ${articulo.unidad}`],
    ['Valor en inventario', formatoCordobas(articulo.existencias * articulo.costoUnitario)]
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-stone-900">{articulo.nombre}</p>
          <div className="mt-1">
            <InsigniaEstado estado={articulo.estado} />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onEditar} className={claseBotonSecundario}>
            <Pencil size={15} />
            Editar
          </button>
          <button type="button" onClick={onMovimiento} className={claseBotonPrimario}>
            <ArrowRightLeft size={15} />
            Movimiento
          </button>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {filas.map(([etiqueta, valor]) => (
          <div key={etiqueta} className="flex justify-between gap-3 border-b border-stone-100 pb-2 text-sm">
            <dt className="text-stone-500">{etiqueta}</dt>
            <dd className="font-medium text-stone-800 text-right">{valor}</dd>
          </div>
        ))}
      </dl>

      {producto && <MateriaPrimaProducto productoId={producto.id} />}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-stone-900">Últimos movimientos</h3>
          {movimientos.length > 0 && (
            <Link
              href={`/inventario/movimientos?articulo=${clase}:${encodeURIComponent(id)}`}
              className="text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Ver historial completo
            </Link>
          )}
        </div>

        {movimientos.length === 0 ? (
          <p className="text-sm text-stone-400">Sin movimientos registrados.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {movimientos.slice(0, 5).map((mov) => {
              const variacion = variacionMovimiento(mov)
              return (
                <li key={mov.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <InsigniaMovimiento tipo={mov.tipo} />
                    <div className="min-w-0">
                      <p className="truncate text-stone-700">{mov.motivo}</p>
                      <p className="text-xs text-stone-400">{formatoFecha(mov.fecha)}</p>
                    </div>
                  </div>
                  <span
                    className={`font-semibold whitespace-nowrap ${
                      variacion >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {variacion >= 0 ? '+' : ''}
                    {formatoCantidad(variacion)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

// Receta del producto: materia prima que se descuenta al producir o al vender sin stock
function MateriaPrimaProducto({ productoId }: { productoId: string }) {
  const { materiasPrimas } = useInventario()
  const { recetas } = useProduccion()
  const receta = recetaDeProducto(recetas, productoId)
  const enlace = `/produccion/recetas?producto=${encodeURIComponent(productoId)}`

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-stone-900">Materia prima por unidad</h3>
        <Link href={enlace} className="text-xs font-medium text-stone-600 hover:text-stone-900">
          {tieneMateriaDefinida(receta) ? 'Editar receta' : 'Definir receta'}
        </Link>
      </div>
      {tieneMateriaDefinida(receta) ? (
        <>
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
            {requerimientos(receta, 1, materiasPrimas).map((linea) => (
              <li key={linea.materiaPrimaId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="text-stone-700">{linea.nombre}</span>
                <span className="font-medium text-stone-900 whitespace-nowrap">{formatoCantidad(linea.porUnidad)} {linea.unidad}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-400 mt-2">
            Costo de materia prima: {formatoCordobas(costoReceta(receta, materiasPrimas))} · Con el stock actual se pueden fabricar{' '}
            {formatoCantidad(capacidadProduccion(receta, materiasPrimas) ?? 0)} und
          </p>
        </>
      ) : (
        <p className="text-sm text-amber-700">Aún no se ha indicado qué materia prima utiliza este producto.</p>
      )}
    </div>
  )
}
