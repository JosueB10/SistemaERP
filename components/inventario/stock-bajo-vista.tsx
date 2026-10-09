'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, Layers, Package, PackagePlus, XCircle } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { AvisoConexion } from './ui'
import type { ArticuloInventario, ClaseArticulo } from '@/lib/inventario/tipos'
import {
  articulosStockBajo,
  coincideBusqueda,
  ETIQUETAS_CLASE,
  formatoCantidad,
  rutaDetalle
} from '@/lib/inventario/utilidades'
import MovimientoFormulario from './movimiento-formulario'
import {
  Buscador,
  claseBotonTabla,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  InsigniaEstado,
  Modal,
  Notificacion,
  TarjetaIndicador,
  useNotificacion
} from './ui'

export default function StockBajoVista() {
  const datos = useInventario()
  const { mensaje, mostrar } = useNotificacion()

  const [busqueda, setBusqueda] = useState('')
  const [filtroClase, setFiltroClase] = useState<ClaseArticulo | ''>('')
  const [reabastecer, setReabastecer] = useState<ArticuloInventario | null>(null)

  const alertas = useMemo(() => articulosStockBajo(datos), [datos])
  const filtradas = alertas.filter(
    (item) =>
      coincideBusqueda(busqueda, item.codigo, item.nombre, item.categoria) &&
      (!filtroClase || item.clase === filtroClase)
  )

  const agotados = alertas.filter((item) => item.estado === 'agotado').length
  const productos = alertas.filter((item) => item.clase === 'producto').length

  return (
    <>
      <AvisoConexion />
      <EncabezadoPagina
        titulo="Stock bajo"
        descripcion="Artículos con existencias iguales o inferiores a su stock mínimo."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <TarjetaIndicador titulo="Alertas activas" valor={String(alertas.length)} detalle="Productos y materiales" icono={AlertTriangle} tono={alertas.length ? 'alerta' : 'positivo'} />
        <TarjetaIndicador titulo="Agotados" valor={String(agotados)} detalle="Sin existencias" icono={XCircle} tono={agotados ? 'peligro' : 'positivo'} />
        <TarjetaIndicador titulo="Productos terminados" valor={String(productos)} detalle="En stock bajo o agotados" icono={Package} />
        <TarjetaIndicador titulo="Materias primas" valor={String(alertas.length - productos)} detalle="En stock bajo o agotadas" icono={Layers} />
      </div>

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 sm:flex-row sm:items-center">
          <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por código o nombre" />
          <select
            value={filtroClase}
            onChange={(e) => setFiltroClase(e.target.value as ClaseArticulo | '')}
            className={`${claseInput} sm:w-52 sm:ml-auto`}
            aria-label="Filtrar por tipo de artículo"
          >
            <option value="">Todos los artículos</option>
            {(Object.keys(ETIQUETAS_CLASE) as ClaseArticulo[]).map((clase) => (
              <option key={clase} value={clase}>
                {ETIQUETAS_CLASE[clase]}
              </option>
            ))}
          </select>
        </div>

        {filtradas.length === 0 ? (
          <EstadoVacio
            icono={CheckCircle2}
            titulo={alertas.length === 0 ? 'Todo en orden' : 'No hay alertas que coincidan'}
            descripcion={
              alertas.length === 0
                ? 'Ningún artículo está por debajo de su stock mínimo.'
                : 'Pruebe con otros filtros o términos de búsqueda.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className={claseCabeceraTabla}>Código</th>
                  <th className={claseCabeceraTabla}>Nombre</th>
                  <th className={claseCabeceraTabla}>Tipo de artículo</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Existencias</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Stock mínimo</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Diferencia</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filtradas.map((item) => {
                  const diferencia = Math.round((item.existencias - item.stockMinimo) * 100) / 100
                  return (
                    <tr key={`${item.clase}-${item.id}`} className="hover:bg-stone-50/60">
                      <td className={`${claseCeldaTabla} font-mono text-xs`}>{item.codigo}</td>
                      <td className={`${claseCeldaTabla} font-medium text-stone-900`}>{item.nombre}</td>
                      <td className={claseCeldaTabla}>{ETIQUETAS_CLASE[item.clase]}</td>
                      <td className={`${claseCeldaTabla} text-right font-semibold text-stone-900`}>
                        {formatoCantidad(item.existencias)} {item.unidad}
                      </td>
                      <td className={`${claseCeldaTabla} text-right text-stone-500`}>
                        {formatoCantidad(item.stockMinimo)} {item.unidad}
                      </td>
                      <td className={`${claseCeldaTabla} text-right font-semibold ${diferencia < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {formatoCantidad(diferencia)}
                      </td>
                      <td className={claseCeldaTabla}>
                        <InsigniaEstado estado={item.estado} />
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <div className="inline-flex gap-1">
                          <Link href={rutaDetalle(item.clase, item.id)} className={claseBotonTabla}>
                            <Eye size={14} />
                            Consultar
                          </Link>
                          <button type="button" onClick={() => setReabastecer(item)} className={claseBotonTabla}>
                            <PackagePlus size={14} />
                            Registrar entrada
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        abierto={reabastecer !== null}
        titulo="Registrar entrada"
        descripcion={reabastecer ? `${reabastecer.codigo} — ${reabastecer.nombre}` : undefined}
        onCerrar={() => setReabastecer(null)}
      >
        {reabastecer && (
          <MovimientoFormulario
            claseInicial={reabastecer.clase}
            articuloIdInicial={reabastecer.id}
            tipoInicial="entrada"
            onCancelar={() => setReabastecer(null)}
            onGuardado={(texto) => {
              setReabastecer(null)
              mostrar(texto)
            }}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
