import { codigoCompra } from '../compras/utilidades'
import { codigoVenta } from '../ventas/utilidades'
import type { MovimientoFinanciero, OrigenFinanciero, TipoFinanciero } from './tipos'

export const ETIQUETAS_TIPO_FINANCIERO: Record<TipoFinanciero, string> = {
  ingreso: 'Ingreso',
  gasto: 'Gasto'
}

export const ETIQUETAS_ORIGEN: Record<OrigenFinanciero, string> = {
  manual: 'Manual',
  venta: 'Venta',
  compra: 'Compra',
  nomina: 'Nómina'
}

// Categorías que generan otros módulos; no se ofrecen al registrar a mano
export const CATEGORIA_VENTAS = 'Ventas'
export const CATEGORIA_COMPRAS = 'Compras de materia prima'
export const CATEGORIA_NOMINA = 'Nómina'

export const CATEGORIAS_SUGERIDAS: Record<TipoFinanciero, string[]> = {
  ingreso: ['Otros ingresos', 'Servicios de diseño', 'Aporte de capital', 'Préstamo recibido', 'Intereses ganados'],
  gasto: [
    'Alquiler',
    'Servicios básicos',
    'Internet y telefonía',
    'Transporte y envíos',
    'Publicidad',
    'Mantenimiento',
    'Impuestos y tasas',
    'Comisiones bancarias',
    'Papelería y oficina',
    'Otros gastos'
  ]
}

export function esAutomatico(movimiento: MovimientoFinanciero) {
  return movimiento.origen !== 'manual'
}

// Enlace y texto del documento que generó un registro automático
export function documentoOrigen(movimiento: MovimientoFinanciero): { texto: string; href: string } | null {
  const id = movimiento.referenciaId
  if (!id) return null
  if (movimiento.origen === 'venta') return { texto: codigoVenta(id), href: `/ventas?detalle=${encodeURIComponent(id)}` }
  if (movimiento.origen === 'compra') return { texto: codigoCompra(id), href: `/compras?detalle=${encodeURIComponent(id)}` }
  if (movimiento.origen === 'nomina') return { texto: 'Planilla', href: '/recursos-humanos/nomina' }
  return null
}

// ---------- Períodos ----------

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function etiquetaMesCorta(clave: string) {
  const [anio, mes] = clave.split('-')
  return `${MESES_CORTOS[Number(mes) - 1]} ${anio.slice(2)}`
}

export function etiquetaMesLarga(clave: string) {
  const [anio, mes] = clave.split('-')
  return `${MESES_LARGOS[Number(mes) - 1]} ${anio}`
}

function desplazarMes(clave: string, meses: number) {
  const [anio, mes] = clave.split('-').map(Number)
  const total = anio * 12 + (mes - 1) + meses
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

// Claves AAAA-MM de los últimos n meses terminando en `hasta` (incluido), en orden cronológico
export function ultimosMeses(hasta: string, n: number) {
  return Array.from({ length: n }, (_, i) => desplazarMes(hasta, i - n + 1))
}

export function mesAnterior(clave: string) {
  return desplazarMes(clave, -1)
}

export function finDeMes(clave: string) {
  const [anio, mes] = clave.split('-').map(Number)
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  return `${clave}-${String(dias).padStart(2, '0')}`
}

export function enRango(fecha: string, desde: string, hasta: string) {
  return (!desde || fecha >= desde) && (!hasta || fecha <= hasta)
}

export function sumaMontos(movimientos: { monto: number }[]) {
  return movimientos.reduce((total, m) => total + m.monto, 0)
}

// Suma por categoría ordenada de mayor a menor
export function totalesPorCategoria(movimientos: MovimientoFinanciero[]) {
  const mapa = new Map<string, number>()
  movimientos.forEach((m) => mapa.set(m.categoria, (mapa.get(m.categoria) ?? 0) + m.monto))
  return Array.from(mapa, ([categoria, total]) => ({ categoria, total })).sort((a, b) => b.total - a.total)
}

// Ingresos, gastos y neto por mes para las claves dadas
export function flujoMensual(ingresos: MovimientoFinanciero[], gastos: MovimientoFinanciero[], meses: string[]) {
  return meses.map((mes) => {
    const entra = sumaMontos(ingresos.filter((m) => m.fecha.startsWith(mes)))
    const sale = sumaMontos(gastos.filter((m) => m.fecha.startsWith(mes)))
    return { mes, ingresos: entra, gastos: sale, neto: entra - sale }
  })
}
