'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import type { ResultadoAccion } from '../inventario/tipos'
import type { MetodoPago } from '../ventas/tipos'
import { ETIQUETAS_METODO_PAGO } from '../ventas/utilidades'
import type { DatosFinanzas, MovimientoFinanciero, MovimientoFinancieroEntrada, OrigenFinanciero, TipoFinanciero } from './tipos'
import { CATEGORIA_COMPRAS, CATEGORIA_NOMINA, CATEGORIA_VENTAS } from './utilidades'

const vacio: DatosFinanzas = { ingresos: [], gastos: [] }
let estado = vacio
let cargado = false
let errorConexion: string | null = null
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }

// Ventas, compras y nómina escriben en ingresos/gastos desde sus módulos, por eso cada pantalla recarga al abrirse
export function useFinanzas(): DatosFinanzas {
  const datos = useSyncExternalStore(suscribir, () => estado, () => vacio)
  useEffect(() => { cargarFinanzas(true).catch((error: Error) => { console.error(error.message) }) }, [])
  return datos
}
export function useErrorFinanzas(): string | null { return useSyncExternalStore(suscribir, () => errorConexion, () => null) }

async function validarSesion(): Promise<ResultadoAccion> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return { ok: false, error: `No se pudo validar la sesión: ${error.message}` }
  if (!data.session) return { ok: false, error: 'Inicia sesión en el ERP con un usuario de Supabase Auth antes de operar finanzas.' }
  return { ok: true }
}

type Fila = Record<string, unknown>
const texto = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
const opcional = (v: unknown) => texto(v).trim() || undefined
const METODOS = Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]
const ORIGENES: OrigenFinanciero[] = ['venta', 'compra', 'nomina']
const TABLA: Record<TipoFinanciero, 'ingresos' | 'gastos'> = { ingreso: 'ingresos', gasto: 'gastos' }

const mapMovimiento = (tipo: TipoFinanciero) => (r: Fila): MovimientoFinanciero => {
  const origen = ORIGENES.includes(r.referencia_tipo as OrigenFinanciero) && r.referencia_id != null ? (r.referencia_tipo as OrigenFinanciero) : 'manual'
  return {
    id: String(r.id),
    tipo,
    concepto: texto(r.concepto),
    categoria: texto(r.categoria).trim() || (tipo === 'ingreso' ? 'Otros ingresos' : 'Otros gastos'),
    monto: Number(r.monto ?? 0),
    fecha: texto(r.fecha, texto(r.created_at)).slice(0, 10),
    registradoEn: texto(r.created_at),
    metodoPago: METODOS.includes(r.metodo_pago as MetodoPago) ? (r.metodo_pago as MetodoPago) : undefined,
    observaciones: opcional(r.observaciones),
    origen,
    referenciaId: origen === 'manual' ? undefined : String(r.referencia_id)
  }
}

export async function cargarFinanzas(forzar = false): Promise<void> {
  const sesion = await validarSesion()
  if (!sesion.ok) {
    errorConexion = sesion.error
    notificar()
    throw new Error(sesion.error)
  }
  if (cargado && !forzar) return
  const [i, g] = await Promise.all([
    supabase.from('ingresos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(10000),
    supabase.from('gastos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false }).limit(10000)
  ])
  const err = i.error ?? g.error
  if (err) {
    errorConexion = `No se pudo cargar finanzas: ${err.message}`
    notificar()
    throw new Error(errorConexion)
  }
  estado = {
    ingresos: (i.data ?? []).map((x) => mapMovimiento('ingreso')(x as Fila)),
    gastos: (g.data ?? []).map((x) => mapMovimiento('gasto')(x as Fila))
  }
  errorConexion = null
  cargado = true
  notificar()
}

function resultado(error: { message: string } | null): ResultadoAccion { return error ? { ok: false, error: error.message } : { ok: true } }
async function recargar(): Promise<ResultadoAccion> {
  try { await cargarFinanzas(true); return { ok: true } } catch (err) { return { ok: false, error: (err as Error).message } }
}

function buscar(tipo: TipoFinanciero, id: string) {
  return (tipo === 'ingreso' ? estado.ingresos : estado.gastos).find((m) => m.id === id)
}

// Solo los movimientos manuales se crean, editan o eliminan aquí; los automáticos se gestionan en su módulo
export async function guardarMovimientoFinanciero(tipo: TipoFinanciero, e: MovimientoFinancieroEntrada, id?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (!e.concepto.trim()) return { ok: false, error: 'El concepto es obligatorio.' }
  if (!e.categoria.trim()) return { ok: false, error: 'La categoría es obligatoria.' }
  if (!Number.isFinite(e.monto) || e.monto <= 0) return { ok: false, error: 'El monto debe ser mayor que cero.' }
  const reservadas = [CATEGORIA_VENTAS, CATEGORIA_COMPRAS, CATEGORIA_NOMINA].map((c) => c.toLowerCase())
  if (reservadas.includes(e.categoria.trim().toLowerCase())) {
    return { ok: false, error: `La categoría "${e.categoria.trim()}" la registra automáticamente su módulo. Use otra categoría.` }
  }
  if (id && buscar(tipo, id)?.origen !== 'manual') return { ok: false, error: 'Este registro es automático; modifíquelo desde su módulo de origen.' }
  const payload = {
    concepto: e.concepto.trim(),
    categoria: e.categoria.trim(),
    monto: Math.round(e.monto * 100) / 100,
    fecha: e.fecha,
    metodo_pago: e.metodoPago,
    observaciones: e.observaciones.trim() || null,
    updated_at: new Date().toISOString()
  }
  const save = id
    ? await supabase.from(TABLA[tipo]).update(payload).eq('id', id).is('referencia_id', null)
    : await supabase.from(TABLA[tipo]).insert(payload)
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function eliminarMovimientoFinanciero(tipo: TipoFinanciero, id: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (buscar(tipo, id)?.origen !== 'manual') return { ok: false, error: 'Este registro es automático; anúlelo desde su módulo de origen.' }
  const del = await supabase.from(TABLA[tipo]).delete().eq('id', id).is('referencia_id', null)
  if (del.error) return resultado(del.error)
  return recargar()
}
