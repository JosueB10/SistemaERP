import type { ActualizacionCosto, EstadoCompra } from './tipos'

export const ETIQUETAS_ESTADO_COMPRA: Record<EstadoCompra, string> = {
  completada: 'Recibida',
  anulada: 'Anulada'
}

export const ETIQUETAS_ACTUALIZACION_COSTO: Record<ActualizacionCosto, string> = {
  promedio: 'Costo promedio ponderado',
  ultimo: 'Último precio de compra',
  ninguno: 'No cambiar el costo'
}

export function codigoCompra(id: string) {
  return `C-${id.padStart(5, '0')}`
}

export function codigoProveedor(id: string) {
  return `PRV-${id.padStart(3, '0')}`
}

// Igual que registrar_compra: el promedio usa solo existencias positivas
export function nuevoCostoMateria(
  modo: ActualizacionCosto,
  existencias: number,
  costoActual: number,
  cantidad: number,
  costoCompra: number
) {
  if (modo === 'ninguno') return costoActual
  if (modo === 'ultimo') return costoCompra
  const stock = Math.max(0, existencias)
  if (stock + cantidad <= 0) return costoCompra
  return Math.round(((stock * costoActual + cantidad * costoCompra) / (stock + cantidad)) * 100) / 100
}
