// Producción por empleado (para el destajo) y análisis de carga del personal.
import { diaManagua, diasEntre } from '../iiot/utilidades'
import type { CentroTrabajo, OperacionRuta, OrdenProduccion } from '../produccion/tipos'
import { cargaPendientePorCentro, duracionOperacion } from '../produccion/utilidades'
import type { Asistencia, Empleado } from './tipos'
import { TASAS_NOMINA } from './utilidades'

export interface ProduccionEmpleado {
  // Piezas buenas de las operaciones que terminó (cada operación cuenta: es trabajo distinto)
  piezas: number
  // Piezas × tarifa de destajo del centro de cada operación
  monto: number
  operaciones: number
  // Minutos de planta trabajados en esas operaciones
  minutos: number
  ordenes: Set<string>
  porCentro: Map<string, { piezas: number; monto: number }>
}

// Operaciones terminadas entre dos fechas (hora de Nicaragua), agrupadas por el empleado que las hizo
export function produccionPorEmpleado(ordenes: OrdenProduccion[], centros: CentroTrabajo[], inicio: string, fin: string) {
  const tarifa = new Map(centros.map((c) => [c.id, c.tarifaDestajo]))
  const resultado = new Map<string, ProduccionEmpleado>()
  for (const orden of ordenes) {
    for (const op of orden.operaciones) {
      if (op.estado !== 'completada' || !op.fin || !op.empleadoId) continue
      const dia = diaManagua(op.fin)
      if (dia < inicio || dia > fin) continue
      const actual = resultado.get(op.empleadoId) ?? { piezas: 0, monto: 0, operaciones: 0, minutos: 0, ordenes: new Set<string>(), porCentro: new Map() }
      const monto = op.cantidadBuena * (tarifa.get(op.centroTrabajoId ?? '') ?? 0)
      actual.piezas += op.cantidadBuena
      actual.monto += monto
      actual.operaciones += 1
      actual.minutos += duracionOperacion(op)
      actual.ordenes.add(orden.id)
      const centro = actual.porCentro.get(op.centroTrabajoId ?? '') ?? { piezas: 0, monto: 0 }
      centro.piezas += op.cantidadBuena
      centro.monto += monto
      actual.porCentro.set(op.centroTrabajoId ?? '', centro)
      resultado.set(op.empleadoId, actual)
    }
  }
  return resultado
}

// ---------- Carga del personal ----------

export type NivelOcupacion = 'sin_produccion' | 'subutilizado' | 'adecuado' | 'sobrecargado'

export const ETIQUETAS_OCUPACION: Record<NivelOcupacion, string> = {
  sin_produccion: 'Sin producción',
  subutilizado: 'Poco ocupado',
  adecuado: 'Bien ocupado',
  sobrecargado: 'Sobrecargado'
}

// Por debajo de este porcentaje del tiempo disponible el empleado se considera poco ocupado
export const UMBRAL_SUBUTILIZADO = 0.5

export function nivelOcupacion(utilizacion: number): NivelOcupacion {
  if (utilizacion <= 0) return 'sin_produccion'
  if (utilizacion < UMBRAL_SUBUTILIZADO) return 'subutilizado'
  if (utilizacion <= 1) return 'adecuado'
  return 'sobrecargado'
}

// Lunes a sábado entre dos fechas
export function diasHabiles(inicio: string, fin: string) {
  return diasEntre(inicio, fin).filter((d) => new Date(`${d}T12:00:00Z`).getUTCDay() !== 0).length
}

export interface FilaPersonal {
  empleado: Empleado
  diasTrabajados: number
  // Según asistencia si se registró; si no, los días hábiles desde su ingreso
  segunAsistencia: boolean
  horasDisponibles: number
  horasProduccion: number
  utilizacion: number
  piezas: number
  operaciones: number
  ordenes: number
  // Órdenes pendientes asignadas a él (esperando en su cola)
  enCola: number
  nivel: NivelOcupacion
}

export function analizarPersonal(datos: {
  empleados: Empleado[]
  asistencias: Asistencia[]
  ordenes: OrdenProduccion[]
  centros: CentroTrabajo[]
  inicio: string
  fin: string
}): FilaPersonal[] {
  const hoy = diaManagua()
  const fin = datos.fin > hoy ? hoy : datos.fin
  const produccion = produccionPorEmpleado(datos.ordenes, datos.centros, datos.inicio, fin)
  return datos.empleados.map((empleado) => {
    const asistencias = datos.asistencias.filter((a) => a.empleadoId === empleado.id && a.fecha >= datos.inicio && a.fecha <= fin)
    const desde = empleado.fechaIngreso > datos.inicio ? empleado.fechaIngreso : datos.inicio
    const diasTrabajados = asistencias.length
      ? asistencias.filter((a) => a.estado === 'presente' || a.estado === 'tardanza').length
      : desde <= fin ? diasHabiles(desde, fin) : 0
    const horasDisponibles = diasTrabajados * TASAS_NOMINA.horasPorDia
    const p = produccion.get(empleado.id)
    const horasProduccion = (p?.minutos ?? 0) / 60
    const utilizacion = horasDisponibles > 0 ? horasProduccion / horasDisponibles : horasProduccion > 0 ? 2 : 0
    return {
      empleado,
      diasTrabajados,
      segunAsistencia: asistencias.length > 0,
      horasDisponibles,
      horasProduccion,
      utilizacion,
      piezas: p?.piezas ?? 0,
      operaciones: p?.operaciones ?? 0,
      ordenes: p?.ordenes.size ?? 0,
      enCola: datos.ordenes.filter((o) => o.estado === 'pendiente' && o.empleadoId === empleado.id).length,
      nivel: nivelOcupacion(utilizacion)
    }
  })
}

// Horas de trabajo estándar que faltan en las órdenes abiertas
export function horasPendientes(ordenes: OrdenProduccion[], rutas: OperacionRuta[]) {
  return [...cargaPendientePorCentro(ordenes, rutas).values()].reduce((t, v) => t + v, 0) / 60
}
