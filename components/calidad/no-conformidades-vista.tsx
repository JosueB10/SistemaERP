'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, Plus, ShieldAlert, ShieldCheck, Timer } from 'lucide-react'

import { actualizarNoConformidad, registrarNoConformidad, useCalidad } from '@/lib/calidad/store'
import type { DisposicionNc, EstadoNc, NoConformidad, OrigenNc, SeveridadNc } from '@/lib/calidad/tipos'
import {
  DEFECTOS_COMUNES,
  ETIQUETAS_DISPOSICION,
  ETIQUETAS_ESTADO_NC,
  ETIQUETAS_ORIGEN_NC,
  ETIQUETAS_SEVERIDAD
} from '@/lib/calidad/utilidades'
import { useInventario } from '@/lib/inventario/store'
import { coincideBusqueda, fechaHoy, formatoCantidad, formatoFecha, validarNumero } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { codigoOrden } from '@/lib/produccion/utilidades'
import {
  AvisoConexion,
  Buscador,
  Campo,
  claseBotonPrimario,
  claseBotonTabla,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  ErrorFormulario,
  EstadoVacio,
  Modal,
  Notificacion,
  Paginacion,
  PieFormulario,
  TarjetaIndicador,
  useDetalleEnUrl,
  useNotificacion,
  usePaginacion
} from '../inventario/ui'
import { DatoDetalle } from '../recursos-humanos/ui'
import { AvisoConexionCalidad, InsigniaNc, InsigniaSeveridad, SECCION_CALIDAD } from './ui'

export default function NoConformidadesVista() {
  const { productos, materiasPrimas } = useInventario()
  const { noConformidades, lotes } = useCalidad()
  const { mensaje, mostrar } = useNotificacion()
  const { detalleId, abrirDetalle, cerrarDetalle } = useDetalleEnUrl()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<EstadoNc | 'abiertas' | ''>('abiertas')
  const [nueva, setNueva] = useState(false)

  const productoPorId = useMemo(() => new Map(productos.map((p) => [p.id, p])), [productos])
  const materiaPorId = useMemo(() => new Map(materiasPrimas.map((m) => [m.id, m])), [materiasPrimas])
  const lotePorId = useMemo(() => new Map(lotes.map((l) => [l.id, l])), [lotes])
  const articulo = (n: NoConformidad) => n.productoId ? productoPorId.get(n.productoId)?.nombre : n.materiaPrimaId ? materiaPorId.get(n.materiaPrimaId)?.nombre : undefined

  const filtradas = noConformidades.filter((n) =>
    (filtro === '' || (filtro === 'abiertas' ? n.estado !== 'cerrada' : n.estado === filtro)) &&
    coincideBusqueda(busqueda, n.codigo, n.tipoDefecto, articulo(n), n.loteId ? lotePorId.get(n.loteId)?.codigo : undefined)
  )
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtradas, 12)

  const abiertas = noConformidades.filter((n) => n.estado !== 'cerrada')
  const criticas = abiertas.filter((n) => n.severidad === 'critica').length
  const cerradas = noConformidades.filter((n) => n.estado === 'cerrada' && n.fechaCierre)
  const diasCierre = cerradas.length
    ? cerradas.reduce((t, n) => t + (new Date(n.fechaCierre!).getTime() - new Date(n.fecha).getTime()) / 86_400_000, 0) / cerradas.length
    : 0
  // Pareto: defectos con más unidades afectadas
  const pareto = [...noConformidades.reduce((m, n) => m.set(n.tipoDefecto, (m.get(n.tipoDefecto) ?? 0) + n.cantidadAfectada), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
  const maxPareto = pareto[0]?.[1] ?? 0

  const nc = noConformidades.find((n) => n.id === detalleId)

  return (
    <>
      <AvisoConexion />
      <AvisoConexionCalidad />
      <EncabezadoPagina
        titulo="No conformidades"
        descripcion="Defectos detectados en proceso, en la inspección de lotes, en materia prima o reclamados por clientes; con su causa raíz y acción correctiva."
        seccion={SECCION_CALIDAD}
        acciones={<button type="button" onClick={() => setNueva(true)} className={claseBotonPrimario}><Plus size={16} />Nueva no conformidad</button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Abiertas" valor={String(abiertas.length)} detalle={`${criticas} crítica(s)`} icono={ShieldAlert} tono={criticas ? 'peligro' : abiertas.length ? 'alerta' : 'neutro'} />
        <TarjetaIndicador titulo="Cerradas" valor={String(noConformidades.length - abiertas.length)} detalle="Con causa raíz y acción correctiva" icono={ShieldCheck} tono="positivo" />
        <TarjetaIndicador titulo="Tiempo promedio de cierre" valor={cerradas.length ? `${Math.round(diasCierre * 10) / 10} días` : '—'} detalle="Desde que se detecta hasta que se cierra" icono={Timer} />
      </div>

      {pareto.length > 0 && (
        <section className={`${claseTarjeta} p-5 mb-6`}>
          <h2 className="font-semibold text-zinc-900">Defectos más frecuentes</h2>
          <p className="text-xs text-zinc-400 mb-3">Unidades afectadas por tipo de defecto (Pareto)</p>
          <ul className="space-y-2">
            {pareto.map(([defecto, cantidad]) => (
              <li key={defecto} className="grid grid-cols-[minmax(0,14rem)_1fr_auto] items-center gap-3 text-sm">
                <span className="truncate text-zinc-700" title={defecto}>{defecto}</span>
                <span className="h-2 rounded-full bg-zinc-100 overflow-hidden"><span className="block h-full rounded-full bg-[#2a78d6]" style={{ width: `${maxPareto ? (cantidad / maxPareto) * 100 : 0}%` }} /></span>
                <span className="tabular-nums text-zinc-900 font-medium">{formatoCantidad(cantidad)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 sm:flex-row sm:items-center">
          <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar NC, defecto, lote o artículo" />
          <select value={filtro} onChange={(e) => { setFiltro(e.target.value as EstadoNc | 'abiertas' | ''); setPagina(1) }} className={`${claseInput} sm:w-48 sm:ml-auto`} aria-label="Filtrar por estado">
            <option value="abiertas">Sin cerrar</option>
            <option value="">Todas</option>
            {(Object.keys(ETIQUETAS_ESTADO_NC) as EstadoNc[]).map((e) => <option key={e} value={e}>{ETIQUETAS_ESTADO_NC[e]}</option>)}
          </select>
        </div>
        {filtradas.length === 0 ? (
          <EstadoVacio icono={ShieldCheck} titulo={noConformidades.length ? 'No hay no conformidades que coincidan' : 'Sin no conformidades registradas'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>NC</th>
                  <th className={claseCabeceraTabla}>Fecha</th>
                  <th className={claseCabeceraTabla}>Defecto</th>
                  <th className={claseCabeceraTabla}>Origen</th>
                  <th className={claseCabeceraTabla}>Artículo / lote</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Cantidad</th>
                  <th className={claseCabeceraTabla}>Severidad</th>
                  <th className={claseCabeceraTabla}>Estado</th>
                  <th className={`${claseCabeceraTabla} text-right`} />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {visibles.map((n) => (
                  <tr key={n.id} className="hover:bg-zinc-50/60">
                    <td className={`${claseCeldaTabla} font-mono text-xs`}>{n.codigo}</td>
                    <td className={claseCeldaTabla}>{formatoFecha(n.fecha)}</td>
                    <td className={`${claseCeldaTabla} font-medium text-zinc-900 whitespace-normal`}>{n.tipoDefecto}</td>
                    <td className={`${claseCeldaTabla} text-xs`}>{ETIQUETAS_ORIGEN_NC[n.origen]}</td>
                    <td className={`${claseCeldaTabla} text-xs`}>
                      {articulo(n) ?? '—'}
                      {n.loteId && <p className="font-mono text-zinc-400">{lotePorId.get(n.loteId)?.codigo}</p>}
                    </td>
                    <td className={`${claseCeldaTabla} text-right`}>{formatoCantidad(n.cantidadAfectada)}</td>
                    <td className={claseCeldaTabla}><InsigniaSeveridad severidad={n.severidad} /></td>
                    <td className={claseCeldaTabla}><InsigniaNc estado={n.estado} /></td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      <button type="button" onClick={() => abrirDetalle(n.id)} className={claseBotonTabla}><Eye size={14} />{n.estado === 'cerrada' ? 'Ver' : 'Seguimiento'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtradas.length} onCambiar={setPagina} />
      </div>

      <Modal abierto={nueva} titulo="Nueva no conformidad" descripcion="Los campos marcados con * son obligatorios." onCerrar={() => setNueva(false)}>
        {nueva && <NuevaNcFormulario onCancelar={() => setNueva(false)} onGuardado={(t) => { setNueva(false); mostrar(t) }} />}
      </Modal>

      <Modal abierto={Boolean(nc)} titulo={nc ? `${nc.codigo} · ${nc.tipoDefecto}` : 'No conformidad'} onCerrar={cerrarDetalle} ancho="max-w-3xl">
        {nc && <SeguimientoNc key={nc.id} nc={nc} articulo={articulo(nc)} onCancelar={cerrarDetalle} onGuardado={(t) => { cerrarDetalle(); mostrar(t) }} />}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function NuevaNcFormulario({ onCancelar, onGuardado }: { onCancelar: () => void; onGuardado: (mensaje: string) => void }) {
  const { productos, materiasPrimas } = useInventario()
  const { lotes } = useCalidad()
  const { responsables } = useProduccion()
  const [valores, setValores] = useState({
    origen: 'cliente' as OrigenNc,
    loteId: '',
    productoId: '',
    materiaPrimaId: '',
    fecha: fechaHoy(),
    tipoDefecto: '',
    descripcion: '',
    cantidad: '1',
    severidad: 'menor' as SeveridadNc,
    disposicion: 'reproceso' as DisposicionNc,
    responsableId: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (campo: keyof typeof valores, valor: string) => { setValores((a) => ({ ...a, [campo]: valor })); setError(null) }
  const esMateria = valores.origen === 'materia_prima'

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const cantidad = validarNumero(valores.cantidad, { etiqueta: 'La cantidad afectada', mayorQueCero: true, decimales: 3 })
    if (cantidad.error) { setError(cantidad.error); return }
    if (!valores.tipoDefecto.trim()) { setError('Indique el tipo de defecto.'); return }
    if (esMateria ? !valores.materiaPrimaId : !valores.loteId && !valores.productoId) { setError(esMateria ? 'Seleccione la materia prima.' : 'Seleccione el lote o el producto.'); return }
    setEnviando(true)
    const resultado = await registrarNoConformidad({
      origen: valores.origen,
      loteId: esMateria ? undefined : valores.loteId || undefined,
      productoId: esMateria ? undefined : valores.productoId || undefined,
      materiaPrimaId: esMateria ? valores.materiaPrimaId : undefined,
      fecha: valores.fecha,
      tipoDefecto: valores.tipoDefecto,
      descripcion: valores.descripcion,
      cantidadAfectada: cantidad.valor!,
      severidad: valores.severidad,
      disposicion: valores.disposicion,
      responsableId: valores.responsableId || undefined
    })
    setEnviando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onGuardado('No conformidad registrada')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <ErrorFormulario mensaje={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Origen" htmlFor="nc-origen" requerido>
          <select id="nc-origen" value={valores.origen} onChange={(e) => cambiar('origen', e.target.value)} className={claseInput}>
            {(['cliente', 'materia_prima', 'produccion'] as OrigenNc[]).map((o) => <option key={o} value={o}>{ETIQUETAS_ORIGEN_NC[o]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Fecha" htmlFor="nc-fecha" requerido>
          <input id="nc-fecha" type="date" max={fechaHoy()} value={valores.fecha} onChange={(e) => cambiar('fecha', e.target.value)} className={claseInput} />
        </Campo>
        {esMateria ? (
          <Campo etiqueta="Materia prima" htmlFor="nc-materia" requerido className="sm:col-span-2">
            <select id="nc-materia" value={valores.materiaPrimaId} onChange={(e) => cambiar('materiaPrimaId', e.target.value)} className={claseInput}>
              <option value="">Seleccione...</option>
              {materiasPrimas.map((m) => <option key={m.id} value={m.id}>{m.codigo} — {m.nombre}</option>)}
            </select>
          </Campo>
        ) : (
          <>
            <Campo etiqueta="Lote" htmlFor="nc-lote" ayuda="Para rastrear la orden de origen">
              <select id="nc-lote" value={valores.loteId} onChange={(e) => cambiar('loteId', e.target.value)} className={claseInput}>
                <option value="">Sin lote</option>
                {lotes.map((l) => <option key={l.id} value={l.id}>{l.codigo}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Producto" htmlFor="nc-producto">
              <select id="nc-producto" value={valores.productoId} onChange={(e) => cambiar('productoId', e.target.value)} disabled={Boolean(valores.loteId)} className={claseInput}>
                <option value="">{valores.loteId ? 'El del lote' : 'Seleccione...'}</option>
                {productos.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.nombre}</option>)}
              </select>
            </Campo>
          </>
        )}
        <Campo etiqueta="Tipo de defecto" htmlFor="nc-defecto" requerido className="sm:col-span-2">
          <input id="nc-defecto" list="nc-defectos" value={valores.tipoDefecto} onChange={(e) => cambiar('tipoDefecto', e.target.value)} className={claseInput} />
          <datalist id="nc-defectos">{DEFECTOS_COMUNES.map((d) => <option key={d} value={d} />)}</datalist>
        </Campo>
        <Campo etiqueta="Cantidad afectada" htmlFor="nc-cantidad" requerido>
          <input id="nc-cantidad" type="number" min="0" step="0.001" value={valores.cantidad} onChange={(e) => cambiar('cantidad', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Severidad" htmlFor="nc-severidad">
          <select id="nc-severidad" value={valores.severidad} onChange={(e) => cambiar('severidad', e.target.value)} className={claseInput}>
            {(Object.keys(ETIQUETAS_SEVERIDAD) as SeveridadNc[]).map((s) => <option key={s} value={s}>{ETIQUETAS_SEVERIDAD[s]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Disposición" htmlFor="nc-disposicion">
          <select id="nc-disposicion" value={valores.disposicion} onChange={(e) => cambiar('disposicion', e.target.value)} className={claseInput}>
            {(Object.keys(ETIQUETAS_DISPOSICION) as DisposicionNc[]).map((d) => <option key={d} value={d}>{ETIQUETAS_DISPOSICION[d]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Responsable" htmlFor="nc-responsable">
          <select id="nc-responsable" value={valores.responsableId} onChange={(e) => cambiar('responsableId', e.target.value)} className={claseInput}>
            <option value="">Sin asignar</option>
            {responsables.filter((r) => r.activo).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Descripción" htmlFor="nc-descripcion" className="sm:col-span-2">
          <textarea id="nc-descripcion" rows={2} value={valores.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} className={`${claseInput} h-auto py-2 resize-none`} />
        </Campo>
      </div>
      <PieFormulario onCancelar={onCancelar} textoGuardar="Registrar" enviando={enviando} />
    </form>
  )
}

function SeguimientoNc({ nc, articulo, onCancelar, onGuardado }: { nc: NoConformidad; articulo?: string; onCancelar: () => void; onGuardado: (mensaje: string) => void }) {
  const { lotes } = useCalidad()
  const { responsables } = useProduccion()
  const [valores, setValores] = useState({
    causaRaiz: nc.causaRaiz ?? '',
    accionCorrectiva: nc.accionCorrectiva ?? '',
    responsableId: nc.responsableId ?? '',
    estado: nc.estado,
    fechaCierre: nc.fechaCierre ?? fechaHoy()
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (campo: keyof typeof valores, valor: string) => { setValores((a) => ({ ...a, [campo]: valor })); setError(null) }
  const lote = nc.loteId ? lotes.find((l) => l.id === nc.loteId) : undefined
  const cerrada = nc.estado === 'cerrada'

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (valores.estado === 'cerrada' && valores.fechaCierre < nc.fecha) { setError('La fecha de cierre no puede ser anterior a la detección.'); return }
    setEnviando(true)
    const resultado = await actualizarNoConformidad(nc.id, {
      causaRaiz: valores.causaRaiz,
      accionCorrectiva: valores.accionCorrectiva,
      responsableId: valores.responsableId || undefined,
      estado: valores.estado,
      fechaCierre: valores.fechaCierre
    })
    setEnviando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onGuardado(valores.estado === 'cerrada' ? `${nc.codigo} cerrada` : `Seguimiento de ${nc.codigo} guardado`)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={error} />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <DatoDetalle etiqueta="Estado" valor={<InsigniaNc estado={nc.estado} />} />
        <DatoDetalle etiqueta="Detectada" valor={formatoFecha(nc.fecha)} />
        <DatoDetalle etiqueta="Origen" valor={ETIQUETAS_ORIGEN_NC[nc.origen]} />
        <DatoDetalle etiqueta="Artículo" valor={articulo} />
        <DatoDetalle etiqueta="Cantidad afectada" valor={formatoCantidad(nc.cantidadAfectada)} />
        <DatoDetalle etiqueta="Severidad" valor={<InsigniaSeveridad severidad={nc.severidad} />} />
        <DatoDetalle etiqueta="Disposición" valor={ETIQUETAS_DISPOSICION[nc.disposicion]} />
        <DatoDetalle etiqueta="Lote" valor={lote ? <Link href={`/calidad/lotes?detalle=${encodeURIComponent(lote.id)}`} className="font-mono underline">{lote.codigo}</Link> : ''} />
        <DatoDetalle etiqueta="Orden" valor={nc.ordenId ? <Link href={`/produccion?detalle=${encodeURIComponent(nc.ordenId)}`} className="font-mono underline">{codigoOrden(nc.ordenId)}</Link> : ''} />
      </dl>
      {nc.descripcion && <p className="text-sm text-zinc-700 whitespace-pre-line">{nc.descripcion}</p>}

      <div className="grid grid-cols-1 gap-4 border-t border-zinc-100 pt-4">
        <Campo etiqueta="Causa raíz" htmlFor="nc-causa" ayuda="Por ejemplo con 5 porqués o Ishikawa: máquina, método, material, mano de obra, medición, medio ambiente.">
          <textarea id="nc-causa" rows={3} value={valores.causaRaiz} onChange={(e) => cambiar('causaRaiz', e.target.value)} disabled={cerrada} className={`${claseInput} h-auto py-2 resize-none`} />
        </Campo>
        <Campo etiqueta="Acción correctiva" htmlFor="nc-accion">
          <textarea id="nc-accion" rows={3} value={valores.accionCorrectiva} onChange={(e) => cambiar('accionCorrectiva', e.target.value)} disabled={cerrada} className={`${claseInput} h-auto py-2 resize-none`} />
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo etiqueta="Responsable" htmlFor="nc-seg-responsable">
            <select id="nc-seg-responsable" value={valores.responsableId} onChange={(e) => cambiar('responsableId', e.target.value)} disabled={cerrada} className={claseInput}>
              <option value="">Sin asignar</option>
              {responsables.filter((r) => r.activo || r.id === valores.responsableId).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Estado" htmlFor="nc-seg-estado">
            <select id="nc-seg-estado" value={valores.estado} onChange={(e) => cambiar('estado', e.target.value)} className={claseInput}>
              {(Object.keys(ETIQUETAS_ESTADO_NC) as EstadoNc[]).map((e) => <option key={e} value={e}>{ETIQUETAS_ESTADO_NC[e]}</option>)}
            </select>
          </Campo>
          {valores.estado === 'cerrada' && (
            <Campo etiqueta="Fecha de cierre" htmlFor="nc-seg-cierre">
              <input id="nc-seg-cierre" type="date" max={fechaHoy()} value={valores.fechaCierre} onChange={(e) => cambiar('fechaCierre', e.target.value)} className={claseInput} />
            </Campo>
          )}
        </div>
      </div>
      <PieFormulario onCancelar={onCancelar} textoGuardar="Guardar seguimiento" enviando={enviando} />
    </form>
  )
}
