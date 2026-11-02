// Tipos compartidos del módulo de compras.

import type { MetodoPago } from '../ventas/tipos'

// pendiente: orden de compra que aún no se recibe (no movió inventario ni gasto)
export type EstadoCompra = 'pendiente' | 'completada' | 'anulada'

// Cómo cambia el costo unitario de la materia prima al recibir la compra
export type ActualizacionCosto = 'promedio' | 'ultimo' | 'ninguno'

export interface Proveedor {
  id: string
  codigo: string
  nombre: string
  ruc?: string
  contacto?: string
  telefono?: string
  correo?: string
  direccion?: string
  notas?: string
  activo: boolean
  creadoEn: string
}

export interface LineaCompra {
  materiaPrimaId: string
  cantidad: number
  costoUnitario: number
  subtotal: number
}

export interface Compra {
  id: string
  codigo: string
  proveedorId?: string
  fecha: string
  registradoEn: string
  numeroFactura?: string
  metodoPago?: MetodoPago
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  estado: EstadoCompra
  observaciones?: string
  anuladaEn?: string
  motivoAnulacion?: string
  fechaEntregaEsperada?: string
  fechaRecepcion?: string
  observacionesRecepcion?: string
  lineas: LineaCompra[]
}

export interface DatosCompras {
  compras: Compra[]
  proveedores: Proveedor[]
}

export type ProveedorEntrada = Omit<Proveedor, 'id' | 'codigo' | 'activo' | 'creadoEn'>

export interface CompraEntrada {
  proveedorId: string
  fecha: string
  numeroFactura: string
  metodoPago: MetodoPago
  descuento: number
  aplicaIva: boolean
  actualizarCosto: ActualizacionCosto
  observaciones: string
  // false = orden de compra pendiente de recepción
  recibir: boolean
  fechaEntregaEsperada?: string
  lineas: { materiaPrimaId: string; cantidad: number; costoUnitario: number }[]
}
