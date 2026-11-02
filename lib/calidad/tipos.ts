// Tipos compartidos del módulo de calidad.

export type EstadoLote = 'en_inspeccion' | 'aprobado' | 'aprobado_parcial' | 'rechazado'

export type OrigenNc = 'produccion' | 'proceso' | 'materia_prima' | 'cliente'
export type SeveridadNc = 'menor' | 'mayor' | 'critica'
export type DisposicionNc = 'reproceso' | 'desecho' | 'concesion' | 'devolucion'
export type EstadoNc = 'abierta' | 'en_analisis' | 'cerrada'

export interface Lote {
  id: string
  codigo: string
  ordenId: string
  productoId: string
  fechaProduccion: string
  cantidad: number
  cantidadAprobada: number
  cantidadRechazada: number
  estado: EstadoLote
  criterios: Record<string, boolean>
  inspectorId?: string
  fechaInspeccion?: string
  observaciones?: string
}

export interface NoConformidad {
  id: string
  codigo: string
  origen: OrigenNc
  loteId?: string
  ordenId?: string
  operacionId?: string
  productoId?: string
  materiaPrimaId?: string
  fecha: string
  tipoDefecto: string
  descripcion?: string
  cantidadAfectada: number
  severidad: SeveridadNc
  disposicion: DisposicionNc
  causaRaiz?: string
  accionCorrectiva?: string
  responsableId?: string
  estado: EstadoNc
  fechaCierre?: string
}

export interface DatosCalidad {
  lotes: Lote[]
  noConformidades: NoConformidad[]
}

export interface InspeccionEntrada {
  aprobadas: number
  rechazadas: number
  fecha: string
  inspectorId?: string
  criterios: Record<string, boolean>
  observaciones: string
  tipoDefecto: string
  descripcion: string
  severidad: SeveridadNc
  disposicion: DisposicionNc
}

export interface NoConformidadEntrada {
  origen: OrigenNc
  loteId?: string
  productoId?: string
  materiaPrimaId?: string
  fecha: string
  tipoDefecto: string
  descripcion: string
  cantidadAfectada: number
  severidad: SeveridadNc
  disposicion: DisposicionNc
  responsableId?: string
}

export interface SeguimientoNcEntrada {
  causaRaiz: string
  accionCorrectiva: string
  responsableId?: string
  estado: EstadoNc
  fechaCierre?: string
}
