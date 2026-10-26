'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import type { ClaseArticulo, DatosInventario, MateriaPrima, MateriaPrimaEntrada, Movimiento, MovimientoEntrada, Producto, ProductoEntrada, ResultadoAccion, UnidadMedida } from './tipos'
import { fechaHoy, formatoCantidad, normalizarTexto, variacionMovimiento } from './utilidades'

const vacio: DatosInventario = { productos: [], materiasPrimas: [], movimientos: [] }
let estado = vacio
let cargado = false
let errorConexion: string | null = null
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }
export function useInventario(): DatosInventario {
  const datos = useSyncExternalStore(suscribir, () => estado, () => vacio)
  useEffect(() => { cargarInventario().catch((error: Error) => { console.error(error.message) }) }, [])
  return datos
}
export function useErrorInventario(): string | null { return useSyncExternalStore(suscribir, () => errorConexion, () => null) }

async function validarSesion(): Promise<ResultadoAccion> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return { ok: false, error: `No se pudo validar la sesión: ${error.message}` }
  if (!data.session) return { ok: false, error: 'Inicia sesión en el ERP con un usuario de Supabase Auth antes de operar el inventario.' }
  return { ok: true }
}

const texto = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
const numero = (v: unknown) => Number(v ?? 0)
const mapProducto = (r: Record<string, unknown>): Producto => ({ id: String(r.id), sku: texto(r.sku), nombre: texto(r.nombre), tipo: r.es_personalizable ? 'personalizado' : 'estandar', categoria: texto((r.categorias as { nombre?: string } | null)?.nombre, 'Sin categoría'), precioVenta: numero(r.precio_venta), costoProduccion: numero(r.costo_produccion), existencias: numero(r.stock_actual), stockMinimo: numero(r.stock_minimo), actualizadoEn: texto(r.updated_at, texto(r.created_at, new Date().toISOString())) })
const mapMateria = (r: Record<string, unknown>): MateriaPrima => {
  const abreviatura = texto((r.unidades_medida as { abreviatura?: string } | null)?.abreviatura, 'und')
  const unidades: Record<string, UnidadMedida> = { und: 'unidad', unidad: 'unidad', 'm²': 'm2', m2: 'm2', kg: 'kg', g: 'g', m: 'm', l: 'l', ml: 'ml', rollo: 'rollo' }
  return { id: String(r.id), codigo: texto(r.codigo, `MP-${r.id}`), nombre: texto(r.nombre), categoria: texto(r.categoria, 'Sin categoría'), unidad: unidades[abreviatura] ?? 'unidad', existencias: numero(r.stock_actual), stockMinimo: numero(r.stock_minimo), costoUnitario: numero(r.costo_unitario), actualizadoEn: texto(r.updated_at, texto(r.created_at, new Date().toISOString())) }
}

export async function cargarInventario(forzar = false): Promise<void> {
  const sesion = await validarSesion()
  if (!sesion.ok) {
    errorConexion = sesion.error
    notificar()
    throw new Error(sesion.error)
  }
  if (cargado && !forzar) return
  const [p, m, mov] = await Promise.all([
    supabase.from('productos').select('*, categorias(nombre)').eq('activo', true).order('nombre'),
    supabase.from('materias_primas').select('*, unidades_medida(abreviatura)').eq('activo', true).order('nombre'),
    supabase.from('movimientos_inventario').select('*').order('created_at', { ascending: false }).limit(1000)
  ])
  const err = p.error ?? m.error ?? mov.error
  if (err) {
    errorConexion = `No se pudo cargar el inventario: ${err.message}`
    notificar()
    throw new Error(errorConexion)
  }
  const productos = (p.data ?? []).map((r) => mapProducto(r as unknown as Record<string, unknown>))
  const materiasPrimas = (m.data ?? []).map((r) => mapMateria(r as unknown as Record<string, unknown>))
  const porId = new Map<string, { clase: ClaseArticulo; articulo: Producto | MateriaPrima }>()
  productos.forEach((a) => porId.set(a.id, { clase: 'producto', articulo: a }))
  materiasPrimas.forEach((a) => porId.set(a.id, { clase: 'materia_prima', articulo: a }))
  const movimientos: Movimiento[] = (mov.data ?? []).flatMap((r) => {
    const claseArticulo: ClaseArticulo = r.producto_id != null ? 'producto' : 'materia_prima'
    const articuloId = String(r.producto_id ?? r.materia_prima_id ?? '')
    const articulo = porId.get(articuloId)?.articulo
    if (!articulo) return []
    const tipo = texto(r.tipo, 'entrada') as Movimiento['tipo']
    const cantidad = numero(r.cantidad)
    const anterior = numero(r.stock_anterior)
    return [{ id: String(r.id), fecha: texto(r.fecha, texto(r.created_at).slice(0, 10)), registradoEn: texto(r.created_at), claseArticulo, articuloId, tipo, sentido: r.sentido === 'decremento' ? 'decremento' : r.sentido === 'incremento' ? 'incremento' : undefined, cantidad, existenciasAnteriores: anterior, existenciasResultantes: numero(r.stock_resultante ?? (anterior + variacionMovimiento({ tipo, sentido: r.sentido as Movimiento['sentido'], cantidad }))), motivo: texto(r.motivo, texto(r.referencia_tipo, tipo)), observaciones: texto(r.observaciones) || undefined, referenciaTipo: r.referencia_id != null ? texto(r.referencia_tipo) || undefined : undefined, referenciaId: r.referencia_id != null ? String(r.referencia_id) : undefined }]
  })
  estado = { productos, materiasPrimas, movimientos }
  errorConexion = null
  cargado = true
  notificar()
}

function resultado(error: { message: string } | null): ResultadoAccion { return error ? { ok: false, error: error.message } : { ok: true } }
export async function guardarProducto(e: ProductoEntrada, id?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const sku = e.sku.trim().toUpperCase()
  if (estado.productos.some((p) => p.id !== id && normalizarTexto(p.sku) === normalizarTexto(sku))) return { ok: false, error: `Ya existe un producto con el SKU ${sku}.` }
  const categorias = await supabase.from('categorias').select('id,nombre')
  if (categorias.error) return resultado(categorias.error)
  let categoriaId = categorias.data.find((categoria) => normalizarTexto(categoria.nombre) === normalizarTexto(e.categoria))?.id
  if (!categoriaId) {
    const nuevaCategoria = await supabase.from('categorias').insert({ nombre: e.categoria.trim() }).select('id').single()
    if (nuevaCategoria.error) return resultado(nuevaCategoria.error)
    categoriaId = nuevaCategoria.data.id
  }
  const payload = { sku, nombre: e.nombre.trim(), es_personalizable: e.tipo === 'personalizado', categoria_id: categoriaId, precio_venta: e.precioVenta, costo_produccion: e.costoProduccion, stock_minimo: e.stockMinimo }
  const save = id ? await supabase.from('productos').update(payload).eq('id', id) : await supabase.from('productos').insert({ ...payload, stock_actual: e.existencias })
  if (save.error) return resultado(save.error)
  const loaded = await cargarInventario(true).then(() => null).catch((err: Error) => err)
  return loaded ? { ok: false, error: loaded.message } : { ok: true }
}
export async function guardarMateriaPrima(e: MateriaPrimaEntrada, id?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const codigo = e.codigo.trim().toUpperCase()
  if (estado.materiasPrimas.some((m) => m.id !== id && normalizarTexto(m.codigo) === normalizarTexto(codigo))) return { ok: false, error: `Ya existe una materia prima con el código ${codigo}.` }
  const abreviaturas: Record<UnidadMedida, string> = { unidad: 'und', kg: 'kg', g: 'g', m: 'm', m2: 'm2', l: 'l', ml: 'ml', rollo: 'rollo' }
  const abreviatura = abreviaturas[e.unidad]
  const existente = await supabase.from('unidades_medida').select('id').eq('abreviatura', abreviatura).maybeSingle()
  if (existente.error) return resultado(existente.error)
  let unidadId = existente.data?.id
  if (!unidadId) {
    const nuevaUnidad = await supabase.from('unidades_medida').insert({ nombre: e.unidad, abreviatura }).select('id').single()
    if (nuevaUnidad.error) return resultado(nuevaUnidad.error)
    unidadId = nuevaUnidad.data.id
  }
  const payload = { codigo, nombre: e.nombre.trim(), categoria: e.categoria.trim(), unidad_medida_id: unidadId, stock_minimo: e.stockMinimo, costo_unitario: e.costoUnitario }
  const save = id ? await supabase.from('materias_primas').update(payload).eq('id', id) : await supabase.from('materias_primas').insert({ ...payload, stock_actual: e.existencias })
  if (save.error) return resultado(save.error)
  try { await cargarInventario(true); return { ok: true } } catch (err) { return { ok: false, error: (err as Error).message } }
}
export async function registrarMovimiento(e: MovimientoEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!Number.isFinite(e.cantidad) || e.cantidad <= 0) return { ok: false, error: 'La cantidad debe ser mayor que cero.' }
  if (!e.motivo.trim()) return { ok: false, error: 'El motivo es obligatorio.' }
  const productos = e.claseArticulo === 'producto'
  const tabla = productos ? 'productos' : 'materias_primas'
  const articulo = productos ? estado.productos.find((a) => a.id === e.articuloId) : estado.materiasPrimas.find((a) => a.id === e.articuloId)
  if (!articulo) return { ok: false, error: 'Seleccione un artículo válido.' }
  if (productos && !Number.isInteger(e.cantidad)) return { ok: false, error: 'Los productos terminados se registran en unidades enteras.' }
  const anterior = articulo.existencias
  const resultante = anterior + variacionMovimiento(e)
  if (resultante < 0) return { ok: false, error: `El movimiento dejaría existencias negativas. Disponible: ${formatoCantidad(anterior)}.` }
  const save = await supabase.from(tabla).update({ stock_actual: resultante }).eq('id', e.articuloId)
  if (save.error) return resultado(save.error)
  const log = await supabase.from('movimientos_inventario').insert({ tipo: e.tipo, producto_id: productos ? e.articuloId : null, materia_prima_id: productos ? null : e.articuloId, cantidad: e.cantidad, referencia_tipo: e.motivo.trim(), fecha: e.fecha, motivo: e.motivo.trim(), sentido: e.tipo === 'ajuste' ? e.sentido ?? 'incremento' : null, stock_anterior: anterior, stock_resultante: resultante, observaciones: e.observaciones?.trim() || null })
  if (log.error) { await supabase.from(tabla).update({ stock_actual: anterior }).eq('id', e.articuloId); return resultado(log.error) }
  try { await cargarInventario(true); return { ok: true } } catch (err) { return { ok: false, error: (err as Error).message } }
}

// Venta de producto terminado: sale del stock y, si no alcanza, las unidades faltantes se fabrican
// al momento descontando la materia prima de su receta (función vender_producto en la base).
export async function venderProducto(e: { productoId: string; cantidad: number; fecha: string; motivo: string; observaciones?: string }): Promise<ResultadoAccion & { fabricadas?: number }> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!Number.isInteger(e.cantidad) || e.cantidad <= 0) return { ok: false, error: 'La cantidad debe ser un número entero mayor que cero.' }
  const venta = await supabase.rpc('vender_producto', { p_producto_id: Number(e.productoId), p_cantidad: e.cantidad, p_fecha: e.fecha, p_motivo: e.motivo.trim(), p_observaciones: e.observaciones?.trim() || null })
  if (venta.error) return resultado(venta.error)
  try { await cargarInventario(true) } catch (err) { return { ok: false, error: (err as Error).message } }
  return { ok: true, fabricadas: Number((venta.data as { fabricadas?: number } | null)?.fabricadas ?? 0) }
}
