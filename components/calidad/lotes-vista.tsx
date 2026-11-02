'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Eye, PackageCheck, PackageX, ShieldAlert } from 'lucide-react'

import { useCalidad } from '@/lib/calidad/store'
import type { EstadoLote, Lote } from '@/lib/calidad/tipos'
import { CRITERIOS_INSPECCION, ETIQUETAS_ESTADO_LOTE, porcentajeAprobacion } from '@/lib/calidad/utilidades'
import { useInventario } from '@/lib/inventario/store'
import { coincideBusqueda, formatoCantidad, formatoFecha } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { codigoOrden, formatoPorcentaje } from '@/lib/produccion/utilidades'
import { useVentas } from '@/lib/ventas/store'
import {
  AvisoConexion,
  Buscador,
  claseBotonPrimario,
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
  useDetalleEnUrl,
  useNotificacion,
  usePaginacion
} from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'
import InspeccionFormulario from './inspeccion-formulario'
import { AvisoConexionCalidad, InsigniaLote, InsigniaNc, SECCION_CALIDAD } from './ui'

export default function LotesVista() {
  const { productos } = useInventario()
  const { lotes, noConformidades } = useCalidad()
  const { mensaje, mostrar } = useNotificacion()
  const { detalleId, abrirDetalle, cerrarDetalle } = useDetalleEnUrl()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<EstadoLote | ''>('')
  const [inspeccionando, setInspeccionando] = useState(false)

  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const filtrados = lotes.filter((l) =>
    (!filtro || l.estado === filtro) &&
    coincideBusqueda(busqueda, l.codigo, codigoOrden(l.ordenId), productoPorId.get(l.productoId)?.nombre)
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtrados, 12)

  const inspeccionados = lotes.filter((l) => l.estado !== 'en_inspeccion')
  const aprobadas = inspeccionados.reduce((t, l) => t + l.cantidadAprobada, 0)
  const totalInspeccionado = inspeccionados.reduce((t, l) => t + l.cantidad, 0)
  const pendientes = lotes.filter((l) => l.estado === 'en_inspeccion')
  const ncAbiertas = noConformidades.filter((n) => n.estado !== 'cerrada').length

  const lote = lotes.find((l) => l.id === detalleId)
  const cerrar = () => { setInspeccionando(false); cerrarDetalle() }

  return (
    <>
      <AvisoConexion />
      <AvisoConexionCalidad />
      <EncabezadoPagina
        titulo="Lotes de producción"
        descripcion="Cada orden cerrada genera un lote. Calidad lo inspecciona: las unidades rechazadas salen del stock y abren una no conformidad."
        seccion={SECCION_CALIDAD}
        migas={false}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <TarjetaIndicador titulo="Por inspeccionar" valor={String(pendientes.length)} detalle={`${formatoCantidad(pendientes.reduce((t, l) => t + l.cantidad, 0))} und en espera`} icono={ClipboardCheck} tono={pendientes.length ? 'alerta' : 'neutro'} />
        <TarjetaIndicador titulo="Tasa de aprobación" valor={totalInspeccionado ? formatoPorcentaje(porcentajeAprobacion(aprobadas, totalInspeccionado)) : '—'} detalle={`${formatoCantidad(aprobadas)} de ${formatoCantidad(totalInspeccionado)} und inspeccionadas`} icono={PackageCheck} tono="positivo" />
        <TarjetaIndicador titulo="Unidades rechazadas" valor={formatoCantidad(totalInspeccionado - aprobadas)} detalle="En inspección final de lotes" icono={PackageX} tono={totalInspeccionado - aprobadas ? 'peligro' : 'neutro'} />
        <TarjetaIndicador titulo="No conformidades abiertas" valor={String(ncAbiertas)} detalle="Pendientes de análisis o cierre" icono={ShieldAlert} tono={ncAbiertas ? 'alerta' : 'neutro'} />
      </div>

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center">
          <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar lote, orden o producto" />
          <select value={filtro} onChange={(e) => { setFiltro(e.target.value as EstadoLote | ''); setPagina(1) }} className={`${claseInput} sm:w-48 sm:ml-auto`} aria-label="Filtrar por estado">
            <option value="">Todos los estados</option>
            {(Object.keys(ETIQUETAS_ESTADO_LOTE) as EstadoLote[]).map((e) => <option key={e} value={e}>{ETIQUETAS_ESTADO_LOTE[e]}</option>)}
          </select>
        </div>
        {filtrados.length === 0 ? (
          <EstadoVacio icono={PackageCheck} titulo={lotes.length ? 'No hay lotes que coincidan' : 'Aún no hay lotes'} descripcion={lotes.length ? undefined : 'Se crean al cerrar órdenes de producción.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>Lote</th>
                  <th className={claseCabeceraTabla}>Producto</th>
                  <th className={claseCabeceraTabla}>Orden</th>
                  <th className={claseCabeceraTabla}>Producido</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Cantidad</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Aprob. / rech.</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visibles.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-50/60">
                    <td className={`${claseCeldaTabla} font-mono text-xs`}>{l.codigo}</td>
                    <td className={`${claseCeldaTabla} font-medium text-zinc-900`}>{productoPorId.get(l.productoId)?.nombre ?? 'Producto inactivo'}</td>
                    <td className={`${claseCeldaTabla} font-mono text-xs`}>
                      <Link href={`/produccion?detalle=${encodeURIComponent(l.ordenId)}`} className="underline">{codigoOrden(l.ordenId)}</Link>
                    </td>
                    <td className={claseCeldaTabla}>{formatoFecha(l.fechaProduccion)}</td>
                    <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(l.cantidad)}</td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      {l.estado === 'en_inspeccion' ? '—' : <>{formatoCantidad(l.cantidadAprobada)} / <span className={l.cantidadRechazada ? 'text-red-600' : 'text-zinc-400'}>{formatoCantidad(l.cantidadRechazada)}</span></>}
                    </td>
                    <td className={claseCeldaTabla}><InsigniaLote estado={l.estado} /></td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      <button type="button" onClick={() => abrirDetalle(l.id)} className={claseBotonTabla}>
                        {l.estado === 'en_inspeccion' ? <><ClipboardCheck size={14} />Inspeccionar</> : <><Eye size={14} />Ver</>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtrados.length} onCambiar={setPagina} />
      </div>

      <Modal abierto={Boolean(lote)} titulo={lote ? `Lote ${lote.codigo}` : 'Lote'} descripcion={lote ? productoPorId.get(lote.productoId)?.nombre : undefined} onCerrar={cerrar} ancho="max-w-3xl">
        {lote && (inspeccionando ? (
          <InspeccionFormulario
            lote={lote}
            personalizado={productoPorId.get(lote.productoId)?.tipo === 'personalizado'}
            onCancelar={() => setInspeccionando(false)}
            onGuardado={(texto) => { cerrar(); mostrar(texto) }}
          />
        ) : (
          <DetalleLote lote={lote} onInspeccionar={() => setInspeccionando(true)} />
        ))}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function DetalleLote({ lote, onInspeccionar }: { lote: Lote; onInspeccionar: () => void }) {
  const { noConformidades } = useCalidad()
  const { responsables, ordenes } = useProduccion()
  const { ventas } = useVentas()
  const orden = ordenes.find((o) => o.id === lote.ordenId)
  const inspector = responsables.find((r) => r.id === lote.inspectorId)
  const ncs = noConformidades.filter((n) => n.loteId === lote.id || (n.ordenId === lote.ordenId && n.origen === 'proceso'))
  // Trazabilidad hacia adelante: ventas despachadas con este lote
  const despachos = ventas.filter((v) => v.lotesDespacho?.toUpperCase().includes(lote.codigo.toUpperCase()))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InsigniaLote estado={lote.estado} />
        {lote.estado === 'en_inspeccion' && (
          <button type="button" onClick={onInspeccionar} className={claseBotonPrimario}><ClipboardCheck size={15} />Inspeccionar lote</button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Orden" valor={<Link href={`/produccion?detalle=${encodeURIComponent(lote.ordenId)}`} className="font-mono underline">{codigoOrden(lote.ordenId)}</Link>} />
        <DatoDetalle etiqueta="Fecha de producción" valor={formatoFecha(lote.fechaProduccion)} />
        <DatoDetalle etiqueta="Cantidad" valor={`${formatoCantidad(lote.cantidad)} und`} />
        <DatoDetalle etiqueta="Aprobadas" valor={lote.estado === 'en_inspeccion' ? '' : `${formatoCantidad(lote.cantidadAprobada)} und`} />
        <DatoDetalle etiqueta="Rechazadas" valor={lote.estado === 'en_inspeccion' ? '' : `${formatoCantidad(lote.cantidadRechazada)} und`} />
        <DatoDetalle etiqueta="Inspección" valor={lote.fechaInspeccion ? `${formatoFecha(lote.fechaInspeccion)}${inspector ? ` · ${inspector.nombre}` : ''}` : ''} />
        {orden && orden.operaciones.length > 0 && (
          <DatoDetalle etiqueta="Rechazos en proceso" valor={`${formatoCantidad(orden.operaciones.reduce((t, o) => t + o.cantidadRechazada, 0))} und en ${orden.operaciones.length} operaciones`} />
        )}
      </dl>

      {lote.estado !== 'en_inspeccion' && Object.keys(lote.criterios).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 mb-2">Lista de verificación</h3>
          <ul className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {CRITERIOS_INSPECCION.filter((c) => c.clave in lote.criterios).map((c) => (
              <li key={c.clave} className={lote.criterios[c.clave] ? 'text-emerald-700' : 'text-red-600'}>
                {lote.criterios[c.clave] ? '✓' : '✗'} {c.etiqueta}
              </li>
            ))}
          </ul>
        </div>
      )}

      {lote.observaciones && <p className="text-sm text-zinc-700 whitespace-pre-line">{lote.observaciones}</p>}

      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">No conformidades</h3>
        {ncs.length === 0 ? (
          <p className="text-sm text-zinc-400">Sin no conformidades.</p>
        ) : (
          <ul className="space-y-1.5">
            {ncs.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/calidad/no-conformidades?detalle=${encodeURIComponent(n.id)}`} className="font-mono text-xs underline">{n.codigo}</Link>
                <span className="text-zinc-700">{n.tipoDefecto} · {formatoCantidad(n.cantidadAfectada)} und</span>
                <InsigniaNc estado={n.estado} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-900 mb-2">Trazabilidad: despachos</h3>
        {despachos.length === 0 ? (
          <p className="text-sm text-zinc-400">Ningún despacho registrado con este lote.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {despachos.map((v) => (
              <li key={v.id}>
                <Link href={`/ventas?detalle=${encodeURIComponent(v.id)}`} className="font-mono text-xs underline">{v.codigo}</Link>
                <span className="text-zinc-600"> · despachada {v.fechaDespacho ? formatoFecha(v.fechaDespacho) : ''}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
