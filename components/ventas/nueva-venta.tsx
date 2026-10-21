'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Trash2, UserPlus } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { fechaHoy, formatoCantidad, formatoCordobas, validarNumero } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { registrarVenta, useVentas } from '@/lib/ventas/store'
import type { MetodoPago } from '@/lib/ventas/tipos'
import { analizarVenta, calcularTotales, codigoVenta, ETIQUETAS_METODO_PAGO, redondear2 } from '@/lib/ventas/utilidades'
import {
  AvisoConexion,
  Campo,
  claseBotonPrimario,
  claseBotonSecundario,
  claseCabeceraTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  ErrorFormulario,
  Modal
} from '../inventario/ui'
import ClienteFormulario from './cliente-formulario'
import { AvisoConexionVentas, ResumenTotales, SECCION_VENTAS } from './ui'

type Linea = { clave: number; productoId: string; cantidad: string; precio: string }

let siguienteClave = 0
const nuevaLinea = (): Linea => ({ clave: siguienteClave++, productoId: '', cantidad: '1', precio: '' })

export default function NuevaVenta() {
  const { productos, materiasPrimas } = useInventario()
  const { recetas } = useProduccion()
  const { clientes } = useVentas()
  const searchParams = useSearchParams()

  const [clienteId, setClienteId] = useState(searchParams.get('cliente') ?? '')
  const [fecha, setFecha] = useState(fechaHoy())
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<Linea[]>(() => [nuevaLinea()])
  const [descuentoTexto, setDescuentoTexto] = useState('')
  const [aplicaIva, setAplicaIva] = useState(false)
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [registrada, setRegistrada] = useState<{ id: string; total: number } | null>(null)
  const [nuevoCliente, setNuevoCliente] = useState(false)

  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const clientesActivos = clientes.filter((c) => c.activo || c.id === clienteId)

  // Líneas con producto y cantidad válidos, para totales y disponibilidad
  const validas = lineas.flatMap((l) => {
    const cantidad = Number(l.cantidad)
    const precio = Number(l.precio)
    if (!l.productoId || !Number.isInteger(cantidad) || cantidad <= 0) return []
    return [{ productoId: l.productoId, cantidad, precioUnitario: Number.isFinite(precio) && precio >= 0 ? redondear2(precio) : 0 }]
  })
  const subtotal = validas.reduce((total, l) => total + redondear2(l.cantidad * l.precioUnitario), 0)
  const descuento = Number(descuentoTexto) > 0 ? redondear2(Number(descuentoTexto)) : 0
  const totales = calcularTotales(subtotal, descuento, aplicaIva)
  const analisis = analizarVenta(validas, productos, recetas, materiasPrimas)
  const analisisPorProducto = new Map(analisis.lineas.map((a) => [a.productoId, a]))
  const totalFabricadas = analisis.lineas.reduce((total, a) => total + a.fabricadas, 0)
  const costoEstimado = validas.reduce((total, l) => total + l.cantidad * (productoPorId.get(l.productoId)?.costoProduccion ?? 0), 0)

  const cambiarLinea = (clave: number, campo: 'productoId' | 'cantidad' | 'precio', valor: string) => {
    setLineas((actual) =>
      actual.map((l) => {
        if (l.clave !== clave) return l
        // Al elegir producto se propone su precio de venta
        if (campo === 'productoId') return { ...l, productoId: valor, precio: valor ? String(productoPorId.get(valor)?.precioVenta ?? '') : '' }
        return { ...l, [campo]: valor }
      })
    )
    setErrores((actual) => ({ ...actual, [clave]: '' }))
    setErrorGeneral(null)
  }

  const reiniciar = () => {
    setClienteId('')
    setFecha(fechaHoy())
    setMetodoPago('efectivo')
    setObservaciones('')
    setLineas([nuevaLinea()])
    setDescuentoTexto('')
    setAplicaIva(false)
    setErrores({})
    setErrorGeneral(null)
    setRegistrada(null)
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const usadas = lineas.filter((l) => l.productoId || l.precio.trim())
    const nuevosErrores: Record<number, string> = {}
    const vistos = new Set<string>()
    const definitivas: { productoId: string; cantidad: number; precioUnitario: number }[] = []

    for (const linea of usadas) {
      if (!linea.productoId) { nuevosErrores[linea.clave] = 'Seleccione el producto.'; continue }
      if (vistos.has(linea.productoId)) { nuevosErrores[linea.clave] = 'Este producto ya está en la venta; sume la cantidad en una sola línea.'; continue }
      vistos.add(linea.productoId)
      const cantidad = validarNumero(linea.cantidad, { etiqueta: 'La cantidad', entero: true, mayorQueCero: true })
      if (cantidad.error) { nuevosErrores[linea.clave] = cantidad.error; continue }
      const precio = validarNumero(linea.precio, { etiqueta: 'El precio' })
      if (precio.error) { nuevosErrores[linea.clave] = precio.error; continue }
      definitivas.push({ productoId: linea.productoId, cantidad: cantidad.valor!, precioUnitario: precio.valor! })
    }
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return
    if (definitivas.length === 0) { setErrorGeneral('Agregue al menos un producto a la venta.'); return }

    let descuentoValido = 0
    if (descuentoTexto.trim()) {
      const resultado = validarNumero(descuentoTexto, { etiqueta: 'El descuento' })
      if (resultado.error) { setErrorGeneral(resultado.error); return }
      descuentoValido = resultado.valor!
    }
    if (descuentoValido > subtotal) { setErrorGeneral('El descuento no puede ser mayor que el subtotal.'); return }
    if (analisis.bloqueos > 0) { setErrorGeneral('No hay stock ni materia prima suficiente para algunos productos. Revise los avisos.'); return }

    setEnviando(true)
    const resultado = await registrarVenta({
      clienteId: clienteId || undefined,
      fecha,
      metodoPago,
      descuento: descuentoValido,
      aplicaIva,
      observaciones,
      lineas: definitivas
    })
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    setRegistrada({ id: resultado.id ?? '', total: totales.total })
  }

  if (registrada) {
    return (
      <>
        <EncabezadoPagina titulo="Nueva venta" descripcion="Registre la venta de productos terminados." seccion={SECCION_VENTAS} />
        <div className={`${claseTarjeta} p-8 text-center max-w-lg mx-auto`}>
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
          <p className="text-lg font-semibold text-stone-900">Venta {codigoVenta(registrada.id)} registrada</p>
          <p className="text-sm text-stone-500 mt-1">Total cobrado: {formatoCordobas(registrada.total)}. El inventario y el ingreso ya se actualizaron.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/ventas?detalle=${encodeURIComponent(registrada.id)}`} className={claseBotonSecundario}>Ver venta</Link>
            <button type="button" onClick={reiniciar} className={claseBotonPrimario}><Plus size={16} />Nueva venta</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AvisoConexion />
      <AvisoConexionVentas />
      <EncabezadoPagina
        titulo="Nueva venta"
        descripcion="Lo que no haya en stock terminado se fabrica al momento descontando la materia prima de su receta."
        seccion={SECCION_VENTAS}
      />

      <form onSubmit={enviar} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className={`${claseTarjeta} p-5`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo etiqueta="Cliente" htmlFor="venta-cliente" className="sm:col-span-2 lg:col-span-1">
                <div className="flex gap-2">
                  <select id="venta-cliente" value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={claseInput}>
                    <option value="">Cliente de contado</option>
                    {clientesActivos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => setNuevoCliente(true)} className={`${claseBotonSecundario} px-3 shrink-0`} aria-label="Registrar cliente" title="Registrar cliente">
                    <UserPlus size={16} />
                  </button>
                </div>
              </Campo>
              <Campo etiqueta="Fecha" htmlFor="venta-fecha" requerido>
                <input id="venta-fecha" type="date" value={fecha} max={fechaHoy()} onChange={(e) => setFecha(e.target.value || fechaHoy())} className={claseInput} />
              </Campo>
              <Campo etiqueta="Método de pago" htmlFor="venta-pago" requerido>
                <select id="venta-pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)} className={claseInput}>
                  {(Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]).map((m) => <option key={m} value={m}>{ETIQUETAS_METODO_PAGO[m]}</option>)}
                </select>
              </Campo>
            </div>
          </section>

          <section className={claseTarjeta}>
            <div className="flex items-center justify-between gap-3 border-b border-stone-200 px-5 py-4">
              <h2 className="font-semibold text-stone-900">Productos</h2>
              <button type="button" onClick={() => setLineas((actual) => [...actual, nuevaLinea()])} className={`${claseBotonSecundario} h-9`}>
                <Plus size={15} />
                Agregar línea
              </button>
            </div>

            {productos.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-stone-500">Primero registre productos en Inventario.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-stone-50">
                    <tr>
                      <th className={claseCabeceraTabla}>Producto</th>
                      <th className={`${claseCabeceraTabla} w-28`}>Cantidad</th>
                      <th className={`${claseCabeceraTabla} w-36`}>Precio (C$)</th>
                      <th className={`${claseCabeceraTabla} text-right w-32`}>Subtotal</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {lineas.map((linea) => {
                      const producto = productoPorId.get(linea.productoId)
                      const info = analisisPorProducto.get(linea.productoId)
                      const cantidad = Number(linea.cantidad)
                      const precio = Number(linea.precio)
                      const subtotalLinea = Number.isFinite(cantidad) && Number.isFinite(precio) ? cantidad * precio : 0
                      const usados = new Set(lineas.filter((l) => l.clave !== linea.clave).map((l) => l.productoId))
                      return (
                        <tr key={linea.clave} className="align-top">
                          <td className="px-3 py-2">
                            <select value={linea.productoId} onChange={(e) => cambiarLinea(linea.clave, 'productoId', e.target.value)} className={claseInput} aria-label="Producto">
                              <option value="">Seleccione...</option>
                              {productos.map((p) => (
                                <option key={p.id} value={p.id} disabled={usados.has(p.id)}>
                                  {p.sku} — {p.nombre} ({formatoCantidad(p.existencias)} en stock)
                                </option>
                              ))}
                            </select>
                            {errores[linea.clave] ? (
                              <p className="text-xs text-red-600 mt-1">{errores[linea.clave]}</p>
                            ) : info?.sinReceta ? (
                              <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                <AlertTriangle size={12} />
                                Solo hay {formatoCantidad(info.desdeStock)} en stock y no tiene receta para fabricar el resto.
                              </p>
                            ) : info && info.fabricadas > 0 ? (
                              <p className="text-xs text-amber-700 mt-1">
                                {formatoCantidad(info.desdeStock)} del stock · {formatoCantidad(info.fabricadas)} se fabricarán con materia prima
                              </p>
                            ) : producto ? (
                              <p className="text-xs text-stone-400 mt-1">Costo {formatoCordobas(producto.costoProduccion)} · lista {formatoCordobas(producto.precioVenta)}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="1" step="1" inputMode="numeric" value={linea.cantidad} onChange={(e) => cambiarLinea(linea.clave, 'cantidad', e.target.value)} className={claseInput} aria-label="Cantidad" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" inputMode="decimal" value={linea.precio} onChange={(e) => cambiarLinea(linea.clave, 'precio', e.target.value)} className={claseInput} aria-label="Precio unitario" />
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium text-stone-900 leading-10 whitespace-nowrap">
                            {formatoCordobas(subtotalLinea > 0 ? subtotalLinea : 0)}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setLineas((actual) => (actual.length > 1 ? actual.filter((l) => l.clave !== linea.clave) : [nuevaLinea()]))}
                              className="h-10 w-8 flex items-center justify-center text-stone-400 hover:text-red-600"
                              aria-label="Quitar línea"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {analisis.materia.length > 0 && (
            <section className={`${claseTarjeta} p-5`}>
              <h2 className="text-sm font-semibold text-stone-900">Materia prima a consumir</h2>
              <p className="text-xs text-stone-500 mb-3">Para fabricar {formatoCantidad(totalFabricadas)} und que no hay en stock.</p>
              <ul className="divide-y divide-stone-100 text-sm">
                {analisis.materia.map((m) => (
                  <li key={m.materiaPrimaId} className="flex justify-between gap-3 py-2">
                    <span className="text-stone-700">{m.nombre}</span>
                    <span className={m.faltante > 0 ? 'font-medium text-red-600' : 'text-stone-600'}>
                      {formatoCantidad(m.requerido)} {m.unidad} de {formatoCantidad(m.disponible)} disponibles
                      {m.faltante > 0 && ` · faltan ${formatoCantidad(m.faltante)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Campo etiqueta="Observaciones" htmlFor="venta-observaciones">
            <textarea id="venta-observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Diseño personalizado, entrega, referencia de pago..." className={`${claseInput} h-auto py-2 resize-none`} />
          </Campo>
        </div>

        <aside className={`${claseTarjeta} p-5 space-y-5 self-start xl:sticky xl:top-6`}>
          <h2 className="font-semibold text-stone-900">Resumen</h2>

          <Campo etiqueta="Descuento (C$)" htmlFor="venta-descuento">
            <input id="venta-descuento" type="number" min="0" step="0.01" inputMode="decimal" value={descuentoTexto} onChange={(e) => { setDescuentoTexto(e.target.value); setErrorGeneral(null) }} placeholder="0.00" className={claseInput} />
          </Campo>

          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={aplicaIva} onChange={(e) => setAplicaIva(e.target.checked)} className="h-4 w-4 rounded border-stone-300" />
            Cobrar IVA (15 %)
          </label>

          <ResumenTotales
            {...totales}
            extra={
              subtotal > 0 && (
                <div className="flex justify-between gap-3 text-xs text-stone-500 pt-1">
                  <dt>Margen bruto estimado</dt>
                  <dd>{formatoCordobas(subtotal - descuento - costoEstimado)}</dd>
                </div>
              )
            }
          />

          <ErrorFormulario mensaje={errorGeneral} />

          <button type="submit" disabled={enviando || validas.length === 0} className={`${claseBotonPrimario} w-full`}>
            {enviando ? 'Registrando...' : 'Registrar venta'}
          </button>
        </aside>
      </form>

      <Modal abierto={nuevoCliente} titulo="Registrar cliente" descripcion="Los campos marcados con * son obligatorios." onCerrar={() => setNuevoCliente(false)}>
        {nuevoCliente && (
          <ClienteFormulario
            onCancelar={() => setNuevoCliente(false)}
            onGuardado={(_, id) => {
              setNuevoCliente(false)
              if (id) setClienteId(id)
            }}
          />
        )}
      </Modal>
    </>
  )
}
