import type {
  Asistencia,
  Empleado,
  EstadoAsistencia,
  EstadoEmpleado,
  EstadoNomina,
  LineaNomina,
  Periodicidad,
  TipoContrato
} from './tipos'

// ---------- Etiquetas ----------

export const ETIQUETAS_ESTADO_EMPLEADO: Record<EstadoEmpleado, string> = {
  activo: 'Activo',
  vacaciones: 'De vacaciones',
  suspendido: 'Suspendido',
  inactivo: 'Dado de baja'
}

export const ETIQUETAS_CONTRATO: Record<TipoContrato, string> = {
  indefinido: 'Tiempo indefinido',
  determinado: 'Tiempo determinado',
  temporal: 'Temporal / por obra'
}

export const ETIQUETAS_ASISTENCIA: Record<EstadoAsistencia, string> = {
  presente: 'Presente',
  tardanza: 'Tardanza',
  ausente: 'Ausente',
  permiso: 'Permiso',
  vacaciones: 'Vacaciones',
  subsidio: 'Subsidio'
}

export const ETIQUETAS_PERIODICIDAD: Record<Periodicidad, string> = {
  quincenal: 'Quincenal',
  mensual: 'Mensual'
}

export const ETIQUETAS_ESTADO_NOMINA: Record<EstadoNomina, string> = {
  borrador: 'Borrador',
  pagada: 'Pagada'
}

// ---------- Parámetros de nómina (Nicaragua) ----------
// Valores de referencia; confírmelos con su contador antes de pagar.

export const TASAS_NOMINA = {
  inssLaboral: 0.07,
  // 21.5 % para empleadores con menos de 50 trabajadores
  inssPatronal: 0.215,
  inatec: 0.02,
  // Las horas extra se pagan al doble del valor de la hora ordinaria
  factorHoraExtra: 2,
  diasPorMes: 30,
  horasPorDia: 8
}

// Tarifa progresiva anual del IR sobre salarios
const TRAMOS_IR = [
  { desde: 0, base: 0, tasa: 0 },
  { desde: 100_000, base: 0, tasa: 0.15 },
  { desde: 200_000, base: 15_000, tasa: 0.2 },
  { desde: 350_000, base: 45_000, tasa: 0.25 },
  { desde: 500_000, base: 82_500, tasa: 0.3 }
]

export function redondear(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export function irAnual(rentaNetaAnual: number) {
  const tramo = [...TRAMOS_IR].reverse().find((item) => rentaNetaAnual > item.desde)
  if (!tramo) return 0
  return tramo.base + (rentaNetaAnual - tramo.desde) * tramo.tasa
}

export function periodosPorMes(periodicidad: Periodicidad) {
  return periodicidad === 'quincenal' ? 2 : 1
}

export function salarioDiario(salarioMensual: number) {
  return salarioMensual / TASAS_NOMINA.diasPorMes
}

export function calcularLinea(
  empleado: Pick<Empleado, 'id' | 'salarioMensual'>,
  periodicidad: Periodicidad,
  variables: { diasAusencia: number; horasExtra: number; bonificaciones: number; otrasDeducciones: number }
): LineaNomina {
  const factor = periodosPorMes(periodicidad)
  const salarioBase = redondear(empleado.salarioMensual / factor)
  const diario = salarioDiario(empleado.salarioMensual)
  const valorHora = diario / TASAS_NOMINA.horasPorDia

  const descuentoAusencias = redondear(Math.min(salarioBase, variables.diasAusencia * diario))
  const montoHorasExtra = redondear(variables.horasExtra * valorHora * TASAS_NOMINA.factorHoraExtra)
  const bonificaciones = redondear(variables.bonificaciones)
  const totalDevengado = redondear(salarioBase - descuentoAusencias + montoHorasExtra + bonificaciones)

  const inssLaboral = redondear(totalDevengado * TASAS_NOMINA.inssLaboral)
  // El IR se proyecta a un año con el ingreso del período y se prorratea de vuelta
  const periodosAnio = factor * 12
  const ir = redondear(irAnual((totalDevengado - inssLaboral) * periodosAnio) / periodosAnio)
  const otrasDeducciones = redondear(variables.otrasDeducciones)
  const totalDeducciones = redondear(inssLaboral + ir + otrasDeducciones)

  return {
    empleadoId: empleado.id,
    salarioBase,
    diasAusencia: variables.diasAusencia,
    descuentoAusencias,
    horasExtra: variables.horasExtra,
    montoHorasExtra,
    bonificaciones,
    totalDevengado,
    inssLaboral,
    ir,
    otrasDeducciones,
    totalDeducciones,
    netoPagar: redondear(totalDevengado - totalDeducciones),
    inssPatronal: redondear(totalDevengado * TASAS_NOMINA.inssPatronal),
    inatec: redondear(totalDevengado * TASAS_NOMINA.inatec)
  }
}

export function totalesNomina(lineas: LineaNomina[]) {
  const sumar = (campo: keyof LineaNomina) =>
    redondear(lineas.reduce((total, linea) => total + Number(linea[campo]), 0))
  return {
    devengado: sumar('totalDevengado'),
    deducciones: sumar('totalDeducciones'),
    neto: sumar('netoPagar'),
    aportesPatronales: redondear(sumar('inssPatronal') + sumar('inatec'))
  }
}

// Ausencias injustificadas y horas extra registradas en el rango de fechas
export function variablesAsistencia(asistencias: Asistencia[], empleadoId: string, inicio: string, fin: string) {
  const delPeriodo = asistencias.filter(
    (item) => item.empleadoId === empleadoId && item.fecha >= inicio && item.fecha <= fin
  )
  return {
    diasAusencia: delPeriodo.filter((item) => item.estado === 'ausente').length,
    horasExtra: redondear(delPeriodo.reduce((total, item) => total + item.horasExtra, 0))
  }
}

// Empleados que entran en la planilla: no dados de baja e ingresados antes del cierre
export function empleadosParaNomina(empleados: Empleado[], periodoFin: string) {
  return empleados
    .filter((item) => item.estado !== 'inactivo' && item.fechaIngreso <= periodoFin)
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
}

// Primera y segunda quincena, o mes completo, que contiene la fecha dada
export function periodoSugerido(fecha: string, periodicidad: Periodicidad) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  const ultimoDia = new Date(anio, mes, 0).getDate()
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}`
  if (periodicidad === 'mensual') return { inicio: `${prefijo}-01`, fin: `${prefijo}-${ultimoDia}` }
  return dia <= 15
    ? { inicio: `${prefijo}-01`, fin: `${prefijo}-15` }
    : { inicio: `${prefijo}-16`, fin: `${prefijo}-${ultimoDia}` }
}

// ---------- Otros ----------

export function nombreCompleto(empleado: Pick<Empleado, 'nombres' | 'apellidos'>) {
  return `${empleado.nombres} ${empleado.apellidos}`.trim()
}

export function iniciales(empleado: Pick<Empleado, 'nombres' | 'apellidos'>) {
  return `${empleado.nombres.charAt(0)}${empleado.apellidos.charAt(0)}`.toUpperCase()
}

// Años y meses cumplidos desde la fecha de ingreso
export function antiguedad(fechaIngreso: string, hasta: string) {
  const [a1, m1, d1] = fechaIngreso.split('-').map(Number)
  const [a2, m2, d2] = hasta.split('-').map(Number)
  let meses = (a2 - a1) * 12 + (m2 - m1)
  if (d2 < d1) meses -= 1
  if (meses < 0) return 'Aún no ingresa'
  const anios = Math.floor(meses / 12)
  const resto = meses % 12
  const partes = []
  if (anios) partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`)
  if (resto || !anios) partes.push(`${resto} ${resto === 1 ? 'mes' : 'meses'}`)
  return partes.join(' y ')
}

export function siguienteCodigo(empleados: Empleado[]) {
  const mayor = empleados.reduce((maximo, item) => {
    const numero = Number(item.codigo.replace(/\D/g, ''))
    return Number.isFinite(numero) ? Math.max(maximo, numero) : maximo
  }, 0)
  return `EMP-${String(mayor + 1).padStart(3, '0')}`
}
