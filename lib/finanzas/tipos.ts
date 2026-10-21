// Tipos compartidos del módulo de finanzas.

import type { MetodoPago } from '../ventas/tipos'

export type TipoFinanciero = 'ingreso' | 'gasto'

// De dónde viene el registro: los automáticos los gestiona su módulo de origen
export type OrigenFinanciero = 'manual' | 'venta' | 'compra' | 'nomina'

export interface MovimientoFinanciero {
  id: string
  tipo: TipoFinanciero
  concepto: string
  categoria: string
  monto: number
  fecha: string
  registradoEn: string
  metodoPago?: MetodoPago
  observaciones?: string
  origen: OrigenFinanciero
  referenciaId?: string
}

export interface DatosFinanzas {
  ingresos: MovimientoFinanciero[]
  gastos: MovimientoFinanciero[]
}

export interface MovimientoFinancieroEntrada {
  concepto: string
  categoria: string
  monto: number
  fecha: string
  metodoPago: MetodoPago
  observaciones: string
}
