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

export function requerimientos(
  receta: Receta | undefined,
  cantidad: number,
  materiasPrimas: MateriaPrima[]
): Requerimiento[] {
  if (!receta) return []
  const porId = new Map(materiasPrimas.map((materia) => [materia.id, materia]))
  return receta.lineas.map((linea) => {
    const materia = porId.get(linea.materiaPrimaId)
    const requerido = redondear3(linea.cantidad * cantidad)
    const disponible = materia?.existencias ?? 0
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
export function capacidadProduccion(receta: Receta | undefined, materiasPrimas: MateriaPrima[]) {
  if (!tieneMateriaDefinida(receta)) return null
  return Math.min(
    ...requerimientos(receta, 1, materiasPrimas).map((linea) =>
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
