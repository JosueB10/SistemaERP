// Tipos compartidos del módulo de ventas.

export type EstadoVenta = 'completada' | 'anulada'

export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'credito'

export interface Cliente {
  id: string
  codigo: string
  nombre: string
  identificacion?: string
  telefono?: string
  correo?: string
  direccion?: string
  notas?: string
  activo: boolean
  creadoEn: string
}

export interface LineaVenta {
  productoId: string
  cantidad: number
  precioUnitario: number
  subtotal: number
  costoUnitario: number
  fabricadas: number
}

export interface Venta {
  id: string
  codigo: string
  clienteId?: string
  fecha: string
  registradoEn: string
  metodoPago?: MetodoPago
  subtotal: number
  descuento: number
  impuesto: number
  total: number
  costoTotal: number
  estado: EstadoVenta
  observaciones?: string
  anuladaEn?: string
  motivoAnulacion?: string
  lineas: LineaVenta[]
}

export interface DatosVentas {
  ventas: Venta[]
  clientes: Cliente[]
}

export type ClienteEntrada = Omit<Cliente, 'id' | 'codigo' | 'activo' | 'creadoEn'>

export interface VentaEntrada {
  clienteId?: string
  fecha: string
  metodoPago: MetodoPago
  descuento: number
  aplicaIva: boolean
  observaciones: string
  lineas: { productoId: string; cantidad: number; precioUnitario: number }[]
}
