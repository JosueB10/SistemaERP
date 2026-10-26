'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BookOpen, ClipboardList, Pencil } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { AvisoConexion } from '../inventario/ui'
import { coincideBusqueda, formatoCantidad, formatoCordobas } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import {
  capacidadProduccion,
  costoReceta,
  recetaDeProducto,
  requerimientos,
  tieneMateriaDefinida
} from '@/lib/produccion/utilidades'
import {
  Buscador,
  claseBotonTabla,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  Modal,
  Notificacion,
  Paginacion,
  TarjetaIndicador,
  useNotificacion,
  usePaginacion
} from '../inventario/ui'
import RecetaFormulario from './receta-formulario'
import { AvisoConexionProduccion, SECCION_PRODUCCION } from './ui'

type FiltroReceta = '' | 'con' | 'sin'

export default function RecetasVista() {
  const { productos, materiasPrimas } = useInventario()
  const { recetas } = useProduccion()
  const { mensaje, mostrar } = useNotificacion()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<FiltroReceta>('')
  // ?producto=<id> abre directamente el editor (enlace desde Inventario)
  const productoEditar = productos.find((p) => p.id === searchParams.get('producto'))

  const filas = useMemo(
    () =>
      productos
        .map((producto) => {
          const receta = recetaDeProducto(recetas, producto.id)
          return {
            producto,
            receta,
            definida: tieneMateriaDefinida(receta),
            costo: costoReceta(receta, materiasPrimas),
            capacidad: capacidadProduccion(receta, materiasPrimas),
            materiales: requerimientos(receta, 1, materiasPrimas)
          }
        })
        .filter(
          (fila) =>
            coincideBusqueda(busqueda, fila.producto.sku, fila.producto.nombre, ...fila.materiales.map((m) => m.nombre)) &&
            (!filtro || (filtro === 'con') === fila.definida)
        )
        .sort((a, b) => Number(a.definida) - Number(b.definida) || a.producto.sku.localeCompare(b.producto.sku)),
    [productos, recetas, materiasPrimas, busqueda, filtro]
  )

  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filas, 10)
  const definidas = productos.filter((p) => tieneMateriaDefinida(recetaDeProducto(recetas, p.id))).length

  const abrir = (productoId: string) => router.push(`${pathname}?producto=${encodeURIComponent(productoId)}`, { scroll: false })
  const cerrar = () => router.replace(pathname, { scroll: false })

  return (
    <>
      <AvisoConexion />
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Recetas"
        descripcion="Materia prima que lleva cada producto. Se descuenta del inventario al producir o al vender."
        seccion={SECCION_PRODUCCION}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Productos con receta" valor={`${definidas}/${productos.length}`} detalle="Con materia prima definida" icono={BookOpen} tono={definidas === productos.length ? 'positivo' : 'neutro'} />
        <TarjetaIndicador
          titulo="Sin receta"
          valor={String(productos.length - definidas)}
          detalle="Al venderlos sin stock no se puede descontar materia prima"
          icono={ClipboardList}
          tono={productos.length - definidas > 0 ? 'alerta' : 'neutro'}
        />
        <TarjetaIndicador titulo="Materias primas" valor={String(materiasPrimas.length)} detalle="Disponibles para usar en recetas" icono={BookOpen} />
      </div>

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center">
          <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar producto o materia prima" />
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as FiltroReceta)} className={`${claseInput} sm:w-48 sm:ml-auto`} aria-label="Filtrar por receta">
            <option value="">Todos los productos</option>
            <option value="con">Con receta</option>
            <option value="sin">Sin receta</option>
          </select>
        </div>

        {filas.length === 0 ? (
          <EstadoVacio icono={BookOpen} titulo={productos.length ? 'No hay productos que coincidan' : 'Aún no hay productos'} descripcion={productos.length ? undefined : 'Registre productos en Inventario para definir sus recetas.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>Producto</th>
                  <th className={claseCabeceraTabla}>Materia prima por unidad</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Costo MP</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Costo registrado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Se pueden fabricar</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visibles.map(({ producto, receta, definida, costo, capacidad, materiales }) => (
                  <tr key={producto.id} className="hover:bg-zinc-50/60 align-top">
                    <td className={claseCeldaTabla}>
                      <p className="font-medium text-zinc-900">{producto.nombre}</p>
                      <p className="font-mono text-xs text-zinc-400">{producto.sku}{receta ? ` · v${receta.version}` : ''}</p>
                    </td>
                    <td className={`${claseCeldaTabla} whitespace-normal`}>
                      {definida ? (
                        <ul className="space-y-0.5 text-xs">
                          {materiales.map((m) => (
                            <li key={m.materiaPrimaId}>
                              <span className="font-medium text-zinc-800">{formatoCantidad(m.porUnidad)} {m.unidad}</span>{' '}
                              <span className="text-zinc-500">{m.nombre}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium">Sin definir</span>
                      )}
                    </td>
                    <td className={`${claseCeldaTabla} text-right`}>{definida ? formatoCordobas(costo) : '—'}</td>
                    <td className={`${claseCeldaTabla} text-right text-zinc-500`}>{formatoCordobas(producto.costoProduccion)}</td>
                    <td className={`${claseCeldaTabla} text-right font-semibold ${capacidad === 0 ? 'text-red-600' : 'text-zinc-900'}`}>
                      {capacidad === null ? '—' : `${formatoCantidad(capacidad)} und`}
                    </td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      <button type="button" onClick={() => abrir(producto.id)} className={claseBotonTabla}>
                        <Pencil size={14} />
                        {definida ? 'Editar receta' : 'Definir receta'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filas.length} onCambiar={setPagina} />
      </div>

      <Modal
        abierto={Boolean(productoEditar)}
        titulo="Receta del producto"
        descripcion={productoEditar ? productoEditar.nombre : undefined}
        onCerrar={cerrar}
        ancho="max-w-3xl"
      >
        {productoEditar && (
          <RecetaFormulario
            // Si las recetas terminan de cargar con el modal abierto, el formulario se reinicia con ellas
            key={`${productoEditar.id}-${recetaDeProducto(recetas, productoEditar.id)?.version ?? 0}`}
            producto={productoEditar}
            onCancelar={cerrar}
            onGuardado={(texto) => { cerrar(); mostrar(texto) }}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
