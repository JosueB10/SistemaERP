'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { cargarInventario } from '../inventario/store'
import type { ResultadoAccion } from '../inventario/tipos'
import { fechaHoy } from '../inventario/utilidades'
import type {
  CompletarOrdenEntrada,
  ConsumoOrden,
  DatosProduccion,
  EstadoOrden,
  OrdenEntrada,
  OrdenProduccion,
  Receta,
  RecetaEntrada,
  Responsable
} from './tipos'
import { codigoOrden } from './utilidades'

const vacio: DatosProduccion = { recetas: [], ordenes: [], responsables: [] }
let estado = vacio
let cargado = false
let errorConexion: string | null = null
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }

export function useProduccion(): DatosProduccion {
  const datos = useSyncExternalStore(suscribir, () => estado, () => vacio)
  useEffect(() => { cargarProduccion().catch((error: Error) => { console.error(error.message) }) }, [])
  return datos
}
export function useErrorProduccion(): string | null { return useSyncExternalStore(suscribir, () => errorConexion, () => null) }

async function validarSesion(): Promise<ResultadoAccion> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return { ok: false, error: `No se pudo validar la sesión: ${error.message}` }
  if (!data.session) return { ok: false, error: 'Inicia sesión en el ERP con un usuario de Supabase Auth antes de operar producción.' }
  return { ok: true }
}

type Fila = Record<string, unknown>
const texto = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
const numero = (v: unknown) => Number(v ?? 0)
const idOpcional = (v: unknown) => v == null ? undefined : String(v)

const mapReceta = (r: Fila): Receta => ({
  id: String(r.id),
  productoId: String(r.producto_id),
  nombre: texto(r.nombre),
  version: numero(r.version),
  notas: texto(r.notas) || undefined,
  actualizadoEn: texto(r.updated_at, texto(r.created_at)),
  lineas: ((r.receta_detalle as Fila[] | null) ?? [])
    .map((d) => ({ materiaPrimaId: String(d.materia_prima_id), cantidad: numero(d.cantidad) }))
})

const mapConsumo = (r: Fila): ConsumoOrden => ({
  materiaPrimaId: String(r.materia_prima_id),
  cantidadTeorica: numero(r.cantidad_teorica),
  cantidadReal: numero(r.cantidad_real),
  costoUnitario: numero(r.costo_unitario),
  subtotal: numero(r.subtotal)
})

const ESTADOS: EstadoOrden[] = ['pendiente', 'en_proceso', 'completada', 'cancelada']

const mapOrden = (r: Fila): OrdenProduccion => ({
  id: String(r.id),
  codigo: codigoOrden(String(r.id)),
  productoId: String(r.producto_id),
  recetaId: idOpcional(r.receta_id),
  empleadoId: idOpcional(r.empleado_id),
  fechaProgramada: texto(r.fecha_programada) || undefined,
  fechaInicio: texto(r.fecha_inicio) || undefined,
  fechaFin: texto(r.fecha_fin) || undefined,
  cantidadPlanificada: numero(r.cantidad_planificada),
  cantidadProducida: numero(r.cantidad_producida),
  estado: ESTADOS.includes(r.estado as EstadoOrden) ? (r.estado as EstadoOrden) : 'pendiente',
  observaciones: texto(r.observaciones) || undefined,
  costoMateriales: numero(r.costo_materiales),
  creadoEn: texto(r.created_at),
  consumos: ((r.orden_produccion_consumos as Fila[] | null) ?? []).map(mapConsumo)
})

// Acepta tanto la tabla de empleados de Recursos Humanos como la del esquema original
const mapResponsable = (r: Fila): Responsable => ({
  id: String(r.id),
  codigo: texto(r.codigo, `EMP-${r.id}`),
  nombre: `${texto(r.nombres)} ${texto(r.apellidos)}`.trim() || texto(r.nombre, 'Sin nombre'),
  activo: r.estado ? r.estado !== 'inactivo' : r.activo !== false
})

export async function cargarProduccion(forzar = false): Promise<void> {
  const sesion = await validarSesion()
  if (!sesion.ok) {
    errorConexion = sesion.error
    notificar()
    throw new Error(sesion.error)
  }
  if (cargado && !forzar) return
  const [r, o, e] = await Promise.all([
    supabase.from('recetas').select('*, receta_detalle(*)').eq('activo', true),
    supabase.from('ordenes_produccion').select('*, orden_produccion_consumos(*)').order('created_at', { ascending: false }).limit(2000),
    supabase.from('empleados').select('*')
  ])
  const err = r.error ?? o.error ?? e.error
  if (err) {
    errorConexion = `No se pudo cargar producción: ${err.message}`
    notificar()
    throw new Error(errorConexion)
  }
  estado = {
    recetas: (r.data ?? []).map((x) => mapReceta(x as Fila)),
    ordenes: (o.data ?? []).map((x) => mapOrden(x as Fila)),
    responsables: (e.data ?? []).map((x) => mapResponsable(x as Fila)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }
  errorConexion = null
  cargado = true
  notificar()
}

function resultado(error: { message: string } | null): ResultadoAccion { return error ? { ok: false, error: error.message } : { ok: true } }
async function recargar(conInventario = false): Promise<ResultadoAccion> {
  try {
    await Promise.all([cargarProduccion(true), conInventario ? cargarInventario(true) : Promise.resolve()])
    return { ok: true }
  } catch (err) { return { ok: false, error: (err as Error).message } }
}

// ---------- Recetas ----------

export async function guardarReceta(e: RecetaEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!e.nombre.trim()) return { ok: false, error: 'El nombre de la receta es obligatorio.' }
  const save = await supabase.rpc('guardar_receta', {
    p_producto_id: Number(e.productoId),
    p_nombre: e.nombre.trim(),
    p_notas: e.notas.trim(),
    p_detalles: e.lineas.map((l) => ({ materia_prima_id: Number(l.materiaPrimaId), cantidad: l.cantidad }))
  })
  if (save.error) return resultado(save.error)
  return recargar()
}

// Copia el costo de materia prima de la receta al costo de producción del producto
export async function aplicarCostoProducto(productoId: string, costo: number): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.from('productos').update({ costo_produccion: Math.round(costo * 100) / 100 }).eq('id', productoId)
  if (save.error) return resultado(save.error)
  try { await cargarInventario(true); return { ok: true } } catch (err) { return { ok: false, error: (err as Error).message } }
}

// ---------- Órdenes ----------

export async function guardarOrden(e: OrdenEntrada, id?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!Number.isInteger(e.cantidadPlanificada) || e.cantidadPlanificada <= 0) return { ok: false, error: 'La cantidad a producir debe ser un entero mayor que cero.' }
  if (id && estado.ordenes.find((o) => o.id === id)?.estado !== 'pendiente') return { ok: false, error: 'Solo se pueden editar órdenes pendientes.' }
  const receta = estado.recetas.find((r) => r.productoId === e.productoId)
  const payload = {
    producto_id: Number(e.productoId),
    receta_id: receta ? Number(receta.id) : null,
    empleado_id: e.empleadoId ? Number(e.empleadoId) : null,
    cantidad_planificada: e.cantidadPlanificada,
    fecha_programada: e.fechaProgramada || null,
    observaciones: e.observaciones.trim() || null,
    updated_at: new Date().toISOString()
  }
  const save = id
    ? await supabase.from('ordenes_produccion').update(payload).eq('id', id).eq('estado', 'pendiente')
    : await supabase.from('ordenes_produccion').insert({ ...payload, estado: 'pendiente' })
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function iniciarOrden(id: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.from('ordenes_produccion')
    .update({ estado: 'en_proceso', fecha_inicio: fechaHoy(), updated_at: new Date().toISOString() })
    .eq('id', id).eq('estado', 'pendiente')
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function cancelarOrden(id: string, motivo: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const orden = estado.ordenes.find((o) => o.id === id)
  if (!orden || (orden.estado !== 'pendiente' && orden.estado !== 'en_proceso')) return { ok: false, error: 'Solo se pueden cancelar órdenes pendientes o en proceso.' }
  const nota = motivo.trim() ? `Cancelada: ${motivo.trim()}` : 'Cancelada'
  const save = await supabase.from('ordenes_produccion')
    .update({
      estado: 'cancelada',
      fecha_fin: fechaHoy(),
      observaciones: orden.observaciones ? `${orden.observaciones}\n${nota}` : nota,
      updated_at: new Date().toISOString()
    })
    .eq('id', id).in('estado', ['pendiente', 'en_proceso'])
  if (save.error) return resultado(save.error)
  return recargar()
}

// Descuenta la materia prima y suma el producto terminado en una sola transacción de la base
export async function completarOrden(id: string, e: CompletarOrdenEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!Number.isInteger(e.cantidadProducida) || e.cantidadProducida <= 0) return { ok: false, error: 'La cantidad producida debe ser un entero mayor que cero.' }
  const save = await supabase.rpc('completar_orden_produccion', {
    p_orden_id: Number(id),
    p_cantidad_producida: e.cantidadProducida,
    p_fecha_fin: e.fechaFin,
    p_consumos: e.consumos.map((c) => ({
      materia_prima_id: Number(c.materiaPrimaId),
      cantidad_teorica: c.cantidadTeorica,
      cantidad_real: c.cantidadReal
    })),
    p_observaciones: e.observaciones.trim() || null
  })
  if (save.error) return resultado(save.error)
  return recargar(true)
}
