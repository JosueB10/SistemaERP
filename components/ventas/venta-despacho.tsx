'use client'

import { useState } from 'react'
import { PackageCheck, Truck } from 'lucide-react'

import { useCalidad } from '@/lib/calidad/store'
import { fechaHoy, formatoFecha } from '@/lib/inventario/utilidades'
import { confirmarEntrega, registrarDespacho, useVentas } from '@/lib/ventas/store'
import type { Venta } from '@/lib/ventas/tipos'
import { ETIQUETAS_ESTADO_DESPACHO } from '@/lib/ventas/utilidades'
import { Campo, claseBotonPrimario, claseBotonSecundario, claseInput, ErrorFormulario } from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'

// Logística de una venta completada: despacho (guía, transportista, lotes enviados) y entrega al cliente
export default function VentaDespacho({ venta, onAccion }: { venta: Venta; onAccion: (mensaje: string) => void }) {
  const { clientes } = useVentas()
  const { lotes } = useCalidad()
  const cliente = clientes.find((c) => c.id === venta.clienteId)
  const [formulario, setFormulario] = useState<'despacho' | 'entrega' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  // Lotes aprobados de los productos vendidos, del más antiguo al más nuevo (FIFO)
  const productos = new Set(venta.lineas.map((l) => l.productoId))
  const lotesSugeridos = lotes
    .filter((l) => productos.has(l.productoId) && (l.estado === 'aprobado' || l.estado === 'aprobado_parcial'))
    .sort((a, b) => a.fechaProduccion.localeCompare(b.fechaProduccion))
  const lotesPendientes = lotes.filter((l) => productos.has(l.productoId) && l.estado === 'en_inspeccion')

  const [despacho, setDespacho] = useState({
    fecha: fechaHoy(),
    guia: '',
    transportista: '',
    direccion: cliente?.direccion ?? '',
    lotes: lotesSugeridos.slice(-3).map((l) => l.codigo).join(', ')
  })
  const [entrega, setEntrega] = useState({ fecha: fechaHoy(), recibidoPor: cliente?.nombre ?? '' })

  const ejecutar = async (accion: () => Promise<{ ok: boolean; error?: string }>, mensaje: string) => {
    setOcupado(true)
    const resultado = await accion()
    setOcupado(false)
    if (!resultado.ok) { setError(resultado.error ?? 'No se pudo guardar.'); return }
    setFormulario(null)
    onAccion(mensaje)
  }

  if (venta.estado !== 'completada') return null

  return (
    <div className="rounded-lg border border-zinc-200 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900"><Truck size={15} className="text-zinc-400" />Despacho · {ETIQUETAS_ESTADO_DESPACHO[venta.estadoDespacho]}</h3>
        {!formulario && venta.estadoDespacho === 'por_despachar' && (
          <button type="button" onClick={() => { setError(null); setFormulario('despacho') }} className={claseBotonSecundario}><Truck size={15} />Registrar despacho</button>
        )}
        {!formulario && venta.estadoDespacho === 'despachada' && (
          <button type="button" onClick={() => { setError(null); setFormulario('entrega') }} className={claseBotonSecundario}><PackageCheck size={15} />Confirmar entrega</button>
        )}
      </div>

      <ErrorFormulario mensaje={error} />

      {venta.estadoDespacho !== 'por_despachar' && (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <DatoDetalle etiqueta="Despachada" valor={venta.fechaDespacho ? formatoFecha(venta.fechaDespacho) : ''} />
          <DatoDetalle etiqueta="Guía" valor={venta.guiaDespacho} />
          <DatoDetalle etiqueta="Transportista" valor={venta.transportista} />
          <DatoDetalle etiqueta="Dirección de entrega" valor={venta.direccionEntrega} />
          <DatoDetalle etiqueta="Lotes enviados" valor={venta.lotesDespacho ? <span className="font-mono text-xs">{venta.lotesDespacho}</span> : ''} />
          <DatoDetalle etiqueta="Entregada" valor={venta.fechaEntrega ? `${formatoFecha(venta.fechaEntrega)}${venta.recibidoPor ? ` · recibió ${venta.recibidoPor}` : ''}` : ''} />
        </dl>
      )}

      {formulario === 'despacho' && (
        <div className="space-y-3">
          {lotesPendientes.length > 0 && (
            <p className="text-xs text-amber-700">Hay {lotesPendientes.length} lote(s) de estos productos aún en inspección de calidad: despache solo lotes aprobados.</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etiqueta="Fecha de despacho" htmlFor="desp-fecha">
              <input id="desp-fecha" type="date" max={fechaHoy()} min={venta.fecha} value={despacho.fecha} onChange={(e) => setDespacho((a) => ({ ...a, fecha: e.target.value }))} className={claseInput} />
            </Campo>
            <Campo etiqueta="N.º de guía" htmlFor="desp-guia">
              <input id="desp-guia" value={despacho.guia} onChange={(e) => setDespacho((a) => ({ ...a, guia: e.target.value }))} placeholder="Opcional" className={claseInput} />
            </Campo>
            <Campo etiqueta="Transportista" htmlFor="desp-transportista">
              <input id="desp-transportista" value={despacho.transportista} onChange={(e) => setDespacho((a) => ({ ...a, transportista: e.target.value }))} placeholder="Retira en tienda, mensajería..." className={claseInput} />
            </Campo>
            <Campo etiqueta="Dirección de entrega" htmlFor="desp-direccion">
              <input id="desp-direccion" value={despacho.direccion} onChange={(e) => setDespacho((a) => ({ ...a, direccion: e.target.value }))} className={claseInput} />
            </Campo>
            <Campo etiqueta="Lotes enviados" htmlFor="desp-lotes" ayuda={lotesSugeridos.length ? `Aprobados: ${lotesSugeridos.map((l) => l.codigo).join(', ')}` : 'No hay lotes aprobados de estos productos'} className="sm:col-span-2">
              <input id="desp-lotes" value={despacho.lotes} onChange={(e) => setDespacho((a) => ({ ...a, lotes: e.target.value }))} className={`${claseInput} font-mono`} />
            </Campo>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormulario(null)} className={claseBotonSecundario}>Volver</button>
            <button type="button" disabled={ocupado} onClick={() => ejecutar(() => registrarDespacho(venta.id, despacho), `Venta ${venta.codigo} despachada`)} className={claseBotonPrimario}>
              <Truck size={15} />{ocupado ? 'Guardando...' : 'Registrar despacho'}
            </button>
          </div>
        </div>
      )}

      {formulario === 'entrega' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo etiqueta="Fecha de entrega" htmlFor="ent-fecha">
              <input id="ent-fecha" type="date" max={fechaHoy()} min={venta.fechaDespacho} value={entrega.fecha} onChange={(e) => setEntrega((a) => ({ ...a, fecha: e.target.value }))} className={claseInput} />
            </Campo>
            <Campo etiqueta="Recibido por" htmlFor="ent-recibe">
              <input id="ent-recibe" value={entrega.recibidoPor} onChange={(e) => setEntrega((a) => ({ ...a, recibidoPor: e.target.value }))} className={claseInput} />
            </Campo>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormulario(null)} className={claseBotonSecundario}>Volver</button>
            <button type="button" disabled={ocupado} onClick={() => ejecutar(() => confirmarEntrega(venta.id, entrega.fecha, entrega.recibidoPor), `Venta ${venta.codigo} entregada`)} className={claseBotonPrimario}>
              <PackageCheck size={15} />{ocupado ? 'Guardando...' : 'Confirmar entrega'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
