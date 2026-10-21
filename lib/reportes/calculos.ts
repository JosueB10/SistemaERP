// Cálculos de los reportes. Funciones puras sobre los datos que ya cargan los demás módulos.

import type { Compra } from '../compras/tipos'
import type { MovimientoFinanciero } from '../finanzas/tipos'
import { enRango, finDeMes, mesAnterior, sumaMontos, totalesPorCategoria } from '../finanzas/utilidades'
import type { MateriaPrima, Producto } from '../inventario/tipos'
import { fechaHoy } from '../inventario/utilidades'
import type { OrdenProduccion } from '../produccion/tipos'
import type { MetodoPago, Venta } from '../ventas/tipos'

// ---------- Períodos ----------

export type PresetPeriodo = 'este_mes' | 'mes_anterior' | 'ultimos_3' | 'este_anio' | 'anio_anterior' | 'todo' | 'personalizado'

export const ETIQUETAS_PRESET: Record<PresetPeriodo, string> = {
  este_mes: 'Este mes',
  mes_anterior: 'Mes anterior',
  ultimos_3: 'Últimos 3 meses',
  este_anio: 'Este año',
  anio_anterior: 'Año anterior',
  todo: 'Todo el historial',
  personalizado: 'Personalizado'
}

export interface Periodo { desde: string; hasta: string }

export function periodoDePreset(preset: Exclude<PresetPeriodo, 'personalizado'>): Periodo {
  const hoy = fechaHoy()
  const mes = hoy.slice(0, 7)
  const anio = Number(hoy.slice(0, 4))
  switch (preset) {
    case 'este_mes': return { desde: `${mes}-01`, hasta: hoy }
    case 'mes_anterior': { const m = mesAnterior(mes); return { desde: `${m}-01`, hasta: finDeMes(m) } }
    case 'ultimos_3': return { desde: `${mesAnterior(mesAnterior(mes))}-01`, hasta: hoy }
    case 'este_anio': return { desde: `${anio}-01-01`, hasta: hoy }
    case 'anio_anterior': return { desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31` }
    case 'todo': return { desde: '', hasta: '' }
  }
}

// Meses AAAA-MM que cubre el período; si no tiene inicio, desde la fecha más antigua con datos
export function mesesDelPeriodo(periodo: Periodo, fechas: string[]) {
  const inicio = (periodo.desde || fechas.reduce((min, f) => (f < min ? f : min), fechaHoy())).slice(0, 7)
  const fin = (periodo.hasta || fechaHoy()).slice(0, 7)
  const meses: string[] = []
  let actual = fin
  while (actual >= inicio && meses.length < 120) {
    meses.unshift(actual)
    actual = mesAnterior(actual)
  }
  return meses
}

// ---------- Estado de resultados ----------
// Base devengada: la venta se reconoce sin IVA y su costo es el costo de producción al vender.
// Las compras de materia prima no son gasto del período: llegan al resultado como costo de ventas.

export interface EstadoResultados {
  ventasBrutas: number
  descuentos: number
  ventasNetas: number
  costoVentas: number
  utilidadBruta: number
  otrosIngresos: { categoria: string; total: number }[]
  gastosOperativos: { categoria: string; total: number }[]
  totalOtrosIngresos: number
  totalGastosOperativos: number
  utilidadNeta: number
  ivaCobrado: number
  ivaPagado: number
  cantidadVentas: number
}

export function estadoResultados(
  ventas: Venta[],
  compras: Compra[],
  ingresos: MovimientoFinanciero[],
  gastos: MovimientoFinanciero[],
  periodo: Periodo
): EstadoResultados {
  const vigentes = ventas.filter((v) => v.estado === 'completada' && enRango(v.fecha, periodo.desde, periodo.hasta))
  const ventasBrutas = vigentes.reduce((t, v) => t + v.subtotal, 0)
  const descuentos = vigentes.reduce((t, v) => t + v.descuento, 0)
  const costoVentas = vigentes.reduce((t, v) => t + v.costoTotal, 0)
  const otros = ingresos.filter((m) => m.origen === 'manual' && enRango(m.fecha, periodo.desde, periodo.hasta))
  const operativos = gastos.filter((m) => m.origen !== 'compra' && enRango(m.fecha, periodo.desde, periodo.hasta))
  const ventasNetas = ventasBrutas - descuentos
  const utilidadBruta = ventasNetas - costoVentas
  const totalOtrosIngresos = sumaMontos(otros)
  const totalGastosOperativos = sumaMontos(operativos)
  return {
    ventasBrutas,
    descuentos,
    ventasNetas,
    costoVentas,
    utilidadBruta,
    otrosIngresos: totalesPorCategoria(otros),
    gastosOperativos: totalesPorCategoria(operativos),
    totalOtrosIngresos,
    totalGastosOperativos,
    utilidadNeta: utilidadBruta + totalOtrosIngresos - totalGastosOperativos,
    ivaCobrado: vigentes.reduce((t, v) => t + v.impuesto, 0),
    ivaPagado: compras.filter((c) => c.estado === 'completada' && enRango(c.fecha, periodo.desde, periodo.hasta)).reduce((t, c) => t + c.impuesto, 0),
    cantidadVentas: vigentes.length
  }
}

// ---------- Ventas ----------

export function ventasDelPeriodo(ventas: Venta[], periodo: Periodo) {
  return ventas.filter((v) => v.estado === 'completada' && enRango(v.fecha, periodo.desde, periodo.hasta))
}

// Importe de línea antes del descuento general de la venta
export function ventasPorProducto(ventas: Venta[]) {
  const mapa = new Map<string, { unidades: number; importe: number; costo: number; fabricadas: number }>()
  ventas.forEach((v) =>
    v.lineas.forEach((l) => {
      const actual = mapa.get(l.productoId) ?? { unidades: 0, importe: 0, costo: 0, fabricadas: 0 }
      mapa.set(l.productoId, {
        unidades: actual.unidades + l.cantidad,
        importe: actual.importe + l.subtotal,
        costo: actual.costo + l.cantidad * l.costoUnitario,
        fabricadas: actual.fabricadas + l.fabricadas
      })
    })
  )
  return Array.from(mapa, ([productoId, d]) => ({ productoId, ...d, margen: d.importe - d.costo })).sort((a, b) => b.importe - a.importe)
}

export function ventasPorCliente(ventas: Venta[]) {
  const mapa = new Map<string, { ventas: number; total: number }>()
  ventas.forEach((v) => {
    const clave = v.clienteId ?? ''
    const actual = mapa.get(clave) ?? { ventas: 0, total: 0 }
    mapa.set(clave, { ventas: actual.ventas + 1, total: actual.total + v.total })
  })
  return Array.from(mapa, ([clienteId, d]) => ({ clienteId, ...d })).sort((a, b) => b.total - a.total)
}

export function ventasPorMetodo(ventas: Venta[]) {
  const mapa = new Map<MetodoPago | '', { ventas: number; total: number }>()
  ventas.forEach((v) => {
    const clave = v.metodoPago ?? ''
    const actual = mapa.get(clave) ?? { ventas: 0, total: 0 }
    mapa.set(clave, { ventas: actual.ventas + 1, total: actual.total + v.total })
  })
  return Array.from(mapa, ([metodo, d]) => ({ metodo, ...d })).sort((a, b) => b.total - a.total)
}

export function ventasPorMes(ventas: Venta[], meses: string[]) {
  return meses.map((mes) => {
    const delMes = ventas.filter((v) => v.fecha.startsWith(mes))
    return {
      mes,
      ventas: delMes.length,
      neto: delMes.reduce((t, v) => t + v.subtotal - v.descuento, 0),
      costo: delMes.reduce((t, v) => t + v.costoTotal, 0),
      total: delMes.reduce((t, v) => t + v.total, 0)
    }
  })
}

// ---------- Compras ----------

export function comprasDelPeriodo(compras: Compra[], periodo: Periodo) {
  return compras.filter((c) => c.estado === 'completada' && enRango(c.fecha, periodo.desde, periodo.hasta))
}

export function comprasPorProveedor(compras: Compra[]) {
  const mapa = new Map<string, { compras: number; total: number; ultima: string }>()
  compras.forEach((c) => {
    const clave = c.proveedorId ?? ''
    const actual = mapa.get(clave) ?? { compras: 0, total: 0, ultima: '' }
    mapa.set(clave, { compras: actual.compras + 1, total: actual.total + c.total, ultima: c.fecha > actual.ultima ? c.fecha : actual.ultima })
  })
  return Array.from(mapa, ([proveedorId, d]) => ({ proveedorId, ...d })).sort((a, b) => b.total - a.total)
}

export function comprasPorMateria(compras: Compra[]) {
  const mapa = new Map<string, { cantidad: number; importe: number; minimo: number; maximo: number }>()
  compras.forEach((c) =>
    c.lineas.forEach((l) => {
      const actual = mapa.get(l.materiaPrimaId) ?? { cantidad: 0, importe: 0, minimo: Infinity, maximo: 0 }
      mapa.set(l.materiaPrimaId, {
        cantidad: actual.cantidad + l.cantidad,
        importe: actual.importe + l.subtotal,
        minimo: Math.min(actual.minimo, l.costoUnitario),
        maximo: Math.max(actual.maximo, l.costoUnitario)
      })
    })
  )
  return Array.from(mapa, ([materiaPrimaId, d]) => ({ materiaPrimaId, ...d, promedio: d.cantidad ? d.importe / d.cantidad : 0 })).sort((a, b) => b.importe - a.importe)
}

// ---------- Producción ----------

export function produccionPorProducto(ordenes: OrdenProduccion[], periodo: Periodo) {
  const completadas = ordenes.filter((o) => o.estado === 'completada' && o.fechaFin && enRango(o.fechaFin, periodo.desde, periodo.hasta))
  const mapa = new Map<string, { ordenes: number; unidades: number; costo: number }>()
  completadas.forEach((o) => {
    const actual = mapa.get(o.productoId) ?? { ordenes: 0, unidades: 0, costo: 0 }
    mapa.set(o.productoId, { ordenes: actual.ordenes + 1, unidades: actual.unidades + o.cantidadProducida, costo: actual.costo + o.costoMateriales })
  })
  return Array.from(mapa, ([productoId, d]) => ({ productoId, ...d, costoUnitario: d.unidades ? d.costo / d.unidades : 0 })).sort((a, b) => b.unidades - a.unidades)
}

// ---------- Inventario ----------

export function inventarioValorizado(productos: Producto[], materias: MateriaPrima[]) {
  const filasProductos = productos.map((p) => ({ id: p.id, codigo: p.sku, nombre: p.nombre, existencias: p.existencias, minimo: p.stockMinimo, costo: p.costoProduccion, valor: Math.max(0, p.existencias) * p.costoProduccion, valorVenta: Math.max(0, p.existencias) * p.precioVenta }))
  const filasMaterias = materias.map((m) => ({ id: m.id, codigo: m.codigo, nombre: m.nombre, unidad: m.unidad, existencias: m.existencias, minimo: m.stockMinimo, costo: m.costoUnitario, valor: Math.max(0, m.existencias) * m.costoUnitario }))
  return {
    productos: filasProductos.sort((a, b) => b.valor - a.valor),
    materias: filasMaterias.sort((a, b) => b.valor - a.valor),
    totalProductos: filasProductos.reduce((t, f) => t + f.valor, 0),
    totalVentaProductos: filasProductos.reduce((t, f) => t + f.valorVenta, 0),
    totalMaterias: filasMaterias.reduce((t, f) => t + f.valor, 0)
  }
}

export function porcentaje(parte: number, total: number) {
  return total ? (parte / total) * 100 : 0
}
