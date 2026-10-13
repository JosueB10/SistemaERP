'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '../supabase'
import type { ResultadoAccion } from '../inventario/tipos'
import { fechaHoy, normalizarTexto } from '../inventario/utilidades'
import type {
  Asistencia,
  AsistenciaEntrada,
  DatosRecursosHumanos,
  Empleado,
  EmpleadoEntrada,
  EstadoAsistencia,
  EstadoEmpleado,
  LineaNomina,
  Nomina,
  NominaEntrada,
  TipoContrato
} from './tipos'
import { totalesNomina } from './utilidades'

const vacio: DatosRecursosHumanos = { empleados: [], asistencias: [], nominas: [] }
let estado = vacio
let cargado = false
let errorConexion: string | null = null
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }

export function useRecursosHumanos(): DatosRecursosHumanos {
  const datos = useSyncExternalStore(suscribir, () => estado, () => vacio)
  useEffect(() => { cargarRecursosHumanos().catch((error: Error) => { console.error(error.message) }) }, [])
  return datos
}
export function useErrorRecursosHumanos(): string | null { return useSyncExternalStore(suscribir, () => errorConexion, () => null) }

async function validarSesion(): Promise<ResultadoAccion> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return { ok: false, error: `No se pudo validar la sesión: ${error.message}` }
  if (!data.session) return { ok: false, error: 'Inicia sesión en el ERP con un usuario de Supabase Auth antes de operar recursos humanos.' }
  return { ok: true }
}

type Fila = Record<string, unknown>
const texto = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback
const numero = (v: unknown) => Number(v ?? 0)

const mapEmpleado = (r: Fila): Empleado => ({
  id: String(r.id),
  codigo: texto(r.codigo, `EMP-${r.id}`),
  nombres: texto(r.nombres),
  apellidos: texto(r.apellidos),
  cedula: texto(r.cedula),
  numeroInss: texto(r.numero_inss),
  cargo: texto(r.cargo),
  area: texto(r.area),
  telefono: texto(r.telefono),
  correo: texto(r.correo),
  direccion: texto(r.direccion),
  fechaIngreso: texto(r.fecha_ingreso),
  fechaBaja: texto(r.fecha_baja) || undefined,
  tipoContrato: texto(r.tipo_contrato, 'indefinido') as TipoContrato,
  salarioMensual: numero(r.salario_mensual),
  estado: texto(r.estado, 'activo') as EstadoEmpleado
})

const mapAsistencia = (r: Fila): Asistencia => ({
  id: String(r.id),
  empleadoId: String(r.empleado_id),
  fecha: texto(r.fecha),
  estado: texto(r.estado, 'presente') as EstadoAsistencia,
  horasExtra: numero(r.horas_extra),
  observaciones: texto(r.observaciones) || undefined
})

const mapLinea = (r: Fila): LineaNomina => ({
  empleadoId: String(r.empleado_id),
  salarioBase: numero(r.salario_base),
  diasAusencia: numero(r.dias_ausencia),
  descuentoAusencias: numero(r.descuento_ausencias),
  horasExtra: numero(r.horas_extra),
  montoHorasExtra: numero(r.monto_horas_extra),
  bonificaciones: numero(r.bonificaciones),
  totalDevengado: numero(r.total_devengado),
  inssLaboral: numero(r.inss_laboral),
  ir: numero(r.ir),
  otrasDeducciones: numero(r.otras_deducciones),
  totalDeducciones: numero(r.total_deducciones),
  netoPagar: numero(r.neto_pagar),
  inssPatronal: numero(r.inss_patronal),
  inatec: numero(r.inatec)
})

const mapNomina = (r: Fila): Nomina => ({
  id: String(r.id),
  periodicidad: r.periodicidad === 'mensual' ? 'mensual' : 'quincenal',
  periodoInicio: texto(r.periodo_inicio),
  periodoFin: texto(r.periodo_fin),
  estado: r.estado === 'pagada' ? 'pagada' : 'borrador',
  fechaPago: texto(r.fecha_pago) || undefined,
  totalDevengado: numero(r.total_devengado),
  totalDeducciones: numero(r.total_deducciones),
  totalNeto: numero(r.total_neto),
  totalAportesPatronales: numero(r.total_aportes_patronales),
  observaciones: texto(r.observaciones) || undefined,
  creadoEn: texto(r.created_at),
  lineas: ((r.nomina_detalles as Fila[] | null) ?? []).map(mapLinea)
})

export async function cargarRecursosHumanos(forzar = false): Promise<void> {
  const sesion = await validarSesion()
  if (!sesion.ok) {
    errorConexion = sesion.error
    notificar()
    throw new Error(sesion.error)
  }
  if (cargado && !forzar) return
  const [e, a, n] = await Promise.all([
    supabase.from('empleados').select('*').order('codigo'),
    supabase.from('asistencias').select('*').order('fecha', { ascending: false }).limit(5000),
    supabase.from('nominas').select('*, nomina_detalles(*)').order('periodo_inicio', { ascending: false })
  ])
  const err = e.error ?? a.error ?? n.error
  if (err) {
    errorConexion = `No se pudo cargar recursos humanos: ${err.message}`
    notificar()
    throw new Error(errorConexion)
  }
  estado = {
    empleados: (e.data ?? []).map((r) => mapEmpleado(r as Fila)),
    asistencias: (a.data ?? []).map((r) => mapAsistencia(r as Fila)),
    nominas: (n.data ?? []).map((r) => mapNomina(r as Fila))
  }
  errorConexion = null
  cargado = true
  notificar()
}

function resultado(error: { message: string } | null): ResultadoAccion { return error ? { ok: false, error: error.message } : { ok: true } }
async function recargar(): Promise<ResultadoAccion> {
  try { await cargarRecursosHumanos(true); return { ok: true } } catch (err) { return { ok: false, error: (err as Error).message } }
}

// ---------- Empleados ----------

export async function guardarEmpleado(e: EmpleadoEntrada, id?: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const codigo = e.codigo.trim().toUpperCase()
  const cedula = e.cedula.trim().toUpperCase()
  if (estado.empleados.some((x) => x.id !== id && normalizarTexto(x.codigo) === normalizarTexto(codigo))) return { ok: false, error: `Ya existe un empleado con el código ${codigo}.` }
  if (cedula && estado.empleados.some((x) => x.id !== id && normalizarTexto(x.cedula) === normalizarTexto(cedula))) return { ok: false, error: `Ya existe un empleado con la cédula ${cedula}.` }
  const payload = {
    codigo,
    nombres: e.nombres.trim(),
    apellidos: e.apellidos.trim(),
    cedula: cedula || null,
    numero_inss: e.numeroInss.trim() || null,
    cargo: e.cargo.trim(),
    area: e.area.trim() || null,
    telefono: e.telefono.trim() || null,
    correo: e.correo.trim() || null,
    direccion: e.direccion.trim() || null,
    fecha_ingreso: e.fechaIngreso,
    tipo_contrato: e.tipoContrato,
    salario_mensual: e.salarioMensual,
    estado: e.estado,
    fecha_baja: e.estado === 'inactivo' ? e.fechaBaja ?? fechaHoy() : null,
    updated_at: new Date().toISOString()
  }
  const save = id ? await supabase.from('empleados').update(payload).eq('id', id) : await supabase.from('empleados').insert(payload)
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function cambiarEstadoEmpleado(id: string, nuevoEstado: EstadoEmpleado): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.from('empleados').update({
    estado: nuevoEstado,
    fecha_baja: nuevoEstado === 'inactivo' ? fechaHoy() : null,
    updated_at: new Date().toISOString()
  }).eq('id', id)
  if (save.error) return resultado(save.error)
  return recargar()
}

// ---------- Asistencia ----------

// Un registro por empleado y día: si ya existe se reemplaza
export async function guardarAsistencias(registros: AsistenciaEntrada[]): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (registros.length === 0) return { ok: false, error: 'No hay registros de asistencia para guardar.' }
  const filas = registros.map((r) => ({
    empleado_id: r.empleadoId,
    fecha: r.fecha,
    estado: r.estado,
    horas_extra: r.horasExtra,
    observaciones: r.observaciones?.trim() || null
  }))
  const save = await supabase.from('asistencias').upsert(filas, { onConflict: 'empleado_id,fecha' })
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function eliminarAsistencia(id: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const del = await supabase.from('asistencias').delete().eq('id', id)
  if (del.error) return resultado(del.error)
  return recargar()
}

// ---------- Nómina ----------

export async function guardarNomina(e: NominaEntrada): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  if (e.periodoFin < e.periodoInicio) return { ok: false, error: 'La fecha final del período no puede ser anterior a la inicial.' }
  if (e.lineas.length === 0) return { ok: false, error: 'La planilla no tiene empleados.' }
  const traslape = estado.nominas.find((n) => n.periodoInicio <= e.periodoFin && n.periodoFin >= e.periodoInicio)
  if (traslape) return { ok: false, error: `Ya existe una planilla del ${traslape.periodoInicio} al ${traslape.periodoFin} que cubre esas fechas.` }

  const totales = totalesNomina(e.lineas)
  const cabecera = await supabase.from('nominas').insert({
    periodicidad: e.periodicidad,
    periodo_inicio: e.periodoInicio,
    periodo_fin: e.periodoFin,
    total_devengado: totales.devengado,
    total_deducciones: totales.deducciones,
    total_neto: totales.neto,
    total_aportes_patronales: totales.aportesPatronales,
    observaciones: e.observaciones?.trim() || null
  }).select('id').single()
  if (cabecera.error) return resultado(cabecera.error)

  const detalles = await supabase.from('nomina_detalles').insert(e.lineas.map((l) => ({
    nomina_id: cabecera.data.id,
    empleado_id: l.empleadoId,
    salario_base: l.salarioBase,
    dias_ausencia: l.diasAusencia,
    descuento_ausencias: l.descuentoAusencias,
    horas_extra: l.horasExtra,
    monto_horas_extra: l.montoHorasExtra,
    bonificaciones: l.bonificaciones,
    total_devengado: l.totalDevengado,
    inss_laboral: l.inssLaboral,
    ir: l.ir,
    otras_deducciones: l.otrasDeducciones,
    total_deducciones: l.totalDeducciones,
    neto_pagar: l.netoPagar,
    inss_patronal: l.inssPatronal,
    inatec: l.inatec
  })))
  if (detalles.error) { await supabase.from('nominas').delete().eq('id', cabecera.data.id); return resultado(detalles.error) }
  return recargar()
}

export async function marcarNominaPagada(id: string, fechaPago: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const save = await supabase.from('nominas').update({ estado: 'pagada', fecha_pago: fechaPago }).eq('id', id).eq('estado', 'borrador')
  if (save.error) return resultado(save.error)
  return recargar()
}

export async function eliminarNomina(id: string): Promise<ResultadoAccion> {
  const sesion = await validarSesion()
  if (!sesion.ok) return sesion
  const nomina = estado.nominas.find((n) => n.id === id)
  if (nomina?.estado === 'pagada') return { ok: false, error: 'Una planilla pagada no se puede eliminar.' }
  const del = await supabase.from('nominas').delete().eq('id', id).eq('estado', 'borrador')
  if (del.error) return resultado(del.error)
  return recargar()
}
