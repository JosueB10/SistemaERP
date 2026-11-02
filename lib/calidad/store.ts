'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { cargarInventario } from '../inventario/store'
import type { ResultadoAccion } from '../inventario/tipos'
import type {
  DatosCalidad,
  DisposicionNc,
  EstadoLote,
  EstadoNc,
  InspeccionEntrada,
  Lote,
  NoConformidad,
  NoConformidadEntrada,
  OrigenNc,
  SeguimientoNcEntrada,
  SeveridadNc
} from './tipos'
import { codigoNc, ETIQUETAS_DISPOSICION, ETIQUETAS_ESTADO_LOTE, ETIQUETAS_ESTADO_NC, ETIQUETAS_ORIGEN_NC, ETIQUETAS_SEVERIDAD } from './utilidades'

const vacio: DatosCalidad = { lotes: [], noConformidades: [] }
let estado = vacio
let cargado = false
let errorConexion: string | null = null
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }

export function useCalidad(): DatosCalidad {
  const datos = useSyncExternalStore(suscribir, () => estado, () => vacio)
  useEffect(() => { cargarCalidad().catch((error: Error) => { console.error(error.message) }) }, [])
  return datos
}
export function useErrorCalidad(): string | null { return useSyncExternalStore(suscribir, () => errorConexion, () => null) }

async function validarSesion(): Promise<ResultadoAccion> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return { ok: false, error: `No se pudo validar la sesión: ${error.message}` }
  if (!data.session) return { ok: false, error: 'Inicia sesión en el ERP con un usuario de Supabase Auth antes de operar calidad.' }
  return { ok: true }
}

type Fila = Record<string, unknown>
const texto = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
const numero = (v: unknown) => Number(v ?? 0)
const idOpcional = (v: unknown) => v == null ? undefined : String(v)
const opcional = (v: unknown) => texto(v).trim() || undefined
const elegir = <T extends string>(valor: unknown, opciones: Record<T, string>, fallback: T): T =>
  (Object.keys(opciones) as T[]).includes(valor as T) ? (valor as T) : fallback

const mapLote = (r: Fila): Lote => ({
  id: String(r.id),
  codigo: texto(r.codigo),
  ordenId: String(r.orden_id),
  productoId: String(r.producto_id),
  fechaProduccion: texto(r.fecha_produccion),
  cantidad: numero(r.cantidad),
  cantidadAprobada: numero(r.cantidad_aprobada),
  cantidadRechazada: numero(r.cantidad_rechazada),
  estado: elegir<EstadoLote>(r.estado, ETIQUETAS_ESTADO_LOTE, 'en_inspeccion'),
  criterios: (r.criterios && typeof r.criterios === 'object' ? r.criterios : {}) as Record<string, boolean>,
  inspectorId: idOpcional(r.inspector_id),
  fechaInspeccion: opcional(r.fecha_inspeccion),
  observaciones: opcional(r.observaciones)
})

const mapNc = (r: Fila): NoConformidad => ({
  id: String(r.id),
  codigo: codigoNc(String(r.id)),
  origen: elegir<OrigenNc>(r.origen, ETIQUETAS_ORIGEN_NC, 'produccion'),
  loteId: idOpcional(r.lote_id),
  ordenId: idOpcional(r.orden_id),
  operacionId: idOpcional(r.operacion_id),
  productoId: idOpcional(r.producto_id),
  materiaPrimaId: idOpcional(r.materia_prima_id),
  fecha: texto(r.fecha),
  tipoDefecto: texto(r.tipo_defecto),
  descripcion: opcional(r.descripcion),
  cantidadAfectada: numero(r.cantidad_afectada),
  severidad: elegir<SeveridadNc>(r.severidad, ETIQUETAS_SEVERIDAD, 'menor'),
  disposicion: elegir<DisposicionNc>(r.disposicion, ETIQUETAS_DISPOSICION, 'desecho'),
  causaRaiz: opcional(r.causa_raiz),
  accionCorrectiva: opcional(r.accion_correctiva),
  responsableId: idOpcional(r.responsable_id),
  estado: elegir<EstadoNc>(r.estado, ETIQUETAS_ESTADO_NC, 'abierta'),
  fechaCierre: opcional(r.fecha_cierre)
})

export async function cargarCalidad(forzar = false): Promise<void> {
  const sesion = await validarSesion()
  if (!sesion.ok) {
    errorConexion = sesion.error
    notificar()
    throw new Error(sesion.error)
  }
  if (cargado && !forzar) return
  const [l, n] = await Promise.all([
    supabase.from('lotes').select('*').order('fecha_produccion', { ascending: false }).order('id', { ascending: false }).limit(2000),
    supabase.from('no_conformidades').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(2000)
  ])
  const err = l.error ?? n.error
  if (err) {
    errorConexion = `No se pudo cargar calidad: ${err.message}`
    notificar()
    throw new Error(errorConexion)
  }
  estado = {
    lotes: (l.data ?? []).map((x) => mapLote(x as Fila)),
    noConformidades: (n.data ?? []).map((x) => mapNc(x as Fila))
  }
  errorConexion = null
  cargado = true
  notificar()
}

function resultado(error: { message: string } | null): ResultadoAccion { return error ? { ok: false, error: error.message } : { ok: true } }
async function recargar(conInventario = false): Promise<ResultadoAccion> {
  try {
    await Promise.all([cargarCalidad(true), conInventario ? cargarInventario(true) : Promise.resolve()])
    return { ok: true }
  } catch (err) { return { ok: false, error: (err as Error).message } }
}

// Las unidades rechazadas salen del stock terminado y se abre una NC (en una sola transacción)
export async function inspeccionarLote(id: string, e: InspeccionEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.rpc('inspeccionar_lote', {
    p_lote_id: Number(id),
    p_aprobadas: e.aprobadas,
    p_rechazadas: e.rechazadas,
    p_fecha: e.fecha,
    p_inspector_id: e.inspectorId ? Number(e.inspectorId) : null,
    p_criterios: e.criterios,
    p_observaciones: e.observaciones.trim() || null,
    p_tipo_defecto: e.tipoDefecto.trim() || null,
    p_descripcion: e.descripcion.trim() || null,
    p_severidad: e.severidad,
    p_disposicion: e.disposicion
  })
  if (save.error) return resultado(save.error)
  return recargar(e.rechazadas > 0)
}

export async function registrarNoConformidad(e: NoConformidadEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!e.tipoDefecto.trim()) return { ok: false, error: 'Indique el tipo de defecto.' }
  const lote = e.loteId ? estado.lotes.find((l) => l.id === e.loteId) : undefined
  const save = await supabase.from('no_conformidades').insert({
    origen: e.origen,
    lote_id: e.loteId ? Number(e.loteId) : null,
    orden_id: lote ? Number(lote.ordenId) : null,
    producto_id: lote ? Number(lote.productoId) : e.productoId ? Number(e.productoId) : null,
    materia_prima_id: e.materiaPrimaId ? Number(e.materiaPrimaId) : null,
    fecha: e.fecha,
    tipo_defecto: e.tipoDefecto.trim(),
    descripcion: e.descripcion.trim() || null,
    cantidad_afectada: e.cantidadAfectada,
    severidad: e.severidad,
    disposicion: e.disposicion,
    responsable_id: e.responsableId ? Number(e.responsableId) : null
  })
  if (save.error) return resultado(save.error)
  return recargar()
}

// Análisis de causa raíz, acción correctiva y cierre
export async function actualizarNoConformidad(id: string, e: SeguimientoNcEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (e.estado === 'cerrada' && (!e.causaRaiz.trim() || !e.accionCorrectiva.trim())) {
    return { ok: false, error: 'Para cerrar la no conformidad registre la causa raíz y la acción correctiva.' }
  }
  const save = await supabase.from('no_conformidades').update({
    causa_raiz: e.causaRaiz.trim() || null,
    accion_correctiva: e.accionCorrectiva.trim() || null,
    responsable_id: e.responsableId ? Number(e.responsableId) : null,
    estado: e.estado,
    fecha_cierre: e.estado === 'cerrada' ? e.fechaCierre ?? null : null,
    updated_at: new Date().toISOString()
  }).eq('id', id)
  if (save.error) return resultado(save.error)
  return recargar()
}
