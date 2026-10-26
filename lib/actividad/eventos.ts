// Bitácora del negocio y notificaciones. Funciones puras sobre los datos que ya cargan los demás módulos:
// cada evento sabe de qué documento salió (venta, compra, orden...) y a qué página lleva.

import type { DatosCompras } from '../compras/tipos'
import type { DatosFinanzas } from '../finanzas/tipos'
import { enRango } from '../finanzas/utilidades'
import type { DatosInventario, MateriaPrima } from '../inventario/tipos'
import { ABREVIATURAS_UNIDAD, fechaHoy, formatoCantidad, formatoCordobas, rutaDetalle } from '../inventario/utilidades'
import type { DatosProduccion } from '../produccion/tipos'
import { codigoOrden, materiaComprometida, ordenAbierta, recetaDeProducto, redondear3, requerimientos, tieneMateriaDefinida } from '../produccion/utilidades'
import type { DatosRecursosHumanos } from '../recursos-humanos/tipos'
import { ETIQUETAS_PERIODICIDAD } from '../recursos-humanos/utilidades'
import type { Periodo } from '../reportes/calculos'
import type { DatosVentas } from '../ventas/tipos'
import { codigoVenta } from '../ventas/utilidades'

export type ModuloActividad = 'ventas' | 'compras' | 'produccion' | 'inventario' | 'finanzas' | 'recursos_humanos'

export const ETIQUETAS_MODULO: Record<ModuloActividad, string> = {
  ventas: 'Ventas',
  compras: 'Compras',
  produccion: 'Producción',
  inventario: 'Inventario',
  finanzas: 'Finanzas',
  recursos_humanos: 'Recursos Humanos'
}

export type TipoEvento =
  | 'venta'
  | 'venta_pendiente'
  | 'venta_completada'
  | 'venta_anulada'
  | 'compra'
  | 'compra_anulada'
  | 'orden_creada'
  | 'orden_completada'
  | 'orden_cancelada'
  | 'movimiento'
  | 'ingreso'
  | 'gasto'
  | 'nomina'

export interface EventoActividad {
  clave: string
  tipo: TipoEvento
  modulo: ModuloActividad
  fecha: string
  // Milisegundos para ordenar: hora de registro si existe, si no el mediodía de la fecha
  momento: number
  titulo: string
  detalle: string
  monto?: number
  // Código del documento que originó el evento (VTA-00012, OP-00003...)
  documento: string
  href: string
}

export type NivelAlerta = 'peligro' | 'alerta'

export interface Alerta {
  clave: string
  nivel: NivelAlerta
  modulo: ModuloActividad
  titulo: string
  detalle: string
  documento: string
  href: string
}

export interface FuentesActividad {
  inventario: DatosInventario
  ventas: DatosVentas
  compras: DatosCompras
  produccion: DatosProduccion
  finanzas: DatosFinanzas
  recursosHumanos: DatosRecursosHumanos
}

function momento(registradoEn: string | undefined, fecha: string) {
  const ms = registradoEn ? Date.parse(registradoEn) : NaN
  return Number.isFinite(ms) ? ms : Date.parse(`${fecha.slice(0, 10)}T12:00:00`)
}

function cantidadConUnidad(cantidad: number, materia?: MateriaPrima) {
  return `${formatoCantidad(redondear3(cantidad))} ${materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''}`.trim()
}

// ---------- Bitácora ----------

export function eventosActividad(f: FuentesActividad): EventoActividad[] {
  const productoPorId = new Map(f.inventario.productos.map((p) => [p.id, p]))
  const materiaPorId = new Map(f.inventario.materiasPrimas.map((m) => [m.id, m]))
  const clientePorId = new Map(f.ventas.clientes.map((c) => [c.id, c]))
  const proveedorPorId = new Map(f.compras.proveedores.map((p) => [p.id, p]))
  const eventos: EventoActividad[] = []

  for (const v of f.ventas.ventas) {
    const cliente = clientePorId.get(v.clienteId ?? '')?.nombre ?? 'Cliente general'
    const unidades = v.lineas.reduce((t, l) => t + l.cantidad, 0)
    const fabricadas = v.lineas.reduce((t, l) => t + l.fabricadas, 0)
    const productos = v.lineas.map((l) => `${formatoCantidad(l.cantidad)} ${productoPorId.get(l.productoId)?.nombre ?? 'producto'}`).join(', ')
    const href = `/ventas?detalle=${encodeURIComponent(v.id)}`
    const porProducir = v.lineas.reduce((t, l) => t + l.porProducir, 0)
    if (porProducir > 0) {
      // Se registró sin producto suficiente: quedó pendiente hasta fabricar lo que faltaba
      const faltaba = v.lineas.filter((l) => l.porProducir > 0)
        .map((l) => `${formatoCantidad(l.porProducir)} ${productoPorId.get(l.productoId)?.nombre ?? 'producto'}`).join(', ')
      eventos.push({
        clave: `venta-${v.id}`,
        tipo: 'venta_pendiente',
        modulo: 'ventas',
        fecha: v.registradoEn.slice(0, 10) || v.fecha,
        momento: momento(v.registradoEn, v.fecha),
        titulo: `Venta ${v.codigo} a ${cliente} pendiente de producción`,
        detalle: `${productos} · faltaba producir ${faltaba}. Sin mover inventario ni dinero hasta completarla`,
        monto: v.total,
        documento: v.codigo,
        href
      })
      if (v.completadaEn) {
        eventos.push({
          clave: `venta-completada-${v.id}`,
          tipo: 'venta_completada',
          modulo: 'ventas',
          fecha: v.fecha,
          momento: momento(v.completadaEn, v.fecha),
          titulo: `Venta ${v.codigo} completada`,
          detalle: `Ya se fabricó lo que faltaba: salió del inventario ${productos} y se registró el ingreso`,
          monto: v.total,
          documento: v.codigo,
          href
        })
      }
    } else {
      eventos.push({
        clave: `venta-${v.id}`,
        tipo: 'venta',
        modulo: 'ventas',
        fecha: v.fecha,
        momento: momento(v.registradoEn, v.fecha),
        titulo: `Venta ${v.codigo} a ${cliente}`,
        detalle: `${productos || `${formatoCantidad(unidades)} und`}${fabricadas ? ` · ${formatoCantidad(fabricadas)} und fabricadas al vender (consumió materia prima)` : ''}`,
        monto: v.total,
        documento: v.codigo,
        href
      })
    }
    if (v.estado === 'anulada') {
      eventos.push({
        clave: `venta-anulada-${v.id}`,
        tipo: 'venta_anulada',
        modulo: 'ventas',
        fecha: (v.anuladaEn ?? v.fecha).slice(0, 10),
        momento: momento(v.anuladaEn, v.fecha),
        titulo: `Venta ${v.codigo} anulada`,
        detalle: v.motivoAnulacion ? `Motivo: ${v.motivoAnulacion}` : 'El producto regresó al inventario',
        monto: -v.total,
        documento: v.codigo,
        href
      })
    }
  }

  for (const c of f.compras.compras) {
    const proveedor = proveedorPorId.get(c.proveedorId ?? '')?.nombre ?? 'Proveedor'
    const materiales = c.lineas.map((l) => `${cantidadConUnidad(l.cantidad, materiaPorId.get(l.materiaPrimaId))} de ${materiaPorId.get(l.materiaPrimaId)?.nombre ?? 'materia prima'}`).join(', ')
    const href = `/compras?detalle=${encodeURIComponent(c.id)}`
    eventos.push({
      clave: `compra-${c.id}`,
      tipo: 'compra',
      modulo: 'compras',
      fecha: c.fecha,
      momento: momento(c.registradoEn, c.fecha),
      titulo: `Compra ${c.codigo} a ${proveedor}`,
      detalle: materiales ? `Entró al inventario: ${materiales}` : 'Compra de materia prima',
      monto: c.total,
      documento: c.codigo,
      href
    })
    if (c.estado === 'anulada') {
      eventos.push({
        clave: `compra-anulada-${c.id}`,
        tipo: 'compra_anulada',
        modulo: 'compras',
        fecha: (c.anuladaEn ?? c.fecha).slice(0, 10),
        momento: momento(c.anuladaEn, c.fecha),
        titulo: `Compra ${c.codigo} anulada`,
        detalle: c.motivoAnulacion ? `Motivo: ${c.motivoAnulacion}` : 'La materia prima salió del inventario',
        monto: -c.total,
        documento: c.codigo,
        href
      })
    }
  }

  for (const o of f.produccion.ordenes) {
    const producto = productoPorId.get(o.productoId)?.nombre ?? 'Producto inactivo'
    const href = `/produccion?detalle=${encodeURIComponent(o.id)}`
    eventos.push({
      clave: `orden-${o.id}`,
      tipo: 'orden_creada',
      modulo: 'produccion',
      fecha: o.creadoEn.slice(0, 10),
      momento: momento(o.creadoEn, o.creadoEn),
      titulo: `Orden ${o.codigo} creada`,
      detalle: `${formatoCantidad(o.cantidadPlanificada)} und de ${producto}${o.fechaProgramada ? ` para el ${o.fechaProgramada.split('-').reverse().join('/')}` : ''}`,
      documento: o.codigo,
      href
    })
    if (o.estado === 'completada' && o.fechaFin) {
      const consumo = o.consumos.filter((c) => c.cantidadReal > 0)
        .map((c) => `${cantidadConUnidad(c.cantidadReal, materiaPorId.get(c.materiaPrimaId))} de ${materiaPorId.get(c.materiaPrimaId)?.nombre ?? 'materia prima'}`)
        .join(', ')
      eventos.push({
        clave: `orden-completada-${o.id}`,
        tipo: 'orden_completada',
        modulo: 'produccion',
        fecha: o.fechaFin,
        momento: Math.max(momento(undefined, o.fechaFin), momento(o.creadoEn, o.creadoEn) + 1),
        titulo: `Orden ${o.codigo} completada: +${formatoCantidad(o.cantidadProducida)} und de ${producto}`,
        detalle: consumo ? `Se utilizó ${consumo}` : 'Sin consumo de materia prima registrado',
        monto: o.costoMateriales,
        documento: o.codigo,
        href
      })
    }
    if (o.estado === 'cancelada') {
      const fecha = o.fechaFin ?? o.creadoEn.slice(0, 10)
      eventos.push({
        clave: `orden-cancelada-${o.id}`,
        tipo: 'orden_cancelada',
        modulo: 'produccion',
        fecha,
        momento: Math.max(momento(undefined, fecha), momento(o.creadoEn, o.creadoEn) + 1),
        titulo: `Orden ${o.codigo} cancelada`,
        detalle: `${formatoCantidad(o.cantidadPlanificada)} und de ${producto} · no se movió inventario`,
        documento: o.codigo,
        href
      })
    }
  }

  // Solo los movimientos hechos a mano: los de ventas, compras y producción ya están en su documento
  for (const m of f.inventario.movimientos) {
    if (m.referenciaId) continue
    const esProducto = m.claseArticulo === 'producto'
    const articulo = esProducto ? productoPorId.get(m.articuloId) : materiaPorId.get(m.articuloId)
    if (!articulo) continue
    const unidad = esProducto ? 'und' : ABREVIATURAS_UNIDAD[(articulo as MateriaPrima).unidad]
    const accion = m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'salida' ? 'Salida' : m.sentido === 'decremento' ? 'Ajuste (−)' : 'Ajuste (+)'
    eventos.push({
      clave: `movimiento-${m.id}`,
      tipo: 'movimiento',
      modulo: 'inventario',
      fecha: m.fecha,
      momento: momento(m.registradoEn, m.fecha),
      titulo: `${accion} de ${articulo.nombre}`,
      detalle: `${formatoCantidad(m.cantidad)} ${unidad} · ${m.motivo} · quedó en ${formatoCantidad(m.existenciasResultantes)} ${unidad}`,
      documento: `MOV-${m.id.padStart(5, '0')}`,
      href: `/inventario/movimientos?articulo=${encodeURIComponent(m.articuloId)}`
    })
  }

  for (const [tipo, lista] of [['ingreso', f.finanzas.ingresos], ['gasto', f.finanzas.gastos]] as const) {
    for (const m of lista) {
      if (m.origen !== 'manual') continue
      eventos.push({
        clave: `${tipo}-${m.id}`,
        tipo,
        modulo: 'finanzas',
        fecha: m.fecha,
        momento: momento(m.registradoEn, m.fecha),
        titulo: `${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado: ${m.concepto}`,
        detalle: m.categoria,
        monto: m.monto,
        documento: m.categoria,
        href: tipo === 'ingreso' ? '/finanzas/ingresos' : '/finanzas/gastos'
      })
    }
  }

  for (const n of f.recursosHumanos.nominas) {
    if (n.estado !== 'pagada') continue
    const fecha = n.fechaPago ?? n.periodoFin
    eventos.push({
      clave: `nomina-${n.id}`,
      tipo: 'nomina',
      modulo: 'recursos_humanos',
      fecha,
      momento: momento(undefined, fecha),
      titulo: `Nómina ${ETIQUETAS_PERIODICIDAD[n.periodicidad].toLowerCase()} pagada`,
      detalle: `Del ${n.periodoInicio.split('-').reverse().join('/')} al ${n.periodoFin.split('-').reverse().join('/')} · ${n.lineas.length} empleado(s)`,
      monto: n.totalNeto,
      documento: 'Planilla',
      href: '/recursos-humanos/nomina'
    })
  }

  return eventos.sort((a, b) => b.momento - a.momento)
}

export function eventosDelPeriodo(eventos: EventoActividad[], periodo: Periodo) {
  return eventos.filter((e) => enRango(e.fecha, periodo.desde, periodo.hasta))
}

// ---------- Alertas (situaciones que siguen vigentes) ----------

export function alertasActuales(f: FuentesActividad): Alerta[] {
  const alertas: Alerta[] = []
  const hoy = fechaHoy()

  for (const m of f.inventario.materiasPrimas) {
    const unidad = ABREVIATURAS_UNIDAD[m.unidad]
    if (m.existencias <= 0) {
      alertas.push({
        clave: `alerta-mp-agotada-${m.id}`,
        nivel: 'peligro',
        modulo: 'inventario',
        titulo: `Se acabó ${m.nombre}`,
        detalle: 'Sin existencias: no se pueden crear órdenes que la usen hasta registrar una compra.',
        documento: m.codigo,
        href: rutaDetalle('materia_prima', m.id)
      })
    } else if (m.existencias <= m.stockMinimo) {
      alertas.push({
        clave: `alerta-mp-baja-${m.id}`,
        nivel: 'alerta',
        modulo: 'inventario',
        titulo: `Stock bajo de ${m.nombre}`,
        detalle: `Quedan ${formatoCantidad(m.existencias)} ${unidad} (mínimo ${formatoCantidad(m.stockMinimo)} ${unidad}).`,
        documento: m.codigo,
        href: rutaDetalle('materia_prima', m.id)
      })
    }
  }

  for (const p of f.inventario.productos) {
    if (p.stockMinimo <= 0 || p.existencias > p.stockMinimo) continue
    alertas.push({
      clave: `alerta-producto-${p.existencias <= 0 ? 'agotado' : 'bajo'}-${p.id}`,
      nivel: 'alerta',
      modulo: 'inventario',
      titulo: p.existencias <= 0 ? `${p.nombre} agotado` : `Stock bajo de ${p.nombre}`,
      detalle: `Quedan ${formatoCantidad(p.existencias)} und (mínimo ${formatoCantidad(p.stockMinimo)} und).`,
      documento: p.sku,
      href: rutaDetalle('producto', p.id)
    })
  }

  // Ventas pendientes: avisar qué hay que producir (la más antigua tiene prioridad sobre el stock)
  const pendientes = f.ventas.ventas.filter((v) => v.estado === 'pendiente').sort((a, b) => Number(a.id) - Number(b.id))
  const apartadas = new Map<string, number>()
  for (const v of pendientes) {
    const href = `/ventas?detalle=${encodeURIComponent(v.id)}`
    const faltan = v.lineas.map((l) => {
      const existencias = f.inventario.productos.find((p) => p.id === l.productoId)?.existencias ?? 0
      const disponible = Math.max(0, existencias - (apartadas.get(l.productoId) ?? 0))
      return { linea: l, falta: Math.max(0, l.cantidad - disponible) }
    })
    v.lineas.forEach((l) => apartadas.set(l.productoId, (apartadas.get(l.productoId) ?? 0) + l.cantidad))
    const conFalta = faltan.filter((x) => x.falta > 0)
    if (conFalta.length === 0) {
      alertas.push({
        clave: `alerta-venta-lista-${v.id}`,
        nivel: 'alerta',
        modulo: 'ventas',
        titulo: `Venta ${v.codigo} lista para completar`,
        detalle: 'Ya hay producto suficiente: complétela para descontar el inventario y registrar el ingreso.',
        documento: v.codigo,
        href
      })
      continue
    }
    for (const { linea, falta } of conFalta) {
      const producto = f.inventario.productos.find((p) => p.id === linea.productoId)?.nombre ?? 'producto'
      const orden = f.produccion.ordenes.find((o) => o.ventaId === v.id && o.productoId === linea.productoId && ordenAbierta(o))
      alertas.push({
        clave: `alerta-venta-producir-${v.id}-${linea.productoId}`,
        nivel: orden ? 'alerta' : 'peligro',
        modulo: 'ventas',
        titulo: `Producir ${formatoCantidad(falta)} und de ${producto} para la venta ${v.codigo}`,
        detalle: orden
          ? `La venta está pendiente hasta que se complete la orden ${orden.codigo}.`
          : 'La venta está pendiente y no hay orden de producción (faltaba materia prima). Compre materia prima y cree la orden.',
        documento: orden ? orden.codigo : v.codigo,
        href: orden
          ? `/produccion?detalle=${encodeURIComponent(orden.id)}`
          : `/produccion?nueva=${encodeURIComponent(linea.productoId)}&cantidad=${falta}&venta=${encodeURIComponent(v.id)}`
      })
    }
  }

  const { ordenes, recetas } = f.produccion
  for (const o of ordenes) {
    if (!ordenAbierta(o)) continue
    const producto = f.inventario.productos.find((p) => p.id === o.productoId)?.nombre ?? 'Producto inactivo'
    const href = `/produccion?detalle=${encodeURIComponent(o.id)}`
    const receta = recetaDeProducto(recetas, o.productoId)
    const faltantes = tieneMateriaDefinida(receta)
      ? requerimientos(receta, o.cantidadPlanificada, f.inventario.materiasPrimas, materiaComprometida(ordenes, recetas, o.id)).filter((l) => l.faltante > 0)
      : []
    if (faltantes.length) {
      alertas.push({
        clave: `alerta-orden-sin-materia-${o.id}`,
        nivel: 'peligro',
        modulo: 'produccion',
        titulo: `Orden ${codigoOrden(o.id)} sin materia prima suficiente`,
        detalle: `${producto}: faltan ${faltantes.map((l) => `${formatoCantidad(l.faltante)} ${l.unidad} de ${l.nombre}`).join(', ')}.`,
        documento: o.codigo,
        href
      })
    } else if (o.estado === 'pendiente' && o.fechaProgramada && o.fechaProgramada < hoy) {
      alertas.push({
        clave: `alerta-orden-atrasada-${o.id}`,
        nivel: 'alerta',
        modulo: 'produccion',
        titulo: `Orden ${o.codigo} atrasada`,
        detalle: `${producto}: estaba programada para el ${o.fechaProgramada.split('-').reverse().join('/')} y sigue pendiente.`,
        documento: o.codigo,
        href
      })
    }
  }

  return alertas.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'peligro' ? -1 : 1))
}

// ---------- Materia prima utilizada ----------

export interface ConsumoMateria {
  materiaPrimaId: string
  codigo: string
  nombre: string
  unidad: string
  enProduccion: number
  enVentas: number
  otrasSalidas: number
  cantidad: number
  costo: number
  // Documentos de donde salió el consumo
  documentos: string[]
}

// Salidas de materia prima del período según los movimientos de inventario, separadas por su origen
export function consumoMateriaPrima(inventario: DatosInventario, periodo: Periodo): ConsumoMateria[] {
  const materiaPorId = new Map(inventario.materiasPrimas.map((m) => [m.id, m]))
  const filas = new Map<string, ConsumoMateria>()
  for (const m of inventario.movimientos) {
    if (m.claseArticulo !== 'materia_prima' || !enRango(m.fecha, periodo.desde, periodo.hasta)) continue
    const salida = m.tipo === 'salida' || (m.tipo === 'ajuste' && m.sentido === 'decremento')
    // Las anulaciones de compra devuelven material al proveedor: no es material utilizado
    if (!salida || m.referenciaTipo === 'compra') continue
    const materia = materiaPorId.get(m.articuloId)
    if (!materia) continue
    const fila = filas.get(m.articuloId) ?? {
      materiaPrimaId: m.articuloId,
      codigo: materia.codigo,
      nombre: materia.nombre,
      unidad: ABREVIATURAS_UNIDAD[materia.unidad],
      enProduccion: 0,
      enVentas: 0,
      otrasSalidas: 0,
      cantidad: 0,
      costo: 0,
      documentos: []
    }
    if (m.referenciaTipo === 'orden_produccion') {
      fila.enProduccion += m.cantidad
      if (m.referenciaId) fila.documentos.push(codigoOrden(m.referenciaId))
    } else if (m.referenciaTipo === 'venta') {
      fila.enVentas += m.cantidad
      if (m.referenciaId) fila.documentos.push(codigoVenta(m.referenciaId))
    } else {
      fila.otrasSalidas += m.cantidad
    }
    fila.cantidad = redondear3(fila.cantidad + m.cantidad)
    fila.costo += m.cantidad * materia.costoUnitario
    filas.set(m.articuloId, fila)
  }
  return [...filas.values()]
    .map((f) => ({ ...f, documentos: [...new Set(f.documentos)] }))
    .sort((a, b) => b.costo - a.costo)
}

export function textoMonto(evento: Pick<EventoActividad, 'monto'>) {
  return evento.monto === undefined ? '' : formatoCordobas(evento.monto)
}
