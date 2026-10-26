import type { MateriaPrima } from '../inventario/tipos'
import { ABREVIATURAS_UNIDAD } from '../inventario/utilidades'
import type { EstadoOrden, OrdenProduccion, Receta, Requerimiento } from './tipos'

// ---------- Etiquetas ----------

export const ETIQUETAS_ESTADO_ORDEN: Record<EstadoOrden, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada'
}

export function codigoOrden(id: string) {
  return `OP-${id.padStart(5, '0')}`
}

// ---------- Recetas ----------

// Redondeo a 3 decimales, la precisión con que la base guarda la materia prima
export function redondear3(valor: number) {
  return Math.round(valor * 1000) / 1000
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
