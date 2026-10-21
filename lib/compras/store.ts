'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { cargarInventario } from '../inventario/store'
import type { ResultadoAccion } from '../inventario/tipos'
import type { MetodoPago } from '../ventas/tipos'
import { ETIQUETAS_METODO_PAGO } from '../ventas/utilidades'
import type { Compra, CompraEntrada, DatosCompras, LineaCompra, Proveedor, ProveedorEntrada } from './tipos'
import { codigoCompra, codigoProveedor } from './utilidades'

const vacio: DatosCompras = { compras: [], proveedores: [] }
let estado = vacio
let cargado = false
let errorConexion: string | null = null
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }

export function useCompras(): DatosCompras {
  const datos = useSyncExternalStore(suscribir, () => estado, () => vacio)
  useEffect(() => { cargarCompras().catch((error: Error) => { console.error(error.message) }) }, [])
  return datos
}
export function useErrorCompras(): string | null { return useSyncExternalStore(suscribir, () => errorConexion, () => null) }

async function validarSesion(): Promise<ResultadoAccion> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return { ok: false, error: `No se pudo validar la sesión: ${error.message}` }
  if (!data.session) return { ok: false, error: 'Inicia sesión en el ERP con un usuario de Supabase Auth antes de operar compras.' }
  return { ok: true }
}

type Fila = Record<string, unknown>
const texto = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
const numero = (v: unknown) => Number(v ?? 0)
const opcional = (v: unknown) => texto(v).trim() || undefined

const mapProveedor = (r: Fila): Proveedor => ({
  id: String(r.id),
  codigo: codigoProveedor(String(r.id)),
  nombre: texto(r.nombre),
  ruc: opcional(r.ruc),
  contacto: opcional(r.contacto),
  telefono: opcional(r.telefono),
  correo: opcional(r.correo),
  direccion: opcional(r.direccion),
  notas: opcional(r.notas),
  activo: r.activo !== false,
  creadoEn: texto(r.created_at)
})

const mapLinea = (r: Fila): LineaCompra => ({
  materiaPrimaId: String(r.materia_prima_id),
  cantidad: numero(r.cantidad),
  costoUnitario: numero(r.costo_unitario),
  subtotal: numero(r.subtotal)
})

const METODOS = Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]

const mapCompra = (r: Fila): Compra => ({
  id: String(r.id),
  codigo: codigoCompra(String(r.id)),
  proveedorId: r.proveedor_id == null ? undefined : String(r.proveedor_id),
  fecha: texto(r.fecha, texto(r.created_at)).slice(0, 10),
  registradoEn: texto(r.created_at),
  numeroFactura: opcional(r.numero_factura),
  metodoPago: METODOS.includes(r.metodo_pago as MetodoPago) ? (r.metodo_pago as MetodoPago) : undefined,
  subtotal: numero(r.subtotal),
  descuento: numero(r.descuento),
  impuesto: numero(r.impuesto),
  total: numero(r.total),
  estado: r.estado === 'anulada' ? 'anulada' : 'completada',
  observaciones: opcional(r.observaciones),
  anuladaEn: opcional(r.anulada_en),
  motivoAnulacion: opcional(r.motivo_anulacion),
  lineas: ((r.compra_detalle as Fila[] | null) ?? []).map(mapLinea)
})

export async function cargarCompras(forzar = false): Promise<void> {
  const sesion = await validarSesion()
  if (!sesion.ok) {
    errorConexion = sesion.error
    notificar()
    throw new Error(sesion.error)
  }
  if (cargado && !forzar) return
  const [c, p] = await Promise.all([
    supabase.from('compras').select('*, compra_detalle(*)').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(3000),
    supabase.from('proveedores').select('*').order('nombre')
  ])
  const err = c.error ?? p.error
  if (err) {
    errorConexion = `No se pudo cargar compras: ${err.message}`
    notificar()
    throw new Error(errorConexion)
  }
  estado = {
    compras: (c.data ?? []).map((x) => mapCompra(x as Fila)),
    proveedores: (p.data ?? []).map((x) => mapProveedor(x as Fila))
  }
  errorConexion = null
  cargado = true
  notificar()
}

function resultado(error: { message: string } | null): ResultadoAccion { return error ? { ok: false, error: error.message } : { ok: true } }
async function recargar(conInventario = false): Promise<ResultadoAccion> {
  try {
    await Promise.all([cargarCompras(true), conInventario ? cargarInventario(true) : Promise.resolve()])
    return { ok: true }
  } catch (err) { return { ok: false, error: (err as Error).message } }
}

// ---------- Proveedores ----------

export async function guardarProveedor(e: ProveedorEntrada, id?: string): Promise<ResultadoAccion & { id?: string }> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!e.nombre.trim()) return { ok: false, error: 'El nombre del proveedor es obligatorio.' }
  const ruc = e.ruc?.trim().toUpperCase()
  if (ruc && estado.proveedores.some((p) => p.id !== id && p.ruc?.toUpperCase() === ruc)) {
    return { ok: false, error: `Ya existe un proveedor con el RUC ${ruc}.` }
  }
  const payload = {
    nombre: e.nombre.trim(),
    ruc: ruc || null,
    contacto: e.contacto?.trim() || null,
    telefono: e.telefono?.trim() || null,
    correo: e.correo?.trim() || null,
    direccion: e.direccion?.trim() || null,
    notas: e.notas?.trim() || null,
    updated_at: new Date().toISOString()
  }
  const save = id
    ? await supabase.from('proveedores').update(payload).eq('id', id).select('id').single()
    : await supabase.from('proveedores').insert(payload).select('id').single()
  if (save.error) return resultado(save.error)
  const recarga = await recargar()
  return recarga.ok ? { ok: true, id: String(save.data.id) } : recarga
}

export async function cambiarEstadoProveedor(id: string, activo: boolean): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.from('proveedores').update({ activo, updated_at: new Date().toISOString() }).eq('id', id)
  if (save.error) return resultado(save.error)
  return recargar()
}

// ---------- Compras ----------

// Suma la materia prima al inventario, actualiza su costo y registra el gasto en una sola transacción
export async function registrarCompra(e: CompraEntrada): Promise<ResultadoAccion & { id?: string }> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!e.proveedorId) return { ok: false, error: 'Seleccione el proveedor.' }
  if (e.lineas.length === 0) return { ok: false, error: 'Agregue al menos una materia prima a la compra.' }
  const save = await supabase.rpc('registrar_compra', {
    p_proveedor_id: Number(e.proveedorId),
    p_fecha: e.fecha,
    p_numero_factura: e.numeroFactura.trim() || null,
    p_metodo_pago: e.metodoPago,
    p_descuento: e.descuento,
    p_aplica_iva: e.aplicaIva,
    p_actualizar_costo: e.actualizarCosto,
    p_observaciones: e.observaciones.trim() || null,
    p_detalles: e.lineas.map((l) => ({ materia_prima_id: Number(l.materiaPrimaId), cantidad: l.cantidad, costo_unitario: l.costoUnitario }))
  })
  if (save.error) return resultado(save.error)
  const recarga = await recargar(true)
  return recarga.ok ? { ok: true, id: String(save.data) } : recarga
}

export async function anularCompra(id: string, motivo: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.rpc('anular_compra', { p_compra_id: Number(id), p_motivo: motivo.trim() || null })
  if (save.error) return resultado(save.error)
  return recargar(true)
}
