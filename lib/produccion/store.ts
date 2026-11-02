'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { cargarInventario } from '../inventario/store'
import { cargarVentas } from '../ventas/store'
import { cargarCalidad } from '../calidad/store'
import type { ResultadoAccion } from '../inventario/tipos'
import { fechaHoy } from '../inventario/utilidades'
import type {
  CentroTrabajo,
  CentroTrabajoEntrada,
  CompletarOrdenEntrada,
  ConsumoOrden,
  DatosProduccion,
  EstadoOperacion,
  EstadoOrden,
  LineaEstructura,
  OperacionOrden,
  OperacionRuta,
  OperacionRutaEntrada,
  OrdenEntrada,
  OrdenProduccion,
  Planta,
  PlantaEntrada,
  Receta,
  RecetaEntrada,
  Responsable,
  Subensamble,
  SubensambleEntrada,
  TerminarOperacionEntrada
} from './tipos'
import { codigoOrden, explotarEstructura } from './utilidades'

const vacio: DatosProduccion = { recetas: [], ordenes: [], responsables: [], subensambles: [], centros: [], rutas: [], plantas: [] }
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
const numeroOpcional = (v: unknown) => v == null ? undefined : Number(v)

const mapEstructura = (d: Fila): LineaEstructura => d.subensamble_id != null
  ? { tipo: 'subensamble', componenteId: String(d.subensamble_id), cantidad: numero(d.cantidad) }
  : { tipo: 'materia_prima', componenteId: String(d.materia_prima_id), cantidad: numero(d.cantidad) }

const mapSubensamble = (r: Fila): Subensamble => ({
  id: String(r.id),
  codigo: texto(r.codigo, `SE-${r.id}`),
  nombre: texto(r.nombre),
  descripcion: texto(r.descripcion) || undefined,
  activo: r.activo !== false,
  lineas: ((r.subensamble_detalle as Fila[] | null) ?? [])
    .map((d) => ({ materiaPrimaId: String(d.materia_prima_id), cantidad: numero(d.cantidad) }))
})

// La receta guarda su estructura; la materia prima total (BOM explotada) se calcula con los subensambles
const mapReceta = (r: Fila, subensambles: Subensamble[]): Receta => {
  const estructura = ((r.receta_detalle as Fila[] | null) ?? []).map(mapEstructura)
  return {
    id: String(r.id),
    productoId: String(r.producto_id),
    nombre: texto(r.nombre),
    version: numero(r.version),
    notas: texto(r.notas) || undefined,
    actualizadoEn: texto(r.updated_at, texto(r.created_at)),
    estructura,
    lineas: explotarEstructura(estructura, subensambles)
  }
}

const mapConsumo = (r: Fila): ConsumoOrden => ({
  materiaPrimaId: String(r.materia_prima_id),
  cantidadTeorica: numero(r.cantidad_teorica),
  cantidadReal: numero(r.cantidad_real),
  costoUnitario: numero(r.costo_unitario),
  subtotal: numero(r.subtotal)
})

const ESTADOS_OPERACION: EstadoOperacion[] = ['pendiente', 'en_proceso', 'completada']

const mapOperacion = (r: Fila): OperacionOrden => ({
  id: String(r.id),
  ordenId: String(r.orden_id),
  secuencia: numero(r.secuencia),
  nombre: texto(r.nombre),
  centroTrabajoId: idOpcional(r.centro_trabajo_id),
  tiempoPreparacionMin: numero(r.tiempo_preparacion_min),
  tiempoEstandarMin: numero(r.tiempo_estandar_min),
  estado: ESTADOS_OPERACION.includes(r.estado as EstadoOperacion) ? (r.estado as EstadoOperacion) : 'pendiente',
  inicio: texto(r.inicio) || undefined,
  fin: texto(r.fin) || undefined,
  tiempoParoMin: numero(r.tiempo_paro_min),
  motivoParo: texto(r.motivo_paro) || undefined,
  cantidadBuena: numero(r.cantidad_buena),
  cantidadRechazada: numero(r.cantidad_rechazada),
  empleadoId: idOpcional(r.empleado_id),
  observaciones: texto(r.observaciones) || undefined,
  escalaTiempo: Number(r.escala_tiempo ?? 1) || 1,
  registradoPor: r.registrado_por === 'iiot' ? 'iiot' : 'manual'
})

const ESTADOS: EstadoOrden[] = ['pendiente', 'en_proceso', 'completada', 'cancelada']

const mapOrden = (r: Fila): OrdenProduccion => ({
  id: String(r.id),
  codigo: codigoOrden(String(r.id)),
  productoId: String(r.producto_id),
  recetaId: idOpcional(r.receta_id),
  empleadoId: idOpcional(r.empleado_id),
  ventaId: idOpcional(r.venta_id),
  fechaProgramada: texto(r.fecha_programada) || undefined,
  fechaInicio: texto(r.fecha_inicio) || undefined,
  fechaFin: texto(r.fecha_fin) || undefined,
  cantidadPlanificada: numero(r.cantidad_planificada),
  cantidadProducida: numero(r.cantidad_producida),
  estado: ESTADOS.includes(r.estado as EstadoOrden) ? (r.estado as EstadoOrden) : 'pendiente',
  observaciones: texto(r.observaciones) || undefined,
  costoMateriales: numero(r.costo_materiales),
  creadoEn: texto(r.created_at),
  consumos: ((r.orden_produccion_consumos as Fila[] | null) ?? []).map(mapConsumo),
  operaciones: ((r.orden_operaciones as Fila[] | null) ?? []).map(mapOperacion).sort((a, b) => a.secuencia - b.secuencia)
})

// Acepta tanto la tabla de empleados de Recursos Humanos como la del esquema original
const mapResponsable = (r: Fila): Responsable => ({
  id: String(r.id),
  codigo: texto(r.codigo, `EMP-${r.id}`),
  nombre: `${texto(r.nombres)} ${texto(r.apellidos)}`.trim() || texto(r.nombre, 'Sin nombre'),
  activo: r.estado ? r.estado !== 'inactivo' : r.activo !== false
})

const mapCentro = (r: Fila): CentroTrabajo => ({
  id: String(r.id),
  codigo: texto(r.codigo, `CT-${r.id}`),
  nombre: texto(r.nombre),
  descripcion: texto(r.descripcion) || undefined,
  plantaId: idOpcional(r.planta_id),
  capacidadHora: numero(r.capacidad_hora),
  horasTurno: numero(r.horas_turno),
  costoHora: numero(r.costo_hora),
  temperaturaMin: numeroOpcional(r.temperatura_min),
  temperaturaMax: numeroOpcional(r.temperatura_max),
  potenciaKw: numero(r.potencia_kw),
  potenciaEsperaKw: numero(r.potencia_espera_kw),
  tarifaDestajo: numero(r.tarifa_destajo),
  activo: r.activo !== false
})

const mapPlanta = (r: Fila): Planta => ({
  id: String(r.id),
  codigo: texto(r.codigo, `PL-${r.id}`),
  nombre: texto(r.nombre),
  ubicacion: texto(r.ubicacion) || undefined,
  iluminacionKw: numero(r.iluminacion_kw),
  factorEmisionKgKwh: numero(r.factor_emision_kg_kwh),
  tarifaKwh: numero(r.tarifa_kwh),
  activo: r.activo !== false
})

const mapRuta = (r: Fila): OperacionRuta => ({
  id: String(r.id),
  productoId: String(r.producto_id),
  secuencia: numero(r.secuencia),
  nombre: texto(r.nombre),
  centroTrabajoId: String(r.centro_trabajo_id),
  tiempoPreparacionMin: numero(r.tiempo_preparacion_min),
  tiempoEstandarMin: numero(r.tiempo_estandar_min),
  instrucciones: texto(r.instrucciones) || undefined
})

// Varias pantallas piden los datos al mismo tiempo: comparten la consulta que ya está en curso
let enCurso: Promise<void> | null = null

export function cargarProduccion(forzar = false): Promise<void> {
  if (cargado && !forzar) return Promise.resolve()
  if (enCurso) return enCurso
  enCurso = consultarProduccion().finally(() => { enCurso = null })
  return enCurso
}

async function consultarProduccion(): Promise<void> {
  const sesion = await validarSesion()
  if (!sesion.ok) {
    errorConexion = sesion.error
    notificar()
    throw new Error(sesion.error)
  }
  const [r, o, e, s, c, ru, pl] = await Promise.all([
    supabase.from('recetas').select('*, receta_detalle(*)').eq('activo', true),
    supabase.from('ordenes_produccion').select('*, orden_produccion_consumos(*), orden_operaciones(*)').order('created_at', { ascending: false }).limit(2000),
    supabase.from('empleados').select('*'),
    supabase.from('subensambles').select('*, subensamble_detalle(*)').order('codigo'),
    supabase.from('centros_trabajo').select('*').order('codigo'),
    supabase.from('ruta_operaciones').select('*').order('producto_id').order('secuencia'),
    supabase.from('plantas').select('*').order('codigo')
  ])
  const err = r.error ?? o.error ?? e.error ?? s.error ?? c.error ?? ru.error ?? pl.error
  if (err) {
    errorConexion = `No se pudo cargar producción: ${err.message}`
    notificar()
    throw new Error(errorConexion)
  }
  const subensambles = (s.data ?? []).map((x) => mapSubensamble(x as Fila))
  estado = {
    recetas: (r.data ?? []).map((x) => mapReceta(x as Fila, subensambles)),
    ordenes: (o.data ?? []).map((x) => mapOrden(x as Fila)),
    responsables: (e.data ?? []).map((x) => mapResponsable(x as Fila)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    subensambles,
    centros: (c.data ?? []).map((x) => mapCentro(x as Fila)),
    rutas: (ru.data ?? []).map((x) => mapRuta(x as Fila)),
    plantas: (pl.data ?? []).map((x) => mapPlanta(x as Fila))
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

// ---------- Recetas (BOM) ----------

export async function guardarReceta(e: RecetaEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!e.nombre.trim()) return { ok: false, error: 'El nombre de la receta es obligatorio.' }
  const save = await supabase.rpc('guardar_receta', {
    p_producto_id: Number(e.productoId),
    p_nombre: e.nombre.trim(),
    p_notas: e.notas.trim(),
    p_detalles: e.estructura.map((l) => l.tipo === 'subensamble'
      ? { subensamble_id: Number(l.componenteId), cantidad: l.cantidad }
      : { materia_prima_id: Number(l.componenteId), cantidad: l.cantidad })
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

// ---------- Subensambles ----------

export async function guardarSubensamble(e: SubensambleEntrada, id?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!e.codigo.trim() || !e.nombre.trim()) return { ok: false, error: 'El código y el nombre son obligatorios.' }
  if (e.lineas.length === 0) return { ok: false, error: 'El subensamble debe llevar al menos una materia prima.' }
  const save = await supabase.rpc('guardar_subensamble', {
    p_id: id ? Number(id) : null,
    p_codigo: e.codigo.trim().toUpperCase(),
    p_nombre: e.nombre.trim(),
    p_descripcion: e.descripcion.trim(),
    p_detalles: e.lineas.map((l) => ({ materia_prima_id: Number(l.materiaPrimaId), cantidad: l.cantidad }))
  })
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function cambiarEstadoSubensamble(id: string, activo: boolean): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!activo && estado.recetas.some((r) => r.estructura.some((l) => l.tipo === 'subensamble' && l.componenteId === id))) {
    return { ok: false, error: 'El subensamble se usa en una receta. Quítelo de la receta antes de desactivarlo.' }
  }
  const save = await supabase.from('subensambles').update({ activo, updated_at: new Date().toISOString() }).eq('id', id)
  if (save.error) return resultado(save.error)
  return recargar()
}

// ---------- Centros de trabajo y rutas ----------

export async function guardarCentroTrabajo(e: CentroTrabajoEntrada, id?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const codigo = e.codigo.trim().toUpperCase()
  if (!codigo || !e.nombre.trim()) return { ok: false, error: 'El código y el nombre son obligatorios.' }
  if (estado.centros.some((c) => c.id !== id && c.codigo.toUpperCase() === codigo)) return { ok: false, error: `Ya existe un centro con el código ${codigo}.` }
  const payload = {
    codigo,
    nombre: e.nombre.trim(),
    descripcion: e.descripcion?.trim() || null,
    capacidad_hora: e.capacidadHora,
    horas_turno: e.horasTurno,
    costo_hora: e.costoHora,
    temperatura_min: e.temperaturaMin ?? null,
    temperatura_max: e.temperaturaMax ?? null,
    planta_id: e.plantaId ? Number(e.plantaId) : null,
    potencia_kw: e.potenciaKw,
    potencia_espera_kw: e.potenciaEsperaKw,
    tarifa_destajo: e.tarifaDestajo,
    updated_at: new Date().toISOString()
  }
  const save = id
    ? await supabase.from('centros_trabajo').update(payload).eq('id', id)
    : await supabase.from('centros_trabajo').insert(payload)
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function cambiarEstadoCentro(id: string, activo: boolean): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!activo && estado.rutas.some((r) => r.centroTrabajoId === id)) {
    return { ok: false, error: 'El centro se usa en rutas de fabricación. Cámbielo en las rutas antes de desactivarlo.' }
  }
  const save = await supabase.from('centros_trabajo').update({ activo, updated_at: new Date().toISOString() }).eq('id', id)
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function guardarPlanta(e: PlantaEntrada, id?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const codigo = e.codigo.trim().toUpperCase()
  if (!codigo || !e.nombre.trim()) return { ok: false, error: 'El código y el nombre son obligatorios.' }
  if (estado.plantas.some((p) => p.id !== id && p.codigo.toUpperCase() === codigo)) return { ok: false, error: `Ya existe una planta con el código ${codigo}.` }
  const payload = {
    codigo,
    nombre: e.nombre.trim(),
    ubicacion: e.ubicacion?.trim() || null,
    iluminacion_kw: e.iluminacionKw,
    factor_emision_kg_kwh: e.factorEmisionKgKwh,
    tarifa_kwh: e.tarifaKwh,
    updated_at: new Date().toISOString()
  }
  const save = id
    ? await supabase.from('plantas').update(payload).eq('id', id)
    : await supabase.from('plantas').insert(payload)
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function cambiarEstadoPlanta(id: string, activo: boolean): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!activo && estado.centros.some((c) => c.activo && c.plantaId === id)) {
    return { ok: false, error: 'La planta tiene centros de trabajo activos. Muévalos a otra planta o desactívelos primero.' }
  }
  const save = await supabase.from('plantas').update({ activo, updated_at: new Date().toISOString() }).eq('id', id)
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function guardarRuta(productoId: string, operaciones: OperacionRutaEntrada[]): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.rpc('guardar_ruta', {
    p_producto_id: Number(productoId),
    p_operaciones: operaciones.map((o) => ({
      nombre: o.nombre.trim(),
      centro_trabajo_id: Number(o.centroTrabajoId),
      tiempo_preparacion_min: o.tiempoPreparacionMin,
      tiempo_estandar_min: o.tiempoEstandarMin,
      instrucciones: o.instrucciones?.trim() || null
    }))
  })
  if (save.error) return resultado(save.error)
  return recargar()
}

// ---------- Órdenes ----------

// Si el encargado no tiene otra orden en proceso, la base la inicia sola (iniciada = true)
export async function guardarOrden(e: OrdenEntrada, id?: string): Promise<ResultadoAccion & { iniciada?: boolean }> {
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
    updated_at: new Date().toISOString(),
    ...(e.ventaId ? { venta_id: Number(e.ventaId) } : {})
  }
  const save = id
    ? await supabase.from('ordenes_produccion').update(payload).eq('id', id).eq('estado', 'pendiente').select('estado').single()
    : await supabase.from('ordenes_produccion').insert({ ...payload, estado: 'pendiente' }).select('estado').single()
  if (save.error) return resultado(save.error)
  const recarga = await recargar()
  return recarga.ok ? { ok: true, iniciada: save.data.estado === 'en_proceso' } : recarga
}

// Al iniciar, la base copia la ruta del producto como operaciones de la orden
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

// ---------- Operaciones de la orden ----------

export async function iniciarOperacion(id: string, inicio: string, empleadoId?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.rpc('iniciar_operacion', {
    p_operacion_id: Number(id),
    p_inicio: inicio,
    p_empleado_id: empleadoId ? Number(empleadoId) : null
  })
  if (save.error) return resultado(save.error)
  return recargar()
}

// Las piezas rechazadas generan una no conformidad abierta (trigger en la base)
export async function terminarOperacion(id: string, e: TerminarOperacionEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.rpc('terminar_operacion', {
    p_operacion_id: Number(id),
    p_inicio: e.inicio,
    p_fin: e.fin,
    p_cantidad_buena: e.cantidadBuena,
    p_cantidad_rechazada: e.cantidadRechazada,
    p_tiempo_paro_min: e.tiempoParoMin,
    p_motivo_paro: e.motivoParo.trim() || null,
    p_empleado_id: e.empleadoId ? Number(e.empleadoId) : null,
    p_observaciones: e.observaciones.trim() || null
  })
  if (save.error) return resultado(save.error)
  if (e.cantidadRechazada > 0) await cargarCalidad(true).catch(() => undefined)
  return recargar()
}

// Descuenta la materia prima (BOM explotada), suma el producto terminado y crea el lote en una sola transacción
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
  // Completar la orden puede completar ventas pendientes y crea el lote (triggers en la base)
  const recarga = await recargar(true)
  await Promise.all([cargarVentas(true).catch(() => undefined), cargarCalidad(true).catch(() => undefined)])
  return recarga
}
