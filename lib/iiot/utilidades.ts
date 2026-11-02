import type { EstadoLectura } from './store'

// Estado que se muestra de un dispositivo: el de su última lectura, o "sin señal" si dejó de reportar
export type EstadoDispositivo = EstadoLectura | 'sin_senal'

// Si un dispositivo no manda lecturas en este tiempo se considera apagado o desconectado
export const SIN_SENAL_MS = 20_000

export const ETIQUETAS_ESTADO_LECTURA: Record<EstadoDispositivo, string> = {
  operando: 'Produciendo',
  preparacion: 'Calentando',
  inactivo: 'Esperando trabajo',
  paro: 'Detenida',
  alarma: 'Alarma',
  sin_senal: 'Sin señal'
}

// Qué significa cada estado, en palabras simples
export const SIGNIFICADO_ESTADO: Record<EstadoDispositivo, string> = {
  operando: 'Está fabricando piezas y todos sus sensores están dentro del rango correcto.',
  preparacion: 'Se está alistando o calentando antes de producir. Estar bajo el rango aquí es normal.',
  inactivo: 'Está encendida y conectada, pero no tiene ninguna operación asignada.',
  paro: 'Tenía trabajo pero se detuvo (atasco, ajuste, falta de operario, corte de energía…).',
  alarma: 'Está produciendo con la temperatura fuera del rango del centro: hay que revisarla.',
  sin_senal: 'Dejó de enviar lecturas: está apagada, sin energía o sin conexión a la red.'
}

// ---------- Fechas en hora de Nicaragua ----------

export function diaManagua(fecha: Date | string = new Date()) {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Managua' })
}

export function sumarDias(dia: string, dias: number) {
  const fecha = new Date(`${dia}T12:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha.toISOString().slice(0, 10)
}

export function diasEntre(desde: string, hasta: string) {
  const dias: string[] = []
  for (let d = desde; d <= hasta && dias.length < 400; d = sumarDias(d, 1)) dias.push(d)
  return dias
}

export function etiquetaDia(dia: string) {
  const fecha = new Date(`${dia}T12:00:00Z`)
  return fecha.toLocaleDateString('es-NI', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

// ---------- Energía y huella de carbono ----------

// Equivalencias aproximadas para dar una idea del tamaño de la huella (valores de referencia comunes)
export const KG_CO2_POR_KM_AUTO = 0.17
export const KG_CO2_ABSORBE_ARBOL_ANIO = 21

export function formatoKwh(kwh: number) {
  if (kwh >= 1000) return `${(Math.round(kwh / 10) / 100).toLocaleString('es-NI')} MWh`
  return `${(Math.round(kwh * 100) / 100).toLocaleString('es-NI')} kWh`
}

export function formatoKg(kg: number) {
  if (kg >= 1000) return `${(Math.round(kg / 10) / 100).toLocaleString('es-NI')} t CO₂`
  return `${(Math.round(kg * 10) / 10).toLocaleString('es-NI')} kg CO₂`
}

export function formatoKw(kw: number) {
  return `${(Math.round(kw * 100) / 100).toLocaleString('es-NI')} kW`
}

export function formatoSegundos(segundos: number) {
  if (segundos < 1) return 'al instante'
  if (segundos < 90) return `${Math.round(segundos)} s`
  return `${Math.round(segundos / 60)} min`
}

// Dispositivo medidor de las lámparas de una planta (PL-01 → LUCES-PL01)
export function dispositivoLuces(codigoPlanta: string) {
  return `LUCES-${codigoPlanta.replace(/-/g, '')}`
}
