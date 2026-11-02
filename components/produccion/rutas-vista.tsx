'use client'

import { useState } from 'react'
import { Pencil, Route, Timer, Workflow } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { ETIQUETAS_TIPO_PRODUCTO } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { cicloEstandarUnidad, formatoMinutos, tiempoEstimadoRuta } from '@/lib/produccion/utilidades'
import {
  AvisoConexion,
  claseBotonTabla,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  InsigniaNeutra,
  Modal,
  Notificacion,
  TarjetaIndicador,
  useNotificacion
} from '../inventario/ui'
import RutaFormulario from './ruta-formulario'
import { AvisoConexionProduccion, SECCION_PRODUCCION } from './ui'

export default function RutasVista() {
  const { productos } = useInventario()
  const { rutas, centros } = useProduccion()
  const { mensaje, mostrar } = useNotificacion()
  const [productoId, setProductoId] = useState<string | null>(null)

  const centroPorId = new Map(centros.map((c) => [c.id, c]))
  const conRuta = productos.filter((p) => rutas.some((r) => r.productoId === p.id)).length
  const productoEditar = productos.find((p) => p.id === productoId)

  return (
    <>
      <AvisoConexion />
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Rutas de fabricación"
        descripcion="Pasos que sigue cada mousepad, en orden, con el centro de trabajo y el tiempo estándar. Al iniciar una orden se copian como sus operaciones."
        seccion={SECCION_PRODUCCION}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Productos con ruta" valor={`${conRuta}/${productos.length}`} detalle="Las órdenes de los productos con ruta registran cada operación" icono={Route} tono={conRuta === productos.length ? 'positivo' : 'alerta'} />
        <TarjetaIndicador titulo="Pasos definidos" valor={String(rutas.length)} detalle={`En ${centros.filter((c) => c.activo).length} centros de trabajo activos`} icono={Workflow} />
        <TarjetaIndicador titulo="Lote de referencia" valor="10 und" detalle="Los tiempos de cada tarjeta se calculan para 10 unidades" icono={Timer} />
      </div>

      {productos.length === 0 ? (
        <div className={claseTarjeta}><EstadoVacio icono={Route} titulo="Aún no hay productos" descripcion="Registre productos en Inventario." /></div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {productos.map((producto) => {
            const pasos = rutas.filter((r) => r.productoId === producto.id).sort((a, b) => a.secuencia - b.secuencia)
            return (
              <section key={producto.id} className={`${claseTarjeta} p-5`}>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="font-semibold text-zinc-900">{producto.nombre}</p>
                    <p className="text-xs text-zinc-400"><span className="font-mono">{producto.sku}</span> · {ETIQUETAS_TIPO_PRODUCTO[producto.tipo]}</p>
                  </div>
                  <button type="button" onClick={() => setProductoId(producto.id)} className={claseBotonTabla}>
                    <Pencil size={14} />
                    {pasos.length ? 'Editar ruta' : 'Definir ruta'}
                  </button>
                </div>
                {pasos.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-5 text-center text-sm text-amber-700">Sin ruta de fabricación.</p>
                ) : (
                  <>
                    <ol className="relative space-y-2 border-l border-zinc-200 ml-3">
                      {pasos.map((paso) => {
                        const centro = centroPorId.get(paso.centroTrabajoId)
                        return (
                          <li key={paso.id} className="ml-4">
                            <span className="absolute -left-3 mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white ring-1 ring-zinc-300 text-[11px] font-semibold text-zinc-700">{paso.secuencia}</span>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-zinc-800">{paso.nombre}</p>
                              <span className="text-xs tabular-nums text-zinc-500">{paso.tiempoEstandarMin} min/und{paso.tiempoPreparacionMin ? ` · prep. ${paso.tiempoPreparacionMin} min` : ''}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <InsigniaNeutra>{centro ? `${centro.codigo} · ${centro.nombre}` : 'Centro inactivo'}</InsigniaNeutra>
                              {paso.instrucciones && <span className="text-xs text-zinc-400">{paso.instrucciones}</span>}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-3 text-sm">
                      <div>
                        <p className="text-xs text-zinc-500">Tiempo de ciclo estándar</p>
                        <p className="font-semibold text-zinc-900">{formatoMinutos(cicloEstandarUnidad(pasos))} / und</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Tiempo estimado para 10 und</p>
                        <p className="font-semibold text-zinc-900">{formatoMinutos(tiempoEstimadoRuta(pasos, 10))}</p>
                      </div>
                    </div>
                  </>
                )}
              </section>
            )
          })}
        </div>
      )}

      <Modal abierto={Boolean(productoEditar)} titulo="Ruta de fabricación" descripcion={productoEditar ? `${productoEditar.sku} — ${productoEditar.nombre}` : undefined} onCerrar={() => setProductoId(null)} ancho="max-w-4xl">
        {productoEditar && (
          <RutaFormulario
            key={productoEditar.id}
            producto={productoEditar}
            onCancelar={() => setProductoId(null)}
            onGuardado={(texto) => { setProductoId(null); mostrar(texto) }}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
