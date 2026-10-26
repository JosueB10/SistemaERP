'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, Factory } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { formatoCantidad, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { ETIQUETAS_ESTADO_ORDEN, ordenAbierta } from '@/lib/produccion/utilidades'
import { anularVenta, completarVenta, useVentas } from '@/lib/ventas/store'
import type { Venta } from '@/lib/ventas/tipos'
import { ETIQUETAS_ESTADO_VENTA, ETIQUETAS_METODO_PAGO, margenVenta } from '@/lib/ventas/utilidades'
import { claseBotonPrimario, claseCabeceraTabla, claseCeldaTabla, ErrorFormulario } from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'
import { ConfirmarAnulacion, InsigniaDocumento, ResumenTotales } from './ui'

export default function VentaDetalle({ venta, onAccion }: { venta: Venta; onAccion: (mensaje: string) => void }) {
  const { productos } = useInventario()
  const { clientes, ventas } = useVentas()
  const { ordenes } = useProduccion()
  const [error, setError] = useState<string | null>(null)
  const [completando, setCompletando] = useState(false)

  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const cliente = clientes.find((c) => c.id === venta.clienteId)
  const fabricadas = venta.lineas.reduce((total, l) => total + l.fabricadas, 0)
  const anulada = venta.estado === 'anulada'
  const pendiente = venta.estado === 'pendiente'
  const ordenesVenta = ordenes.filter((o) => o.ventaId === venta.id)

  // Las ventas pendientes más antiguas tienen prioridad sobre el stock (igual que completar_venta)
  const faltantes = pendiente
    ? venta.lineas.map((linea) => {
        const apartadas = ventas
          .filter((v) => v.estado === 'pendiente' && Number(v.id) < Number(venta.id))
          .reduce((t, v) => t + (v.lineas.find((l) => l.productoId === linea.productoId)?.cantidad ?? 0), 0)
        const disponible = Math.max(0, (productoPorId.get(linea.productoId)?.existencias ?? 0) - apartadas)
        const ordenAbiertaProducto = ordenesVenta.find((o) => o.productoId === linea.productoId && ordenAbierta(o))
        return { linea, disponible, falta: Math.max(0, linea.cantidad - disponible), ordenAbiertaProducto }
      })
    : []
  const listaParaCompletar = pendiente && faltantes.every((f) => f.falta === 0)

  const completar = async () => {
    setCompletando(true)
    const resultado = await completarVenta(venta.id)
    setCompletando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onAccion(`Venta ${venta.codigo} completada: se descontó el inventario y se registró el ingreso`)
  }

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
          <p className="font-mono text-xs text-zinc-400">{venta.codigo}</p>
          <p className="text-lg font-semibold text-zinc-900">{cliente?.nombre ?? 'Cliente de contado'}</p>
          <div className="mt-1"><InsigniaDocumento anulado={anulada} pendiente={pendiente} texto={ETIQUETAS_ESTADO_VENTA[venta.estado]} /></div>
        </div>
        {!anulada && (
          <div className="flex flex-wrap gap-2">
            {pendiente && (
              <button type="button" onClick={completar} disabled={!listaParaCompletar || completando} title={listaParaCompletar ? undefined : 'Aún falta producir'} className={claseBotonPrimario}>
                <CheckCircle2 size={15} />
                {completando ? 'Completando...' : 'Completar venta'}
              </button>
            )}
          <ConfirmarAnulacion
            aviso={pendiente
              ? '¿Anular esta venta pendiente? No se movió inventario ni dinero; se cancelarán sus órdenes de producción que no se hayan iniciado.'
              : '¿Anular esta venta? Los productos volverán al stock terminado y se eliminará el ingreso registrado.'}
            textoBoton="Anular venta"
            onConfirmar={anular}
          />
          </div>
        )}
      </div>

      {anulada && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          Anulada{venta.anuladaEn ? ` el ${formatoFecha(venta.anuladaEn)}` : ''}{venta.motivoAnulacion ? `: ${venta.motivoAnulacion}` : '.'}
        </div>
      )}

      {pendiente && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
          <p className="flex items-start gap-2 text-sm text-amber-800">
            <Clock size={16} className="mt-0.5 shrink-0" />
            {listaParaCompletar
              ? 'Ya hay producto suficiente. Pulse «Completar venta» para descontar el inventario y registrar el ingreso.'
              : 'Venta pendiente de producción: aún no se descontó inventario ni se registró el ingreso. Se completará sola al terminar la orden de producción.'}
          </p>
          <ul className="space-y-2">
            {faltantes.map(({ linea, disponible, falta, ordenAbiertaProducto }) => {
              const producto = productoPorId.get(linea.productoId)
              return (
                <li key={linea.productoId} className="flex flex-col gap-1 rounded-md bg-white/70 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-zinc-800">
                    {producto?.nombre ?? 'Producto inactivo'}: {formatoCantidad(disponible)} de {formatoCantidad(linea.cantidad)} disponibles
                    {falta > 0 ? <span className="font-medium text-amber-800"> · faltan {formatoCantidad(falta)}</span> : <span className="font-medium text-emerald-700"> · listo</span>}
                  </span>
                  {falta > 0 && (ordenAbiertaProducto ? (
                    <Link href={`/produccion?detalle=${encodeURIComponent(ordenAbiertaProducto.id)}`} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 underline">
                      <Factory size={13} />
                      {ordenAbiertaProducto.codigo} · {ETIQUETAS_ESTADO_ORDEN[ordenAbiertaProducto.estado]}
                    </Link>
                  ) : (
                    <Link href={`/produccion?nueva=${encodeURIComponent(linea.productoId)}&cantidad=${falta}&venta=${encodeURIComponent(venta.id)}`} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-700 underline">
                      <Factory size={13} />
                      Crear orden de producción
                    </Link>
                  ))}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Fecha" valor={formatoFecha(venta.fecha)} />
        <DatoDetalle etiqueta="Método de pago" valor={venta.metodoPago ? ETIQUETAS_METODO_PAGO[venta.metodoPago] : ''} />
        <DatoDetalle etiqueta="Cédula o RUC" valor={cliente?.identificacion} />
        <DatoDetalle etiqueta="Costo de lo vendido" valor={formatoCordobas(venta.costoTotal)} />
        <DatoDetalle etiqueta="Margen bruto" valor={formatoCordobas(margenVenta(venta))} />
        {fabricadas > 0 && <DatoDetalle etiqueta="Fabricadas al vender" valor={`${formatoCantidad(fabricadas)} und`} />}
        {venta.completadaEn && venta.lineas.some((l) => l.porProducir > 0) && (
          <DatoDetalle etiqueta="Completada" valor={formatoFecha(venta.completadaEn)} />
        )}
      </dl>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[520px]">
          <thead className="bg-zinc-50/70">
            <tr>
              <th className={claseCabeceraTabla}>Producto</th>
              <th className={`${claseCabeceraTabla} text-right`}>Cantidad</th>
              <th className={`${claseCabeceraTabla} text-right`}>Precio</th>
              <th className={`${claseCabeceraTabla} text-right`}>Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {venta.lineas.map((linea) => {
              const producto = productoPorId.get(linea.productoId)
              return (
                <tr key={linea.productoId}>
                  <td className={claseCeldaTabla}>
                    <span className="font-mono text-xs text-zinc-400 mr-2">{producto?.sku ?? '—'}</span>
                    {producto?.nombre ?? 'Producto inactivo'}
                    {linea.fabricadas > 0 && <span className="ml-2 text-xs text-amber-700">({formatoCantidad(linea.fabricadas)} fabricada(s))</span>}
                    {linea.porProducir > 0 && <span className="ml-2 text-xs text-amber-700">({formatoCantidad(linea.porProducir)} por producir al registrar)</span>}
                  </td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(linea.cantidad)}</td>
                  <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(linea.precioUnitario)}</td>
                  <td className={`${claseCeldaTabla} text-right font-medium text-zinc-900`}>{formatoCordobas(linea.subtotal)}</td>
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
              <p className="text-xs text-zinc-500 mb-1">Observaciones</p>
              <p className="text-sm text-zinc-700 whitespace-pre-line">{venta.observaciones}</p>
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
