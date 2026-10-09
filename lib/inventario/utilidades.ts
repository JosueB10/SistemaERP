import type {
  ArticuloInventario,
  ClaseArticulo,
  DatosInventario,
  EstadoStock,
  MateriaPrima,
  Movimiento,
  Producto,
  TipoMovimiento,
  TipoProducto,
  UnidadMedida
} from './tipos'

// ---------- Etiquetas ----------

export const ETIQUETAS_TIPO_PRODUCTO: Record<TipoProducto, string> = {
  estandar: 'Estándar',
  personalizado: 'Personalizado'
}

export const ETIQUETAS_CLASE: Record<ClaseArticulo, string> = {
  producto: 'Producto terminado',
  materia_prima: 'Materia prima'
}

export const ETIQUETAS_ESTADO: Record<EstadoStock, string> = {
  disponible: 'Disponible',
  stock_bajo: 'Stock bajo',
  agotado: 'Agotado'
}

export const ETIQUETAS_MOVIMIENTO: Record<TipoMovimiento, string> = {
  entrada: 'Entrada',
  salida: 'Salida',
  ajuste: 'Ajuste'
}

export const ETIQUETAS_UNIDAD: Record<UnidadMedida, string> = {
  unidad: 'Unidad',
  kg: 'Kilogramo (kg)',
  g: 'Gramo (g)',
  m: 'Metro (m)',
  m2: 'Metro cuadrado (m²)',
  l: 'Litro (l)',
  ml: 'Mililitro (ml)',
  rollo: 'Rollo'
}

export const ABREVIATURAS_UNIDAD: Record<UnidadMedida, string> = {
  unidad: 'und',
  kg: 'kg',
  g: 'g',
  m: 'm',
  m2: 'm²',
  l: 'l',
  ml: 'ml',
  rollo: 'rollo'
}

export const MOTIVOS_SUGERIDOS: Record<TipoMovimiento, string[]> = {
  entrada: ['Producción terminada', 'Compra a proveedor', 'Devolución de cliente'],
  salida: ['Venta', 'Consumo en producción', 'Merma o daño', 'Muestra'],
  ajuste: ['Conteo físico', 'Corrección de registro']
}

// ---------- Formato ----------
// Se formatea manualmente para que servidor y navegador produzcan el mismo texto.

function separarMiles(entero: string) {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatoNumero(valor: number, decimales = 0) {
  const negativo = valor < 0
  const [entero, fraccion] = Math.abs(valor).toFixed(decimales).split('.')
  const texto = fraccion ? `${separarMiles(entero)}.${fraccion}` : separarMiles(entero)
  return negativo ? `-${texto}` : texto
}

export function formatoCantidad(valor: number) {
  return formatoNumero(valor, Number.isInteger(valor) ? 0 : 2)
}

export function formatoCordobas(valor: number) {
  const texto = formatoNumero(Math.abs(valor), 2)
  return valor < 0 ? `-C$ ${texto}` : `C$ ${texto}`
}

export function formatoFecha(fecha: string) {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

export function fechaHoy() {
  const hoy = new Date()
  const mes = String(hoy.getMonth() + 1).padStart(2, '0')
  const dia = String(hoy.getDate()).padStart(2, '0')
  return `${hoy.getFullYear()}-${mes}-${dia}`
}

export function normalizarTexto(texto: string) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function coincideBusqueda(busqueda: string, ...campos: (string | undefined)[]) {
  const termino = normalizarTexto(busqueda)
  if (!termino) return true
  return campos.some((campo) => campo && normalizarTexto(campo).includes(termino))
}

// ---------- Validación ----------

export function validarNumero(
  texto: string,
  opciones: { etiqueta: string; entero?: boolean; mayorQueCero?: boolean; decimales?: number }
): { valor: number; error?: undefined } | { valor?: undefined; error: string } {
  const limpio = texto.trim()
  if (limpio === '') return { error: `${opciones.etiqueta} es obligatorio.` }

  const valor = Number(limpio)
  if (!Number.isFinite(valor)) return { error: `${opciones.etiqueta} debe ser un número válido.` }
  if (valor < 0) return { error: `${opciones.etiqueta} no puede ser negativo.` }
  if (opciones.mayorQueCero && valor === 0) {
    return { error: `${opciones.etiqueta} debe ser mayor que cero.` }
  }
  if (opciones.entero && !Number.isInteger(valor)) {
    return { error: `${opciones.etiqueta} debe ser un número entero.` }
  }

  const decimales = opciones.decimales ?? 2
  const fraccion = limpio.split('.')[1] ?? ''
  if (!opciones.entero && fraccion.length > decimales) {
    return { error: `${opciones.etiqueta} admite como máximo ${decimales} decimales.` }
  }

  return { valor }
}

// ---------- Cálculos derivados ----------

export function estadoStock(existencias: number, stockMinimo: number): EstadoStock {
  if (existencias <= 0) return 'agotado'
  if (existencias <= stockMinimo) return 'stock_bajo'
  return 'disponible'
}

export function tieneStockBajo(articulo: { existencias: number; stockMinimo: number }) {
  return articulo.existencias <= articulo.stockMinimo
}

export function productoComoArticulo(producto: Producto): ArticuloInventario {
  return {
    clase: 'producto',
    id: producto.id,
    codigo: producto.sku,
    nombre: producto.nombre,
    categoria: producto.categoria,
    unidad: 'und',
    existencias: producto.existencias,
    stockMinimo: producto.stockMinimo,
    costoUnitario: producto.costoProduccion,
    estado: estadoStock(producto.existencias, producto.stockMinimo)
  }
}

export function materiaComoArticulo(materia: MateriaPrima): ArticuloInventario {
  return {
    clase: 'materia_prima',
    id: materia.id,
    codigo: materia.codigo,
    nombre: materia.nombre,
    categoria: materia.categoria,
    unidad: ABREVIATURAS_UNIDAD[materia.unidad],
    existencias: materia.existencias,
    stockMinimo: materia.stockMinimo,
    costoUnitario: materia.costoUnitario,
    estado: estadoStock(materia.existencias, materia.stockMinimo)
  }
}

export function todosLosArticulos(datos: DatosInventario): ArticuloInventario[] {
  return [
    ...datos.productos.map(productoComoArticulo),
    ...datos.materiasPrimas.map(materiaComoArticulo)
  ]
}

export function buscarArticulo(
  datos: DatosInventario,
  clase: ClaseArticulo,
  id: string
): ArticuloInventario | undefined {
  if (clase === 'producto') {
    const producto = datos.productos.find((item) => item.id === id)
    return producto && productoComoArticulo(producto)
  }
  const materia = datos.materiasPrimas.find((item) => item.id === id)
  return materia && materiaComoArticulo(materia)
}

// Ordenados de mayor a menor déficit respecto al mínimo
export function articulosStockBajo(datos: DatosInventario) {
  return todosLosArticulos(datos)
    .filter(tieneStockBajo)
    .sort((a, b) => a.existencias - a.stockMinimo - (b.existencias - b.stockMinimo))
}

export function valorInventario(datos: DatosInventario) {
  const productos = datos.productos.reduce(
    (total, item) => total + item.existencias * item.costoProduccion,
    0
  )
  const materias = datos.materiasPrimas.reduce(
    (total, item) => total + item.existencias * item.costoUnitario,
    0
  )
  return { productos, materias, total: productos + materias }
}

export function variacionMovimiento(movimiento: Pick<Movimiento, 'tipo' | 'sentido' | 'cantidad'>) {
  if (movimiento.tipo === 'entrada') return movimiento.cantidad
  if (movimiento.tipo === 'salida') return -movimiento.cantidad
  return movimiento.sentido === 'decremento' ? -movimiento.cantidad : movimiento.cantidad
}

export function ordenarMovimientos(movimientos: Movimiento[]) {
  return [...movimientos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || b.registradoEn.localeCompare(a.registradoEn)
  )
}

export function categoriasUnicas(items: { categoria: string }[]) {
  return Array.from(new Set(items.map((item) => item.categoria))).sort((a, b) =>
    a.localeCompare(b, 'es')
  )
}

export function rutaDetalle(clase: ClaseArticulo, id: string) {
  const base = clase === 'producto' ? '/inventario/productos' : '/inventario/materias-primas'
  return `${base}?detalle=${encodeURIComponent(id)}`
}
