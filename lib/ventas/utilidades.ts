import type { MateriaPrima, Producto } from '../inventario/tipos'
import type { OrdenProduccion, Receta } from '../produccion/tipos'
import { materiaComprometida, recetaDeProducto, redondear3, requerimientos, tieneMateriaDefinida } from '../produccion/utilidades'
import type { EstadoVenta, MetodoPago, Venta } from './tipos'

// ---------- Etiquetas ----------

export const ETIQUETAS_ESTADO_VENTA: Record<EstadoVenta, string> = {
  pendiente: 'Pendiente',
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
// Solo se vende lo que ya está hecho. Si el stock terminado (menos lo apartado por otras ventas pendientes)
// no alcanza, la venta queda pendiente y se crea una orden de producción por lo que falta.

export interface AnalisisLinea {
  productoId: string
  cantidad: number
  disponible: number
  desdeStock: number
  porProducir: number
  // Unidades del stock apartadas por otras ventas pendientes
  apartadas: number
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

// Unidades de cada producto apartadas por ventas pendientes
export function unidadesApartadas(ventas: Venta[], excluirVentaId?: string) {
  const apartadas = new Map<string, number>()
  for (const venta of ventas) {
    if (venta.estado !== 'pendiente' || venta.id === excluirVentaId) continue
    for (const linea of venta.lineas) apartadas.set(linea.productoId, (apartadas.get(linea.productoId) ?? 0) + linea.cantidad)
  }
  return apartadas
}

export function analizarVenta(
  lineas: { productoId: string; cantidad: number }[],
  productos: Producto[],
  recetas: Receta[],
  materiasPrimas: MateriaPrima[],
  ventas: Venta[],
  ordenes: OrdenProduccion[]
) {
  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const apartadasPorProducto = unidadesApartadas(ventas)
  const comprometida = materiaComprometida(ordenes, recetas)
  const consumo = new Map<string, FaltanteMateria>()

  const analisis: AnalisisLinea[] = lineas.map((linea) => {
    const existencias = Math.max(0, productoPorId.get(linea.productoId)?.existencias ?? 0)
    const apartadas = apartadasPorProducto.get(linea.productoId) ?? 0
    const disponible = Math.max(0, existencias - apartadas)
    const desdeStock = Math.min(disponible, linea.cantidad)
    const porProducir = linea.cantidad - desdeStock
    const receta = recetaDeProducto(recetas, linea.productoId)
    if (porProducir > 0 && tieneMateriaDefinida(receta)) {
      // Varias líneas pueden usar la misma materia prima, así que se acumula el requerimiento
      requerimientos(receta, porProducir, materiasPrimas, comprometida).forEach((req) => {
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
    return { productoId: linea.productoId, cantidad: linea.cantidad, disponible, desdeStock, porProducir, apartadas, sinReceta: porProducir > 0 && !tieneMateriaDefinida(receta) }
  })

  const materia = Array.from(consumo.values()).map((m) => ({ ...m, faltante: Math.max(0, redondear3(m.requerido - m.disponible)) }))
  return {
    lineas: analisis,
    materia,
    pendiente: analisis.some((l) => l.porProducir > 0),
    // Si falta materia prima la orden no se crea sola: hay que comprar y luego producir
    sinMateria: materia.some((m) => m.faltante > 0)
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
