'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { cargarInventario } from '../inventario/store'
import type { ResultadoAccion } from '../inventario/tipos'
import type { Cliente, ClienteEntrada, DatosVentas, LineaVenta, MetodoPago, Venta, VentaEntrada } from './tipos'
import { codigoCliente, codigoVenta, ETIQUETAS_METODO_PAGO } from './utilidades'

const vacio: DatosVentas = { ventas: [], clientes: [] }
let estado = vacio
let cargado = false
let errorConexion: string | null = null
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }

export function useVentas(): DatosVentas {
  const datos = useSyncExternalStore(suscribir, () => estado, () => vacio)
  useEffect(() => { cargarVentas().catch((error: Error) => { console.error(error.message) }) }, [])
  return datos
}
export function useErrorVentas(): string | null { return useSyncExternalStore(suscribir, () => errorConexion, () => null) }

async function validarSesion(): Promise<ResultadoAccion> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return { ok: false, error: `No se pudo validar la sesión: ${error.message}` }
  if (!data.session) return { ok: false, error: 'Inicia sesión en el ERP con un usuario de Supabase Auth antes de operar ventas.' }
  return { ok: true }
}

type Fila = Record<string, unknown>
const texto = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
const numero = (v: unknown) => Number(v ?? 0)
const opcional = (v: unknown) => texto(v).trim() || undefined

const mapCliente = (r: Fila): Cliente => ({
  id: String(r.id),
  codigo: codigoCliente(String(r.id)),
  nombre: texto(r.nombre),
  identificacion: opcional(r.identificacion),
  telefono: opcional(r.telefono),
  correo: opcional(r.correo),
  direccion: opcional(r.direccion),
  notas: opcional(r.notas),
  activo: r.activo !== false,
  creadoEn: texto(r.created_at)
})

const mapLinea = (r: Fila): LineaVenta => ({
  productoId: String(r.producto_id),
  cantidad: numero(r.cantidad),
  precioUnitario: numero(r.precio_unitario),
  subtotal: numero(r.subtotal),
  costoUnitario: numero(r.costo_unitario),
  fabricadas: numero(r.fabricadas)
})

const METODOS = Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]

const mapVenta = (r: Fila): Venta => ({
  id: String(r.id),
  codigo: codigoVenta(String(r.id)),
  clienteId: r.cliente_id == null ? undefined : String(r.cliente_id),
  fecha: texto(r.fecha, texto(r.created_at)).slice(0, 10),
  registradoEn: texto(r.created_at),
  metodoPago: METODOS.includes(r.metodo_pago as MetodoPago) ? (r.metodo_pago as MetodoPago) : undefined,
  subtotal: numero(r.subtotal),
  descuento: numero(r.descuento),
  impuesto: numero(r.impuesto),
  total: numero(r.total),
  costoTotal: numero(r.costo_total),
  estado: r.estado === 'anulada' ? 'anulada' : 'completada',
  observaciones: opcional(r.observaciones),
  anuladaEn: opcional(r.anulada_en),
  motivoAnulacion: opcional(r.motivo_anulacion),
  lineas: ((r.venta_detalle as Fila[] | null) ?? []).map(mapLinea)
})

export async function cargarVentas(forzar = false): Promise<void> {
  const sesion = await validarSesion()
  if (!sesion.ok) {
    errorConexion = sesion.error
    notificar()
    throw new Error(sesion.error)
  }
  if (cargado && !forzar) return
  const [v, c] = await Promise.all([
    supabase.from('ventas').select('*, venta_detalle(*)').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(3000),
    supabase.from('clientes').select('*').order('nombre')
  ])
  const err = v.error ?? c.error
  if (err) {
    errorConexion = `No se pudo cargar ventas: ${err.message}`
    notificar()
    throw new Error(errorConexion)
  }
  estado = {
    ventas: (v.data ?? []).map((x) => mapVenta(x as Fila)),
    clientes: (c.data ?? []).map((x) => mapCliente(x as Fila))
  }
  errorConexion = null
  cargado = true
  notificar()
}

function resultado(error: { message: string } | null): ResultadoAccion { return error ? { ok: false, error: error.message } : { ok: true } }
async function recargar(conInventario = false): Promise<ResultadoAccion> {
  try {
    await Promise.all([cargarVentas(true), conInventario ? cargarInventario(true) : Promise.resolve()])
    return { ok: true }
  } catch (err) { return { ok: false, error: (err as Error).message } }
}

// ---------- Clientes ----------

export async function guardarCliente(e: ClienteEntrada, id?: string): Promise<ResultadoAccion & { id?: string }> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!e.nombre.trim()) return { ok: false, error: 'El nombre del cliente es obligatorio.' }
  const identificacion = e.identificacion?.trim().toUpperCase()
  if (identificacion && estado.clientes.some((c) => c.id !== id && c.identificacion?.toUpperCase() === identificacion)) {
    return { ok: false, error: `Ya existe un cliente con la identificación ${identificacion}.` }
  }
  const payload = {
    nombre: e.nombre.trim(),
    identificacion: identificacion || null,
    telefono: e.telefono?.trim() || null,
    correo: e.correo?.trim() || null,
    direccion: e.direccion?.trim() || null,
    notas: e.notas?.trim() || null,
    updated_at: new Date().toISOString()
  }
  const save = id
    ? await supabase.from('clientes').update(payload).eq('id', id).select('id').single()
    : await supabase.from('clientes').insert(payload).select('id').single()
  if (save.error) return resultado(save.error)
  const recarga = await recargar()
  return recarga.ok ? { ok: true, id: String(save.data.id) } : recarga
}

export async function cambiarEstadoCliente(id: string, activo: boolean): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.from('clientes').update({ activo, updated_at: new Date().toISOString() }).eq('id', id)
  if (save.error) return resultado(save.error)
  return recargar()
}

// ---------- Ventas ----------

// Descuenta el stock (fabricando lo faltante), guarda la venta y su ingreso en una sola transacción
export async function registrarVenta(e: VentaEntrada): Promise<ResultadoAccion & { id?: string }> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (e.lineas.length === 0) return { ok: false, error: 'Agregue al menos un producto a la venta.' }
  if (e.lineas.some((l) => !Number.isInteger(l.cantidad) || l.cantidad <= 0)) return { ok: false, error: 'Las cantidades deben ser enteros mayores que cero.' }
  const save = await supabase.rpc('registrar_venta', {
    p_cliente_id: e.clienteId ? Number(e.clienteId) : null,
    p_fecha: e.fecha,
    p_metodo_pago: e.metodoPago,
    p_descuento: e.descuento,
    p_aplica_iva: e.aplicaIva,
    p_observaciones: e.observaciones.trim() || null,
    p_detalles: e.lineas.map((l) => ({ producto_id: Number(l.productoId), cantidad: l.cantidad, precio_unitario: l.precioUnitario }))
  })
  if (save.error) return resultado(save.error)
  const recarga = await recargar(true)
  return recarga.ok ? { ok: true, id: String(save.data) } : recarga
}

export async function anularVenta(id: string, motivo: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.rpc('anular_venta', { p_venta_id: Number(id), p_motivo: motivo.trim() || null })
  if (save.error) return resultado(save.error)
  return recargar(true)
}
