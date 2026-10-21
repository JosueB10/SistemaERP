import type { MateriaPrima, Producto } from '../inventario/tipos'
import type { Receta } from '../produccion/tipos'
import { recetaDeProducto, redondear3, requerimientos, tieneMateriaDefinida } from '../produccion/utilidades'
import type { EstadoVenta, MetodoPago, Venta } from './tipos'

// ---------- Etiquetas ----------

export const ETIQUETAS_ESTADO_VENTA: Record<EstadoVenta, string> = {
  completada: 'Completada',
  anulada: 'Anulada'
}

export const ETIQUETAS_METODO_PAGO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito'
}

// IVA de Nicaragua; la base usa la misma tasa al calcular el impuesto
export const TASA_IVA = 0.15

export function codigoVenta(id: string) {
  return `V-${id.padStart(5, '0')}`
}

export function codigoCliente(id: string) {
  return `CLI-${id.padStart(3, '0')}`
}

export function redondear2(valor: number) {
  return Math.round(valor * 100) / 100
}

// Mismo cálculo que hacen registrar_venta y registrar_compra en la base
export function calcularTotales(subtotal: number, descuento: number, aplicaIva: boolean) {
  const base = Math.max(0, subtotal - descuento)
  const impuesto = aplicaIva ? redondear2(base * TASA_IVA) : 0
  return { subtotal, descuento, impuesto, total: redondear2(base + impuesto) }
}

export function margenVenta(venta: Venta) {
  return venta.subtotal - venta.descuento - venta.costoTotal
}

export function unidadesVenta(venta: Venta) {
  return venta.lineas.reduce((total, linea) => total + linea.cantidad, 0)
}

// ---------- Disponibilidad al vender ----------
// Lo que no haya en stock terminado se fabrica al momento con la receta (vender_producto).

export interface AnalisisLinea {
  productoId: string
  cantidad: number
  desdeStock: number
  fabricadas: number
  sinReceta: boolean
}

export interface FaltanteMateria {
  materiaPrimaId: string
  nombre: string
  unidad: string
  requerido: number
  disponible: number
  faltante: number
}

export function analizarVenta(
  lineas: { productoId: string; cantidad: number }[],
  productos: Producto[],
  recetas: Receta[],
  materiasPrimas: MateriaPrima[]
) {
  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const consumo = new Map<string, FaltanteMateria>()

  const analisis: AnalisisLinea[] = lineas.map((linea) => {
    const existencias = Math.max(0, productoPorId.get(linea.productoId)?.existencias ?? 0)
    const desdeStock = Math.min(existencias, linea.cantidad)
    const fabricadas = linea.cantidad - desdeStock
    const receta = recetaDeProducto(recetas, linea.productoId)
    if (fabricadas > 0 && tieneMateriaDefinida(receta)) {
      // Varias líneas pueden usar la misma materia prima, así que se acumula el requerimiento
      requerimientos(receta, fabricadas, materiasPrimas).forEach((req) => {
        const actual = consumo.get(req.materiaPrimaId)
        consumo.set(req.materiaPrimaId, {
          materiaPrimaId: req.materiaPrimaId,
          nombre: req.nombre,
          unidad: req.unidad,
          disponible: req.disponible,
          requerido: redondear3((actual?.requerido ?? 0) + req.requerido),
          faltante: 0
        })
      })
    }
    return { productoId: linea.productoId, cantidad: linea.cantidad, desdeStock, fabricadas, sinReceta: fabricadas > 0 && !tieneMateriaDefinida(receta) }
  })

  const materia = Array.from(consumo.values()).map((m) => ({ ...m, faltante: Math.max(0, redondear3(m.requerido - m.disponible)) }))
  return {
    lineas: analisis,
    materia,
    bloqueos: analisis.filter((l) => l.sinReceta).length + materia.filter((m) => m.faltante > 0).length
  }
}

// ---------- Exportación ----------

export function descargarCsv(nombreArchivo: string, filas: (string | number)[][]) {
  const contenido = filas
    .map((fila) => fila.map((celda) => `"${String(celda).replace(/"/g, '""')}"`).join(','))
    .join('\r\n')
  const blob = new Blob([`﻿${contenido}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo
  enlace.click()
  URL.revokeObjectURL(url)
}
