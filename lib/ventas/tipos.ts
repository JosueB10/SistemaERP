// Tipos compartidos del módulo de ventas.

// pendiente: falta producir parte de lo vendido; aún no movió inventario ni dinero
export type EstadoVenta = 'pendiente' | 'completada' | 'anulada'

// Logística de una venta completada
export type EstadoDespacho = 'por_despachar' | 'despachada' | 'entregada'

export type MetodoPago ='efectivo' | 'tarjeta' | 'transferencia' | 'credito'

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
  // Unidades que no había en stock al registrar la venta (ventas pendientes)
  porProducir: number
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
  completadaEn?: string
  anuladaEn?: string
  motivoAnulacion?: string
  estadoDespacho: EstadoDespacho
  fechaDespacho?: string
  guiaDespacho?: string
  transportista?: string
  direccionEntrega?: string
  // Códigos de los lotes enviados (trazabilidad)
  lotesDespacho?: string
  fechaEntrega?: string
  recibidoPor?: string
  lineas: LineaVenta[]
}

export interface DespachoEntrada {
  fecha: string
  guia: string
  transportista: string
  direccion: string
  lotes: string
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
