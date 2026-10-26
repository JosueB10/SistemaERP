// Tipos compartidos del módulo de inventario.

export type ClaseArticulo = 'producto' | 'materia_prima'

export type TipoProducto = 'estandar' | 'personalizado'

export type EstadoStock = 'disponible' | 'stock_bajo' | 'agotado'

export type UnidadMedida =
  | 'unidad'
  | 'kg'
  | 'g'
  | 'm'
  | 'm2'
  | 'l'
  | 'ml'
  | 'rollo'

export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste'

export type SentidoAjuste = 'incremento' | 'decremento'

export interface Producto {
  id: string
  sku: string
  nombre: string
  tipo: TipoProducto
  categoria: string
  precioVenta: number
  costoProduccion: number
  existencias: number
  stockMinimo: number
  actualizadoEn: string
}

export interface MateriaPrima {
  id: string
  codigo: string
  nombre: string
  categoria: string
  unidad: UnidadMedida
  existencias: number
  stockMinimo: number
  costoUnitario: number
  actualizadoEn: string
}

export interface Movimiento {
  id: string
  fecha: string
  registradoEn: string
  claseArticulo: ClaseArticulo
  articuloId: string
  tipo: TipoMovimiento
  sentido?: SentidoAjuste
  cantidad: number
  existenciasAnteriores: number
  existenciasResultantes: number
  motivo: string
  observaciones?: string
  // Documento que generó el movimiento (venta, compra u orden de producción)
  referenciaTipo?: string
  referenciaId?: string
}

export interface DatosInventario {
  productos: Producto[]
  materiasPrimas: MateriaPrima[]
  movimientos: Movimiento[]
}

export type ProductoEntrada = Omit<Producto, 'id' | 'actualizadoEn'>

export type MateriaPrimaEntrada = Omit<MateriaPrima, 'id' | 'actualizadoEn'>

export type MovimientoEntrada = Omit<
  Movimiento,
  'id' | 'registradoEn' | 'existenciasAnteriores' | 'existenciasResultantes' | 'referenciaTipo' | 'referenciaId'
>

export type ResultadoAccion = { ok: true } | { ok: false; error: string }

// Vista unificada de productos y materias primas para listados mixtos
export interface ArticuloInventario {
  clase: ClaseArticulo
  id: string
  codigo: string
  nombre: string
  categoria: string
  unidad: string
  existencias: number
  stockMinimo: number
  costoUnitario: number
  estado: EstadoStock
}
