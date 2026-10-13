// Tipos compartidos del módulo de recursos humanos.

export type EstadoEmpleado = 'activo' | 'vacaciones' | 'suspendido' | 'inactivo'

export type TipoContrato = 'indefinido' | 'determinado' | 'temporal'

export type EstadoAsistencia = 'presente' | 'tardanza' | 'ausente' | 'permiso' | 'vacaciones' | 'subsidio'

export type Periodicidad = 'quincenal' | 'mensual'

export type EstadoNomina = 'borrador' | 'pagada'

export interface Empleado {
  id: string
  codigo: string
  nombres: string
  apellidos: string
  cedula: string
  numeroInss: string
  cargo: string
  area: string
  telefono: string
  correo: string
  direccion: string
  fechaIngreso: string
  fechaBaja?: string
  tipoContrato: TipoContrato
  salarioMensual: number
  estado: EstadoEmpleado
}

export interface Asistencia {
  id: string
  empleadoId: string
  fecha: string
  estado: EstadoAsistencia
  horasExtra: number
  observaciones?: string
}

// Montos calculados de un empleado dentro de una planilla
export interface LineaNomina {
  empleadoId: string
  salarioBase: number
  diasAusencia: number
  descuentoAusencias: number
  horasExtra: number
  montoHorasExtra: number
  bonificaciones: number
  totalDevengado: number
  inssLaboral: number
  ir: number
  otrasDeducciones: number
  totalDeducciones: number
  netoPagar: number
  inssPatronal: number
  inatec: number
}

export interface Nomina {
  id: string
  periodicidad: Periodicidad
  periodoInicio: string
  periodoFin: string
  estado: EstadoNomina
  fechaPago?: string
  totalDevengado: number
  totalDeducciones: number
  totalNeto: number
  totalAportesPatronales: number
  observaciones?: string
  creadoEn: string
  lineas: LineaNomina[]
}

export interface DatosRecursosHumanos {
  empleados: Empleado[]
  asistencias: Asistencia[]
  nominas: Nomina[]
}

export type EmpleadoEntrada = Omit<Empleado, 'id'>

export type AsistenciaEntrada = Omit<Asistencia, 'id'>

export type NominaEntrada = Pick<Nomina, 'periodicidad' | 'periodoInicio' | 'periodoFin' | 'observaciones' | 'lineas'>
