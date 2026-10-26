// Tipos compartidos del módulo de producción.

export type EstadoOrden = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'

// Cantidad de una materia prima que lleva UNA unidad del producto
export interface LineaReceta {
  materiaPrimaId: string
  cantidad: number
}

export interface Receta {
  id: string
  productoId: string
  nombre: string
  version: number
  notas?: string
  actualizadoEn: string
  lineas: LineaReceta[]
}

export interface ConsumoOrden {
  materiaPrimaId: string
  cantidadTeorica: number
  cantidadReal: number
  costoUnitario: number
  subtotal: number
}

export interface OrdenProduccion {
  id: string
  codigo: string
  productoId: string
  recetaId?: string
  empleadoId?: string
  // Venta pendiente que esta orden surte
  ventaId?: string
  fechaProgramada?: string
  fechaInicio?: string
  fechaFin?: string
  cantidadPlanificada: number
  cantidadProducida: number
  estado: EstadoOrden
  observaciones?: string
  costoMateriales: number
  creadoEn: string
  consumos: ConsumoOrden[]
}

export interface Responsable {
  id: string
  codigo: string
  nombre: string
  activo: boolean
}

export interface DatosProduccion {
  recetas: Receta[]
  ordenes: OrdenProduccion[]
  responsables: Responsable[]
}

export interface RecetaEntrada {
  productoId: string
  nombre: string
  notas: string
  lineas: LineaReceta[]
}

export interface OrdenEntrada {
  productoId: string
  cantidadPlanificada: number
  fechaProgramada: string
  empleadoId?: string
  ventaId?: string
  observaciones: string
}

export interface CompletarOrdenEntrada {
  cantidadProducida: number
  fechaFin: string
  consumos: { materiaPrimaId: string; cantidadTeorica: number; cantidadReal: number }[]
  observaciones: string
}

// Materia prima necesaria para fabricar cierta cantidad de un producto
export interface Requerimiento {
  materiaPrimaId: string
  codigo: string
  nombre: string
  unidad: string
  porUnidad: number
  requerido: number
  disponible: number
  faltante: number
  costoUnitario: number
  costo: number
}
