'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { ResultadoAccion } from '../inventario/tipos'

// 'preparacion' = la máquina se está calentando o alistando; no produce todavía
export type EstadoLectura = 'operando' | 'preparacion' | 'inactivo' | 'paro' | 'alarma'

export interface LecturaIiot {
  id: string
  dispositivo: string
  centroTrabajoId?: string
  plantaId?: string
  ordenOperacionId?: string
  temperatura?: number
  presion?: number
  humedad?: number
  piezas: number
  estado: EstadoLectura
  mensaje?: string
  // Potencia en el momento de la lectura y energía gastada desde la lectura anterior
  potenciaKw?: number
  energiaKwh: number
  origen: 'planta' | 'demo'
  // Cuándo la tomó el dispositivo y cuándo llegó al ERP (la diferencia es su espera en la cola de envío)
  registradoEn: string
  recibidoEn: string
}

// Una fila por día y dispositivo (función resumen_iiot_diario)
export interface ResumenDiaIiot {
  dia: string
  dispositivo: string
  centroTrabajoId?: string
  plantaId?: string
  lecturas: number
  operando: number
  tempProm?: number
  tempMin?: number
  tempMax?: number
  alarmas: number
  paros: number
  piezas: number
  energiaKwh: number
  potenciaMax?: number
  esperaPromS: number
  esperaMaxS: number
}

type Fila = Record<string, unknown>
const opcionalNumero = (v: unknown) => v == null ? undefined : Number(v)
const idOpcional = (v: unknown) => v == null ? undefined : String(v)
const ESTADOS: EstadoLectura[] = ['operando', 'preparacion', 'inactivo', 'paro', 'alarma']

const mapLectura = (r: Fila): LecturaIiot => ({
  id: String(r.id),
  dispositivo: String(r.dispositivo ?? ''),
  centroTrabajoId: idOpcional(r.centro_trabajo_id),
  plantaId: idOpcional(r.planta_id),
  ordenOperacionId: idOpcional(r.orden_operacion_id),
  temperatura: opcionalNumero(r.temperatura),
  presion: opcionalNumero(r.presion),
  humedad: opcionalNumero(r.humedad),
  piezas: Number(r.piezas ?? 0),
  estado: ESTADOS.includes(r.estado as EstadoLectura) ? (r.estado as EstadoLectura) : 'operando',
  mensaje: typeof r.mensaje === 'string' && r.mensaje.trim() ? r.mensaje : undefined,
  potenciaKw: opcionalNumero(r.potencia_kw),
  energiaKwh: Number(r.energia_kwh ?? 0),
  origen: r.origen === 'demo' ? 'demo' : 'planta',
  registradoEn: String(r.registrado_en ?? ''),
  recibidoEn: String(r.recibido_en ?? r.registrado_en ?? '')
})

const mapResumen = (r: Fila): ResumenDiaIiot => ({
  dia: String(r.dia ?? '').slice(0, 10),
  dispositivo: String(r.dispositivo ?? ''),
  centroTrabajoId: idOpcional(r.centro_trabajo_id),
  plantaId: idOpcional(r.planta_id),
  lecturas: Number(r.lecturas ?? 0),
  operando: Number(r.operando ?? 0),
  tempProm: opcionalNumero(r.temp_prom),
  tempMin: opcionalNumero(r.temp_min),
  tempMax: opcionalNumero(r.temp_max),
  alarmas: Number(r.alarmas ?? 0),
  paros: Number(r.paros ?? 0),
  piezas: Number(r.piezas ?? 0),
  energiaKwh: Number(r.energia_kwh ?? 0),
  potenciaMax: opcionalNumero(r.potencia_max),
  esperaPromS: Number(r.espera_prom_s ?? 0),
  esperaMaxS: Number(r.espera_max_s ?? 0)
})

const AVISO_MIGRACION = '¿Aplicaste la migración 202610300001_plantas_energia_destajo.sql?'

// Últimas lecturas de la planta, consultadas de nuevo cada pocos segundos mientras la pantalla está abierta
export function useLecturasIiot(intervaloMs = 5000, limite = 400) {
  const [lecturas, setLecturas] = useState<LecturaIiot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [actualizado, setActualizado] = useState<Date | null>(null)

  useEffect(() => {
    let vigente = true
    const consultar = async () => {
      const { data, error: err } = await supabase
        .from('lecturas_iiot')
        .select('*')
        .eq('origen', 'planta')
        .order('registrado_en', { ascending: false })
        .limit(limite)
      if (!vigente) return
      if (err) { setError(`No se pudieron leer los sensores: ${err.message}. ${AVISO_MIGRACION}`); return }
      setError(null)
      setLecturas((data ?? []).map((x) => mapLectura(x as Fila)))
      setActualizado(new Date())
    }
    consultar()
    const temporizador = setInterval(consultar, intervaloMs)
    return () => { vigente = false; clearInterval(temporizador) }
  }, [intervaloMs, limite])

  return { lecturas, error, actualizado }
}

// Resumen por día y dispositivo entre dos fechas (aaaa-mm-dd, hora de Nicaragua)
export function useResumenIiot(desde: string, hasta: string, intervaloMs?: number) {
  const [version, setVersion] = useState(0)
  const clave = `${desde}|${hasta}|${version}`
  // La consulta guarda para qué fechas respondió: mientras no coincida con las pedidas, está cargando
  const [resultado, setResultado] = useState<{ clave: string; filas: ResumenDiaIiot[]; error: string | null }>({ clave: '', filas: [], error: null })
  const recargar = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let vigente = true
    const consultar = async () => {
      const { data, error: err } = await supabase.rpc('resumen_iiot_diario', { p_desde: desde, p_hasta: hasta })
      if (!vigente) return
      setResultado((anterior) => err
        ? { clave, filas: anterior.filas, error: `No se pudo calcular el resumen: ${err.message}. ${AVISO_MIGRACION}` }
        : { clave, filas: ((data ?? []) as Fila[]).map(mapResumen), error: null })
    }
    consultar()
    const temporizador = intervaloMs ? setInterval(consultar, intervaloMs) : undefined
    return () => { vigente = false; if (temporizador) clearInterval(temporizador) }
  }, [clave, desde, hasta, intervaloMs])

  return { filas: resultado.filas, error: resultado.error, cargando: resultado.clave !== clave, recargar }
}

// Todas las lecturas de un dispositivo en un día (para ver la curva de ese día)
export async function lecturasDelDia(dispositivo: string, dia: string): Promise<LecturaIiot[]> {
  const inicio = new Date(`${dia}T00:00:00-06:00`).toISOString()
  const fin = new Date(new Date(`${dia}T00:00:00-06:00`).getTime() + 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('lecturas_iiot')
    .select('*')
    .eq('dispositivo', dispositivo)
    .gte('registrado_en', inicio)
    .lt('registrado_en', fin)
    .order('registrado_en')
    .limit(3000)
  if (error) return []
  return (data ?? []).map((x) => mapLectura(x as Fila))
}

// Piezas que el sensor contó mientras una operación de orden estaba en proceso
export async function piezasContadasOperacion(operacionId: string): Promise<number> {
  const conteo = await piezasPorOperacion([operacionId])
  return conteo.get(operacionId) ?? 0
}

export async function piezasPorOperacion(operaciones: string[]): Promise<Map<string, number>> {
  const conteo = new Map<string, number>()
  if (operaciones.length === 0) return conteo
  const { data, error } = await supabase.from('lecturas_iiot').select('orden_operacion_id, piezas').in('orden_operacion_id', operaciones.map(Number))
  if (error) return conteo
  for (const r of (data ?? []) as Fila[]) {
    const id = String(r.orden_operacion_id)
    conteo.set(id, (conteo.get(id) ?? 0) + Number(r.piezas ?? 0))
  }
  return conteo
}

// ---------- Datos de ejemplo para el análisis histórico ----------

export async function generarHistoricoIiot(dias: number): Promise<ResultadoAccion & { lecturas?: number }> {
  const { data, error } = await supabase.rpc('generar_historico_iiot', { p_dias: dias })
  if (error) return { ok: false, error: `${error.message}. ${AVISO_MIGRACION}` }
  return { ok: true, lecturas: Number((data as Fila | null)?.lecturas ?? 0) }
}

export async function borrarHistoricoIiot(): Promise<ResultadoAccion & { lecturas?: number }> {
  const { data, error } = await supabase.rpc('borrar_historico_iiot')
  if (error) return { ok: false, error: error.message }
  return { ok: true, lecturas: Number(data ?? 0) }
}
