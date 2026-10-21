'use client'

import { useState } from 'react'

import { anularCompra, useCompras } from '@/lib/compras/store'
import type { Compra } from '@/lib/compras/tipos'
import { ETIQUETAS_ESTADO_COMPRA } from '@/lib/compras/utilidades'
import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { ETIQUETAS_METODO_PAGO } from '@/lib/ventas/utilidades'
import { claseCabeceraTabla, claseCeldaTabla, ErrorFormulario } from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'
import { ConfirmarAnulacion, InsigniaDocumento, ResumenTotales } from '../ventas/ui'

export default function CompraDetalle({ compra, onAccion }: { compra: Compra; onAccion: (mensaje: string) => void }) {
  const { materiasPrimas } = useInventario()
  const { proveedores } = useCompras()
  const [error, setError] = useState<string | null>(null)

  const materiaPorId = new Map(materiasPrimas.map((m) => [m.id, m]))
  const proveedor = proveedores.find((p) => p.id === compra.proveedorId)
  const anulada = compra.estado === 'anulada'

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
          <p className="font-mono text-xs text-stone-400">{compra.codigo}</p>
          <p className="text-lg font-semibold text-stone-900">{proveedor?.nombre ?? 'Proveedor eliminado'}</p>
          <div className="mt-1"><InsigniaDocumento anulado={anulada} texto={ETIQUETAS_ESTADO_COMPRA[compra.estado]} /></div>
        </div>
        {!anulada && (
          <ConfirmarAnulacion
            aviso="¿Anular esta compra? La materia prima se retirará del inventario (debe seguir en stock) y se eliminará el gasto. El costo unitario no se revierte."
            textoBoton="Anular compra"
            onConfirmar={anular}
          />
        )}
      </div>

      {anulada && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Anulada{compra.anuladaEn ? ` el ${formatoFecha(compra.anuladaEn)}` : ''}{compra.motivoAnulacion ? `: ${compra.motivoAnulacion}` : '.'}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Fecha" valor={formatoFecha(compra.fecha)} />
        <DatoDetalle etiqueta="Factura del proveedor" valor={compra.numeroFactura} />
        <DatoDetalle etiqueta="Método de pago" valor={compra.metodoPago ? ETIQUETAS_METODO_PAGO[compra.metodoPago] : ''} />
        <DatoDetalle etiqueta="RUC" valor={proveedor?.ruc} />
        <DatoDetalle etiqueta="Registrada" valor={compra.registradoEn ? formatoFecha(compra.registradoEn) : ''} />
      </dl>

      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[520px]">
          <thead className="bg-stone-50">
            <tr>
              <th className={claseCabeceraTabla}>Materia prima</th>
              <th className={`${claseCabeceraTabla} text-right`}>Cantidad</th>
              <th className={`${claseCabeceraTabla} text-right`}>Costo unitario</th>
              <th className={`${claseCabeceraTabla} text-right`}>Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {compra.lineas.map((linea) => {
              const materia = materiaPorId.get(linea.materiaPrimaId)
              return (
                <tr key={linea.materiaPrimaId}>
                  <td className={claseCeldaTabla}>
                    <span className="font-mono text-xs text-stone-400 mr-2">{materia?.codigo ?? '—'}</span>
                    {materia?.nombre ?? 'Materia prima inactiva'}
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(linea.cantidad)} {materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''}</td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.costoUnitario)}</td>
                  <td className={`${claseCeldaTabla} text-right font-medium text-stone-900`}>{formatoCordobas(linea.subtotal)}</td>
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
              <p className="text-xs text-stone-500 mb-1">Observaciones</p>
              <p className="text-sm text-stone-700 whitespace-pre-line">{compra.observaciones}</p>
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
