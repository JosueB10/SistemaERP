import type { MateriaPrima } from '../inventario/tipos'
import { ABREVIATURAS_UNIDAD } from '../inventario/utilidades'
import type {
  EstadoOperacion,
  EstadoOrden,
  LineaEstructura,
  LineaReceta,
  OperacionOrden,
  OperacionRuta,
  OrdenProduccion,
  Receta,
  Requerimiento,
  Subensamble
} from './tipos'

// ---------- Etiquetas ----------

export const ETIQUETAS_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada'
}

export const ETIQUETAS_ESTADO_OPERACION: Record<EstadoOperacion, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Terminada'
}

export function codigoOrden(id: string) {
  return `OP-${id.padStart(5, '0')}`
}

// ---------- Recetas ----------

// Redondeo a 3 decimales, la precisión con que la base guarda la materia prima
export function redondear3(valor: number) {
  return Math.round(valor * 1000) / 1000
}

// Explosión de la BOM (igual que explosion_bom en la base): la materia prima directa más la de cada
// subensamble multiplicada por las unidades de subensamble que lleva el producto
export function explotarEstructura(estructura: LineaEstructura[], subensambles: Subensamble[]): LineaReceta[] {
  const porId = new Map(subensambles.map((s) => [s.id, s]))
  const total = new Map<string, number>()
  const sumar = (materiaPrimaId: string, cantidad: number) => total.set(materiaPrimaId, (total.get(materiaPrimaId) ?? 0) + cantidad)
  for (const linea of estructura) {
    if (linea.tipo === 'materia_prima') sumar(linea.componenteId, linea.cantidad)
    else for (const sub of porId.get(linea.componenteId)?.lineas ?? []) sumar(sub.materiaPrimaId, linea.cantidad * sub.cantidad)
  }
  return [...total].map(([materiaPrimaId, cantidad]) => ({ materiaPrimaId, cantidad: redondear3(cantidad) }))
}

// Costo de materia prima de una unidad de subensamble
export function costoSubensamble(subensamble: Subensamble | undefined, materiasPrimas: MateriaPrima[]) {
  const porId = new Map(materiasPrimas.map((m) => [m.id, m]))
  return (subensamble?.lineas ?? []).reduce((total, l) => total + l.cantidad * (porId.get(l.materiaPrimaId)?.costoUnitario ?? 0), 0)
}

export function recetaDeProducto(recetas: Receta[], productoId: string) {
  return recetas.find((receta) => receta.productoId === productoId)
}

export function tieneMateriaDefinida(receta: Receta | undefined): receta is Receta {
  return Boolean(receta && receta.lineas.length > 0)
}

// Materia prima comprometida por las órdenes abiertas (pendientes o en proceso), menos la orden que se edita.
// Así dos órdenes no pueden contar con el mismo material.
export function materiaComprometida(ordenes: OrdenProduccion[], recetas: Receta[], excluirOrdenId?: string) {
  const comprometida = new Map<string, number>()
  for (const orden of ordenes) {
    if (!ordenAbierta(orden) || orden.id === excluirOrdenId) continue
    for (const linea of recetaDeProducto(recetas, orden.productoId)?.lineas ?? []) {
      comprometida.set(linea.materiaPrimaId, redondear3((comprometida.get(linea.materiaPrimaId) ?? 0) + linea.cantidad * orden.cantidadPlanificada))
    }
  }
  return comprometida
}

export function requerimientos(
  receta: Receta | undefined,
  cantidad: number,
  materiasPrimas: MateriaPrima[],
  comprometida?: Map<string, number>
): Requerimiento[] {
  if (!receta) return []
  const porId = new Map(materiasPrimas.map((materia) => [materia.id, materia]))
  return receta.lineas.map((linea) => {
    const materia = porId.get(linea.materiaPrimaId)
    const requerido = redondear3(linea.cantidad * cantidad)
    const disponible = Math.max(0, redondear3((materia?.existencias ?? 0) - (comprometida?.get(linea.materiaPrimaId) ?? 0)))
    const costoUnitario = materia?.costoUnitario ?? 0
    return {
      materiaPrimaId: linea.materiaPrimaId,
      codigo: materia?.codigo ?? '—',
      nombre: materia?.nombre ?? 'Materia prima inactiva',
      unidad: materia ? ABREVIATURAS_UNIDAD[materia.unidad] : '',
      porUnidad: linea.cantidad,
      requerido,
      disponible,
      faltante: Math.max(0, redondear3(requerido - disponible)),
      costoUnitario,
      costo: requerido * costoUnitario
    }
  })
}

// Costo de materia prima de una unidad del producto según la receta
export function costoReceta(receta: Receta | undefined, materiasPrimas: MateriaPrima[]) {
  return requerimientos(receta, 1, materiasPrimas).reduce((total, linea) => total + linea.costo, 0)
}

// Unidades que se pueden fabricar con el stock actual de materia prima
export function capacidadProduccion(receta: Receta | undefined, materiasPrimas: MateriaPrima[], comprometida?: Map<string, number>) {
  if (!tieneMateriaDefinida(receta)) return null
  return Math.min(
    ...requerimientos(receta, 1, materiasPrimas, comprometida).map((linea) =>
      linea.porUnidad > 0 ? Math.floor(linea.disponible / linea.porUnidad + 1e-9) : Infinity
    )
  )
}

// ---------- Órdenes ----------

export function ordenAbierta(orden: OrdenProduccion) {
  return orden.estado === 'pendiente' || orden.estado === 'en_proceso'
}

export function fechaReferenciaOrden(orden: OrdenProduccion) {
  return orden.fechaFin ?? orden.fechaInicio ?? orden.fechaProgramada ?? orden.creadoEn.slice(0, 10)
}

export function costoUnitarioOrden(orden: OrdenProduccion) {
  return orden.cantidadProducida > 0 ? orden.costoMateriales / orden.cantidadProducida : 0
}

export function operacionAbierta(operacion: OperacionOrden) {
  return operacion.estado !== 'completada'
}

// Siguiente operación que se puede trabajar en la orden (las de la ruta van en orden)
export function operacionActual(orden: OrdenProduccion) {
  return orden.operaciones.find(operacionAbierta)
}

// Piezas que llegan a una operación: lo planificado en la primera, lo bueno de la anterior en las demás
export function entradaOperacion(orden: OrdenProduccion, operacion: OperacionOrden) {
  const anterior = [...orden.operaciones].reverse().find((o) => o.secuencia < operacion.secuencia)
  return anterior ? anterior.cantidadBuena : orden.cantidadPlanificada
}

// ---------- OEE y tiempo de ciclo ----------
// Disponibilidad = tiempo operativo / tiempo planificado (fin − inicio); el operativo descuenta los paros
// Rendimiento   = tiempo esperado / tiempo operativo (máximo 100 %),
//                 con tiempo esperado = preparación + tiempo estándar × piezas procesadas
// Calidad       = piezas buenas / piezas procesadas
// OEE           = Disponibilidad × Rendimiento × Calidad
// Los tiempos se expresan en minutos de planta: la duración real × la escala de la simulación IIoT.

export interface Indicadores {
  planificadoMin: number
  operativoMin: number
  paroMin: number
  estandarMin: number
  buenas: number
  rechazadas: number
  disponibilidad: number
  rendimiento: number
  calidad: number
  oee: number
  // Minutos reales por pieza
  cicloRealMin: number
}

export function duracionMin(inicio?: string, fin?: string) {
  if (!inicio || !fin) return 0
  return Math.max(0, (new Date(fin).getTime() - new Date(inicio).getTime()) / 60000)
}

// Duración de una operación en minutos de planta
export function duracionOperacion(operacion: OperacionOrden) {
  return duracionMin(operacion.inicio, operacion.fin) * operacion.escalaTiempo
}

// Suma de varias operaciones terminadas (una sola da el OEE de esa operación)
export function indicadores(operaciones: OperacionOrden[]): Indicadores | null {
  const terminadas = operaciones.filter((o) => o.estado === 'completada' && o.inicio && o.fin)
  if (terminadas.length === 0) return null
  let planificadoMin = 0
  let paroMin = 0
  let estandarMin = 0
  let buenas = 0
  let rechazadas = 0
  for (const o of terminadas) {
    const duracion = duracionOperacion(o)
    planificadoMin += duracion
    paroMin += Math.min(o.tiempoParoMin, duracion)
    estandarMin += o.tiempoPreparacionMin + o.tiempoEstandarMin * (o.cantidadBuena + o.cantidadRechazada)
    buenas += o.cantidadBuena
    rechazadas += o.cantidadRechazada
  }
  const operativoMin = Math.max(0, planificadoMin - paroMin)
  const procesadas = buenas + rechazadas
  const disponibilidad = planificadoMin > 0 ? operativoMin / planificadoMin : 0
  const rendimiento = operativoMin > 0 ? Math.min(1, estandarMin / operativoMin) : 0
  const calidad = procesadas > 0 ? buenas / procesadas : 0
  return {
    planificadoMin,
    operativoMin,
    paroMin,
    estandarMin,
    buenas,
    rechazadas,
    disponibilidad,
    rendimiento,
    calidad,
    oee: disponibilidad * rendimiento * calidad,
    cicloRealMin: procesadas > 0 ? operativoMin / procesadas : 0
  }
}

// Tiempo de ciclo de la orden: desde que empezó la primera operación hasta que terminó la última
// (la duración de cada operación en minutos de planta más las esperas entre una y otra)
export function tiempoCicloOrden(orden: OrdenProduccion) {
  const ops = orden.operaciones
  if (!ops.length || ops.some(operacionAbierta) || ops.some((o) => !o.inicio || !o.fin)) return null
  return ops.reduce((total, o, i) => total + duracionOperacion(o) + (i > 0 ? duracionMin(ops[i - 1].fin, o.inicio) : 0), 0)
}

// Tiempo de ciclo estándar por unidad (suma de los tiempos estándar de la ruta)
export function cicloEstandarUnidad(operaciones: { tiempoEstandarMin: number }[]) {
  return operaciones.reduce((total, o) => total + o.tiempoEstandarMin, 0)
}

// Tiempo estimado para fabricar una cantidad con la ruta: preparación + estándar × cantidad en cada paso
export function tiempoEstimadoRuta(operaciones: { tiempoPreparacionMin: number; tiempoEstandarMin: number }[], cantidad: number) {
  return operaciones.reduce((total, o) => total + o.tiempoPreparacionMin + o.tiempoEstandarMin * cantidad, 0)
}

export function formatoMinutos(minutos: number) {
  if (!Number.isFinite(minutos) || minutos <= 0) return '0 min'
  if (minutos < 60) return `${Math.round(minutos * 10) / 10} min`
  const horas = Math.floor(minutos / 60)
  const resto = Math.round(minutos - horas * 60)
  return resto ? `${horas} h ${resto} min` : `${horas} h`
}

export function formatoPorcentaje(valor: number) {
  return `${(Math.round(valor * 1000) / 10).toLocaleString('es-NI')} %`
}

// Clasificación habitual del OEE
export function nivelOee(oee: number): 'positivo' | 'alerta' | 'peligro' {
  if (oee >= 0.85) return 'positivo'
  if (oee >= 0.65) return 'alerta'
  return 'peligro'
}

// Fecha y hora local para <input type="datetime-local"> y su conversión a ISO
export function aFechaHoraLocal(iso?: string) {
  const fecha = iso ? new Date(iso) : new Date()
  const desfase = fecha.getTimezoneOffset() * 60000
  return new Date(fecha.getTime() - desfase).toISOString().slice(0, 16)
}

export function deFechaHoraLocal(valor: string) {
  return new Date(valor).toISOString()
}

export function formatoFechaHora(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-NI', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Con ruta de fabricación, la orden solo se cierra cuando todas sus operaciones están terminadas
export function rutaPendiente(orden: OrdenProduccion, rutas: { productoId: string }[]) {
  return orden.operaciones.length > 0
    ? orden.operaciones.some(operacionAbierta)
    : rutas.some((r) => r.productoId === orden.productoId)
}

// Minutos estándar pendientes por centro (preparación + estándar × piezas) de las órdenes abiertas.
// Las órdenes sin iniciar se estiman con la ruta del producto.
export function cargaPendientePorCentro(ordenes: OrdenProduccion[], rutas: OperacionRuta[]) {
  const carga = new Map<string, number>()
  for (const orden of ordenes) {
    if (orden.estado !== 'pendiente' && orden.estado !== 'en_proceso') continue
    const operaciones = orden.operaciones.length
      ? orden.operaciones.filter(operacionAbierta).map((o) => ({ centro: o.centroTrabajoId, prep: o.tiempoPreparacionMin, std: o.tiempoEstandarMin, cantidad: entradaOperacion(orden, o) }))
      : rutas.filter((r) => r.productoId === orden.productoId).map((r) => ({ centro: r.centroTrabajoId, prep: r.tiempoPreparacionMin, std: r.tiempoEstandarMin, cantidad: orden.cantidadPlanificada }))
    for (const o of operaciones) {
      if (!o.centro) continue
      carga.set(o.centro, (carga.get(o.centro) ?? 0) + o.prep + o.std * o.cantidad)
    }
  }
  return carga
}
