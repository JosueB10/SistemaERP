'use client'

import { useState } from 'react'

import { PackageCheck } from 'lucide-react'

import { anularCompra, recibirCompra, useCompras } from '@/lib/compras/store'
import type { Compra } from '@/lib/compras/tipos'
import { ETIQUETAS_ESTADO_COMPRA } from '@/lib/compras/utilidades'
import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, fechaHoy, formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { ETIQUETAS_METODO_PAGO } from '@/lib/ventas/utilidades'
import { Campo, claseBotonPrimario, claseBotonSecundario, claseCabeceraTabla, claseCeldaTabla, claseInput, ErrorFormulario } from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'
import { ConfirmarAnulacion, InsigniaDocumento, ResumenTotales } from '../ventas/ui'

export default function CompraDetalle({ compra, onAccion }: { compra: Compra; onAccion: (mensaje: string) => void }) {
  const { materiasPrimas } = useInventario()
  const { proveedores } = useCompras()
  const [error, setError] = useState<string | null>(null)

  const materiaPorId = new Map(materiasPrimas.map((m) => [m.id, m]))
  const proveedor = proveedores.find((p) => p.id === compra.proveedorId)
  const anulada = compra.estado === 'anulada'
  const pendiente = compra.estado === 'pendiente'
  const [recibiendo, setRecibiendo] = useState(false)
  const [fechaRecepcion, setFechaRecepcion] = useState(fechaHoy())
  const [obsRecepcion, setObsRecepcion] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const recibir = async () => {
    if (!fechaRecepcion || fechaRecepcion < compra.fecha || fechaRecepcion > fechaHoy()) { setError('La fecha de recepción debe estar entre la fecha de la compra y hoy.'); return }
    setOcupado(true)
    const resultado = await recibirCompra(compra.id, fechaRecepcion, obsRecepcion)
    setOcupado(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onAccion(`Compra ${compra.codigo} recibida: la materia prima entró al inventario`)
  }

  const anular = async (motivo: string) => {
    const resultado = await anularCompra(compra.id, motivo)
    if (!resultado.ok) { setError(resultado.error); return }
    onAccion(`Compra ${compra.codigo} anulada`)
  }

  return (
    <div className="space-y-6">
      <ErrorFormulario mensaje={error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-zinc-400">{compra.codigo}</p>
          <p className="text-lg font-semibold text-zinc-900">{proveedor?.nombre ?? 'Proveedor eliminado'}</p>
          <div className="mt-1"><InsigniaDocumento anulado={anulada} pendiente={pendiente} texto={ETIQUETAS_ESTADO_COMPRA[compra.estado]} /></div>
        </div>
        {!anulada && !recibiendo && (
          <div className="flex flex-wrap gap-2">
            {pendiente && (
              <button type="button" onClick={() => setRecibiendo(true)} className={claseBotonPrimario}><PackageCheck size={15} />Recibir mercadería</button>
            )}
            <ConfirmarAnulacion
              aviso={pendiente
                ? '¿Anular esta orden de compra? Aún no movió inventario ni gasto.'
                : '¿Anular esta compra? La materia prima se retirará del inventario (debe seguir en stock) y se eliminará el gasto. El costo unitario no se revierte.'}
              textoBoton="Anular compra"
              onConfirmar={anular}
            />
          </div>
        )}
      </div>

      {recibiendo && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
          <p className="text-sm text-emerald-900">
            Confirme que llegó la mercadería completa: la materia prima entra al inventario, se actualiza su costo y se registra el gasto.
            Si llegó material defectuoso, registre además una no conformidad de materia prima en Calidad.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Campo etiqueta="Fecha de recepción" htmlFor="recepcion-fecha">
              <input id="recepcion-fecha" type="date" min={compra.fecha} max={fechaHoy()} value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} className={claseInput} />
            </Campo>
            <Campo etiqueta="Observaciones de recepción" htmlFor="recepcion-obs" className="sm:col-span-2">
              <input id="recepcion-obs" value={obsRecepcion} onChange={(e) => setObsRecepcion(e.target.value)} placeholder="Estado del material, quién recibió..." className={claseInput} />
            </Campo>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRecibiendo(false)} className={claseBotonSecundario}>Volver</button>
            <button type="button" onClick={recibir} disabled={ocupado} className={claseBotonPrimario}><PackageCheck size={15} />{ocupado ? 'Recibiendo...' : 'Confirmar recepción'}</button>
          </div>
        </div>
      )}

      {anulada && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Anulada{compra.anuladaEn ? ` el ${formatoFecha(compra.anuladaEn)}` : ''}{compra.motivoAnulacion ? `: ${compra.motivoAnulacion}` : '.'}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Fecha" valor={formatoFecha(compra.fecha)} />
        <DatoDetalle etiqueta="Factura del proveedor" valor={compra.numeroFactura} />
        <DatoDetalle etiqueta="Método de pago" valor={compra.metodoPago ? ETIQUETAS_METODO_PAGO[compra.metodoPago] : ''} />
        <DatoDetalle etiqueta="RUC" valor={proveedor?.ruc} />
        <DatoDetalle etiqueta="Registrada" valor={compra.registradoEn ? formatoFecha(compra.registradoEn) : ''} />
        {pendiente && <DatoDetalle etiqueta="Entrega esperada" valor={compra.fechaEntregaEsperada ? formatoFecha(compra.fechaEntregaEsperada) : ''} />}
        {compra.fechaRecepcion && <DatoDetalle etiqueta="Recibida" valor={formatoFecha(compra.fechaRecepcion)} />}
        {compra.observacionesRecepcion && <DatoDetalle etiqueta="Nota de recepción" valor={compra.observacionesRecepcion} />}
      </dl>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[520px]">
          <thead className="bg-zinc-50/70">
            <tr>
              <th className={claseCabeceraTabla}>Materia prima</th>
              <th className={`${claseCabeceraTabla} text-right`}>Cantidad</th>
              <th className={`${claseCabeceraTabla} text-right`}>Costo unitario</th>
              <th className={`${claseCabeceraTabla} text-right`}>Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {compra.lineas.map((linea) => {
              const materia = materiaPorId.get(linea.materiaPrimaId)
              return (
                <tr key={linea.materiaPrimaId}>
                  <td className={claseCeldaTabla}>
                    <span className="font-mono text-xs text-zinc-400 mr-2">{materia?.codigo ?? '—'}</span>
                    {materia?.nombre ?? 'Materia prima inactiva'}
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(linea.cantidad)} {materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''}</td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.costoUnitario)}</td>
                  <td className={`${claseCeldaTabla} text-right font-medium text-zinc-900`}>{formatoCordobas(linea.subtotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div className="sm:max-w-xs">
          {compra.observaciones && (
            <>
              <p className="text-xs text-zinc-500 mb-1">Observaciones</p>
              <p className="text-sm text-zinc-700 whitespace-pre-line">{compra.observaciones}</p>
            </>
          )}
        </div>
        <div className="sm:w-72">
          <ResumenTotales subtotal={compra.subtotal} descuento={compra.descuento} impuesto={compra.impuesto} total={compra.total} />
        </div>
      </div>
    </div>
  )
}
