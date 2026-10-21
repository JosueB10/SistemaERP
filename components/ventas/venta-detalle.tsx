'use client'

import { useState } from 'react'
import { useInventario } from '@/lib/inventario/store'
import { formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { anularVenta, useVentas } from '@/lib/ventas/store'
import type { Venta } from '@/lib/ventas/tipos'
import { ETIQUETAS_ESTADO_VENTA, ETIQUETAS_METODO_PAGO, margenVenta } from '@/lib/ventas/utilidades'
import { claseCabeceraTabla, claseCeldaTabla, ErrorFormulario } from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'
import { ConfirmarAnulacion, InsigniaDocumento, ResumenTotales } from './ui'

export default function VentaDetalle({ venta, onAccion }: { venta: Venta; onAccion: (mensaje: string) => void }) {
  const { productos } = useInventario()
  const { clientes } = useVentas()
  const [error, setError] = useState<string | null>(null)

  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const cliente = clientes.find((c) => c.id === venta.clienteId)
  const fabricadas = venta.lineas.reduce((total, l) => total + l.fabricadas, 0)
  const anulada = venta.estado === 'anulada'

  const anular = async (motivo: string) => {
    const resultado = await anularVenta(venta.id, motivo)
    if (!resultado.ok) { setError(resultado.error); return }
    onAccion(`Venta ${venta.codigo} anulada`)
  }

  return (
    <div className="space-y-6">
      <ErrorFormulario mensaje={error} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-stone-400">{venta.codigo}</p>
          <p className="text-lg font-semibold text-stone-900">{cliente?.nombre ?? 'Cliente de contado'}</p>
          <div className="mt-1"><InsigniaDocumento anulado={anulada} texto={ETIQUETAS_ESTADO_VENTA[venta.estado]} /></div>
        </div>
        {!anulada && (
          <ConfirmarAnulacion
            aviso="¿Anular esta venta? Los productos volverán al stock terminado y se eliminará el ingreso registrado."
            textoBoton="Anular venta"
            onConfirmar={anular}
          />
        )}
      </div>

      {anulada && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Anulada{venta.anuladaEn ? ` el ${formatoFecha(venta.anuladaEn)}` : ''}{venta.motivoAnulacion ? `: ${venta.motivoAnulacion}` : '.'}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Fecha" valor={formatoFecha(venta.fecha)} />
        <DatoDetalle etiqueta="Método de pago" valor={venta.metodoPago ? ETIQUETAS_METODO_PAGO[venta.metodoPago] : ''} />
        <DatoDetalle etiqueta="Cédula o RUC" valor={cliente?.identificacion} />
        <DatoDetalle etiqueta="Costo de lo vendido" valor={formatoCordobas(venta.costoTotal)} />
        <DatoDetalle etiqueta="Margen bruto" valor={formatoCordobas(margenVenta(venta))} />
        <DatoDetalle etiqueta="Fabricadas al vender" valor={fabricadas ? `${formatoCantidad(fabricadas)} und` : 'Ninguna'} />
      </dl>

      <div className="overflow-x-auto rounded-lg border border-stone-200">
        <table className="w-full min-w-[520px]">
          <thead className="bg-stone-50">
            <tr>
              <th className={claseCabeceraTabla}>Producto</th>
              <th className={`${claseCabeceraTabla} text-right`}>Cantidad</th>
              <th className={`${claseCabeceraTabla} text-right`}>Precio</th>
              <th className={`${claseCabeceraTabla} text-right`}>Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {venta.lineas.map((linea) => {
              const producto = productoPorId.get(linea.productoId)
              return (
                <tr key={linea.productoId}>
                  <td className={claseCeldaTabla}>
                    <span className="font-mono text-xs text-stone-400 mr-2">{producto?.sku ?? '—'}</span>
                    {producto?.nombre ?? 'Producto inactivo'}
                    {linea.fabricadas > 0 && <span className="ml-2 text-xs text-amber-700">({formatoCantidad(linea.fabricadas)} fabricada(s))</span>}
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(linea.cantidad)}</td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.precioUnitario)}</td>
                  <td className={`${claseCeldaTabla} text-right font-medium text-stone-900`}>{formatoCordobas(linea.subtotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
        <div className="sm:max-w-xs">
          {venta.observaciones && (
            <>
              <p className="text-xs text-stone-500 mb-1">Observaciones</p>
              <p className="text-sm text-stone-700 whitespace-pre-line">{venta.observaciones}</p>
            </>
          )}
        </div>
        <div className="sm:w-72">
          <ResumenTotales subtotal={venta.subtotal} descuento={venta.descuento} impuesto={venta.impuesto} total={venta.total} />
        </div>
      </div>
    </div>
  )
}
