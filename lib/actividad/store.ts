'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import { cargarCompras, useCompras } from '../compras/store'
import { cargarFinanzas, useFinanzas } from '../finanzas/store'
import { cargarInventario, useInventario } from '../inventario/store'
import { cargarProduccion, useProduccion } from '../produccion/store'
import { cargarRecursosHumanos, useRecursosHumanos } from '../recursos-humanos/store'
import { cargarVentas, useVentas } from '../ventas/store'
import { alertasActuales, eventosActividad, type Alerta, type EventoActividad, type FuentesActividad } from './eventos'

// Datos de todos los módulos que alimentan la bitácora y las notificaciones
export function useFuentesActividad(): FuentesActividad {
  const inventario = useInventario()
  const ventas = useVentas()
  const compras = useCompras()
  const produccion = useProduccion()
  const finanzas = useFinanzas()
  const recursosHumanos = useRecursosHumanos()
  return useMemo(
    () => ({ inventario, ventas, compras, produccion, finanzas, recursosHumanos }),
    [inventario, ventas, compras, produccion, finanzas, recursosHumanos]
  )
}

export function useActividad(): EventoActividad[] {
  const fuentes = useFuentesActividad()
  return useMemo(() => eventosActividad(fuentes), [fuentes])
}

// Trae lo último de la base (por ejemplo, lo que registró otro usuario)
export async function recargarActividad(): Promise<void> {
  await Promise.allSettled([
    cargarInventario(true),
    cargarVentas(true),
    cargarCompras(true),
    cargarProduccion(true),
    cargarFinanzas(true),
    cargarRecursosHumanos(true),
    cargarLeidas(true)
  ])
}

// ---------- Notificaciones ----------

// Ventana de actividad que se muestra como notificación
export const DIAS_NOTIFICACION = 30

export type Notificacion =
  | ({ clase: 'alerta' } & Alerta & { leida: boolean })
  | ({ clase: 'evento' } & EventoActividad & { leida: boolean })

let leidas = new Set<string>()
let leidasCargadas = false
let errorLeidas: string | null = null
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }

async function cargarLeidas(forzar = false): Promise<void> {
  if (leidasCargadas && !forzar) return
  const { data, error } = await supabase.from('notificaciones_leidas').select('clave').limit(10000)
  if (error) {
    errorLeidas = 'No se pudo guardar qué notificaciones leíste: aplica la migración 202610250001_validaciones_notificaciones.sql en Supabase.'
  } else {
    leidas = new Set(data.map((f) => String(f.clave)))
    errorLeidas = null
  }
  leidasCargadas = true
  notificar()
}

export function useErrorNotificaciones(): string | null {
  return useSyncExternalStore(suscribir, () => errorLeidas, () => null)
}

export async function marcarLeidas(claves: string[]): Promise<void> {
  const nuevas = claves.filter((c) => !leidas.has(c))
  if (nuevas.length === 0) return
  // Se marca al instante en pantalla y luego se guarda
  leidas = new Set([...leidas, ...nuevas])
  notificar()
  const { error } = await supabase.from('notificaciones_leidas').upsert(nuevas.map((clave) => ({ clave })), { onConflict: 'user_id,clave', ignoreDuplicates: true })
  if (error) {
    errorLeidas = `No se pudo guardar como leída: ${error.message}`
    notificar()
  }
}

export async function marcarNoLeida(clave: string): Promise<void> {
  if (!leidas.has(clave)) return
  leidas = new Set([...leidas].filter((c) => c !== clave))
  notificar()
  await supabase.from('notificaciones_leidas').delete().eq('clave', clave)
}

export function useNotificaciones(): { notificaciones: Notificacion[]; sinLeer: number } {
  const fuentes = useFuentesActividad()
  const eventos = useActividad()
  const leidasActuales = useSyncExternalStore(suscribir, () => leidas, () => leidas)
  useEffect(() => { cargarLeidas().catch(() => undefined) }, [])
  // Inicio de la ventana de notificaciones, fijado al montar
  const [limite] = useState(() => Date.now() - DIAS_NOTIFICACION * 24 * 60 * 60 * 1000)

  return useMemo(() => {
    const notificaciones: Notificacion[] = [
      ...alertasActuales(fuentes).map((a) => ({ clase: 'alerta' as const, ...a, leida: leidasActuales.has(a.clave) })),
      ...eventos.filter((e) => e.momento >= limite).map((e) => ({ clase: 'evento' as const, ...e, leida: leidasActuales.has(e.clave) }))
    ]
    return { notificaciones, sinLeer: notificaciones.filter((n) => !n.leida).length }
  }, [fuentes, eventos, leidasActuales, limite])
}
