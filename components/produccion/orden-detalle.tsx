'use client'

import { useState } from 'react'
import { CheckCircle2, Pencil, Play, XCircle } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { cancelarOrden, iniciarOrden, useProduccion } from '@/lib/produccion/store'
import type { OrdenProduccion } from '@/lib/produccion/tipos'
import { costoUnitarioOrden, ordenAbierta, recetaDeProducto, requerimientos, tieneMateriaDefinida } from '@/lib/produccion/utilidades'
import { claseBotonPrimario, claseBotonSecundario, claseCabeceraTabla, claseCeldaTabla, claseInput, ErrorFormulario } from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'
import { InsigniaOrden, TablaRequerimientos } from './ui'

export default function OrdenDetalle({
  orden,
  onEditar,
  onCompletar,
  onAccion
}: {
  orden: OrdenProduccion
  onEditar: () => void
  onCompletar: () => void
  onAccion: (mensaje: string) => void
}) {
  const { productos, materiasPrimas } = useInventario()
  const { recetas, responsables } = useProduccion()
  const [error, setError] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const producto = productos.find((p) => p.id === orden.productoId)
  const responsable = responsables.find((r) => r.id === orden.empleadoId)
  const receta = recetaDeProducto(recetas, orden.productoId)
  const porId = new Map(materiasPrimas.map((m) => [m.id, m]))

  const ejecutar = async (accion: () => Promise<{ ok: boolean; error?: string }>, mensaje: string) => {
    setOcupado(true)
    const resultado = await accion()
    setOcupado(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo completar la acción.'); return }
    onAccion(mensaje)
  }

  return (
    <div className="space-y-6">
      <ErrorFormulario mensaje={error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-stone-400">{orden.codigo}</p>
          <p className="text-lg font-semibold text-stone-900">{producto?.nombre ?? 'Producto inactivo'}</p>
          <div className="mt-1"><InsigniaOrden estado={orden.estado} /></div>
        </div>
        {ordenAbierta(orden) && !cancelando && (
          <div className="flex flex-wrap gap-2">
            {orden.estado === 'pendiente' && (
              <>
                <button type="button" onClick={onEditar} className={claseBotonSecundario}><Pencil size={15} />Editar</button>
                <button type="button" disabled={ocupado} onClick={() => ejecutar(() => iniciarOrden(orden.id), 'Orden en proceso')} className={claseBotonSecundario}><Play size={15} />Iniciar</button>
              </>
            )}
            <button type="button" onClick={() => setCancelando(true)} className={claseBotonSecundario}><XCircle size={15} />Cancelar</button>
            <button type="button" onClick={onCompletar} className={claseBotonPrimario}><CheckCircle2 size={15} />Completar</button>
          </div>
        )}
      </div>

      {cancelando && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
          <p className="text-sm text-red-800">¿Cancelar esta orden? No se moverá inventario.</p>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (opcional)" className={claseInput} aria-label="Motivo de cancelación" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCancelando(false)} className={claseBotonSecundario}>Volver</button>
            <button type="button" disabled={ocupado} onClick={() => ejecutar(() => cancelarOrden(orden.id, motivo), 'Orden cancelada')} className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition disabled:opacity-50">
              Cancelar orden
            </button>
          </div>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Planificado" valor={`${formatoCantidad(orden.cantidadPlanificada)} und`} />
        <DatoDetalle etiqueta="Producido" valor={orden.estado === 'completada' ? `${formatoCantidad(orden.cantidadProducida)} und` : ''} />
        <DatoDetalle etiqueta="Responsable" valor={responsable ? responsable.nombre : ''} />
        <DatoDetalle etiqueta="Programada" valor={orden.fechaProgramada ? formatoFecha(orden.fechaProgramada) : ''} />
        <DatoDetalle etiqueta="Inicio" valor={orden.fechaInicio ? formatoFecha(orden.fechaInicio) : ''} />
        <DatoDetalle etiqueta="Finalización" valor={orden.fechaFin ? formatoFecha(orden.fechaFin) : ''} />
        {orden.estado === 'completada' && (
          <>
            <DatoDetalle etiqueta="Costo de materia prima" valor={formatoCordobas(orden.costoMateriales)} />
            <DatoDetalle etiqueta="Costo por unidad" valor={formatoCordobas(costoUnitarioOrden(orden))} />
          </>
        )}
      </dl>

      {orden.observaciones && (
        <div>
          <p className="text-xs text-stone-500 mb-1">Observaciones</p>
          <p className="text-sm text-stone-700 whitespace-pre-line">{orden.observaciones}</p>
        </div>
      )}

      {orden.estado === 'completada' ? (
        <div>
          <h3 className="text-sm font-semibold text-stone-900 mb-2">Materia prima consumida</h3>
          {orden.consumos.length === 0 ? (
            <p className="text-sm text-stone-400">No se registró consumo de materia prima.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-200">
              <table className="w-full min-w-[520px]">
                <thead className="bg-stone-50">
                  <tr>
                    <th className={claseCabeceraTabla}>Materia prima</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Teórico</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Real</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Diferencia</th>
                    <th className={`${claseCabeceraTabla} text-right`}>Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {orden.consumos.map((c) => {
                    const materia = porId.get(c.materiaPrimaId)
                    const unidad = materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''
                    const diferencia = c.cantidadReal - c.cantidadTeorica
                    return (
                      <tr key={c.materiaPrimaId}>
                        <td className={claseCeldaTabla}>{materia?.nombre ?? 'Materia prima inactiva'}</td>
                        <td className={`${claseCeldaTabla} text-right text-stone-500`}>{formatoCantidad(c.cantidadTeorica)} {unidad}</td>
                        <td className={`${claseCeldaTabla} text-right font-medium`}>{formatoCantidad(c.cantidadReal)} {unidad}</td>
                        <td className={`${claseCeldaTabla} text-right ${diferencia > 0 ? 'text-red-600' : diferencia < 0 ? 'text-emerald-700' : 'text-stone-400'}`}>
                          {diferencia > 0 ? '+' : ''}{formatoCantidad(Math.round(diferencia * 1000) / 1000)}
                        </td>
                        <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(c.subtotal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : ordenAbierta(orden) && (
        <div>
          <h3 className="text-sm font-semibold text-stone-900 mb-2">Materia prima requerida</h3>
          {tieneMateriaDefinida(receta) ? (
            <TablaRequerimientos lineas={requerimientos(receta, orden.cantidadPlanificada, materiasPrimas)} cantidad={orden.cantidadPlanificada} />
          ) : (
            <p className="text-sm text-amber-700">El producto no tiene receta definida.</p>
          )}
        </div>
      )}
    </div>
  )
}
