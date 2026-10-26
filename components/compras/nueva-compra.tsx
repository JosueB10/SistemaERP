'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, Plus, Trash2, UserPlus } from 'lucide-react'

import { registrarCompra, useCompras } from '@/lib/compras/store'
import type { ActualizacionCosto } from '@/lib/compras/tipos'
import { codigoCompra, ETIQUETAS_ACTUALIZACION_COSTO, nuevoCostoMateria } from '@/lib/compras/utilidades'
import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, fechaHoy, formatoCantidad, formatoCordobas, tieneStockBajo, validarNumero } from '@/lib/inventario/utilidades'
import { redondear3 } from '@/lib/produccion/utilidades'
import type { MetodoPago } from '@/lib/ventas/tipos'
import { calcularTotales, ETIQUETAS_METODO_PAGO, redondear2 } from '@/lib/ventas/utilidades'
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
import { ResumenTotales } from '../ventas/ui'
import ProveedorFormulario from './proveedor-formulario'
import { AvisoConexionCompras, SECCION_COMPRAS } from './ui'

type Linea = { clave: number; materiaPrimaId: string; cantidad: string; costo: string }

let siguienteClave = 0
const nuevaLinea = (): Linea => ({ clave: siguienteClave++, materiaPrimaId: '', cantidad: '', costo: '' })

export default function NuevaCompra() {
  const { materiasPrimas } = useInventario()
  const { proveedores } = useCompras()
  const searchParams = useSearchParams()

  const [proveedorId, setProveedorId] = useState(searchParams.get('proveedor') ?? '')
  const [fecha, setFecha] = useState(fechaHoy())
  const [numeroFactura, setNumeroFactura] = useState('')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('efectivo')
  const [actualizarCosto, setActualizarCosto] = useState<ActualizacionCosto>('promedio')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<Linea[]>(() => [nuevaLinea()])
  const [descuentoTexto, setDescuentoTexto] = useState('')
  const [aplicaIva, setAplicaIva] = useState(false)
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [errorProveedor, setErrorProveedor] = useState<string | undefined>()
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [registrada, setRegistrada] = useState<{ id: string; total: number } | null>(null)
  const [nuevoProveedor, setNuevoProveedor] = useState(false)

  const materiaPorId = new Map(materiasPrimas.map((m) => [m.id, m]))
  const proveedoresActivos = proveedores.filter((p) => p.activo || p.id === proveedorId)

  const subtotal = lineas.reduce((total, l) => {
    const cantidad = Number(l.cantidad)
    const costo = Number(l.costo)
    return l.materiaPrimaId && cantidad > 0 && costo >= 0 ? total + redondear2(redondear3(cantidad) * redondear2(costo)) : total
  }, 0)
  const descuento = Number(descuentoTexto) > 0 ? redondear2(Number(descuentoTexto)) : 0
  const totales = calcularTotales(subtotal, descuento, aplicaIva)

  const cambiarLinea = (clave: number, campo: 'materiaPrimaId' | 'cantidad' | 'costo', valor: string) => {
    setLineas((actual) =>
      actual.map((l) => {
        if (l.clave !== clave) return l
        // Al elegir la materia prima se propone su costo actual
        if (campo === 'materiaPrimaId') return { ...l, materiaPrimaId: valor, costo: valor ? String(materiaPorId.get(valor)?.costoUnitario ?? '') : '' }
        return { ...l, [campo]: valor }
      })
    )
    setErrores((actual) => ({ ...actual, [clave]: '' }))
    setErrorGeneral(null)
  }

  // Agrega de una vez todas las materias primas en stock bajo que aún no están en la compra
  const agregarStockBajo = () => {
    const presentes = new Set(lineas.map((l) => l.materiaPrimaId))
    const nuevas = materiasPrimas
      .filter((m) => tieneStockBajo(m) && !presentes.has(m.id))
      .map((m) => ({
        ...nuevaLinea(),
        materiaPrimaId: m.id,
        cantidad: String(redondear3(Math.max(m.stockMinimo * 2 - m.existencias, 1))),
        costo: String(m.costoUnitario)
      }))
    setLineas((actual) => [...actual.filter((l) => l.materiaPrimaId || l.cantidad || l.costo), ...nuevas])
  }
  const stockBajoPendiente = materiasPrimas.some((m) => tieneStockBajo(m) && !lineas.some((l) => l.materiaPrimaId === m.id))

  const reiniciar = () => {
    setProveedorId('')
    setFecha(fechaHoy())
    setNumeroFactura('')
    setMetodoPago('efectivo')
    setActualizarCosto('promedio')
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
    setErrorProveedor(proveedorId ? undefined : 'Seleccione el proveedor.')
    const usadas = lineas.filter((l) => l.materiaPrimaId || l.cantidad.trim())
    const nuevosErrores: Record<number, string> = {}
    const vistas = new Set<string>()
    const definitivas: { materiaPrimaId: string; cantidad: number; costoUnitario: number }[] = []

    for (const linea of usadas) {
      if (!linea.materiaPrimaId) { nuevosErrores[linea.clave] = 'Seleccione la materia prima.'; continue }
      if (vistas.has(linea.materiaPrimaId)) { nuevosErrores[linea.clave] = 'Esta materia prima ya está en la compra; sume la cantidad en una sola línea.'; continue }
      vistas.add(linea.materiaPrimaId)
      const cantidad = validarNumero(linea.cantidad, { etiqueta: 'La cantidad', mayorQueCero: true, decimales: 3 })
      if (cantidad.error) { nuevosErrores[linea.clave] = cantidad.error; continue }
      const costo = validarNumero(linea.costo, { etiqueta: 'El costo unitario' })
      if (costo.error) { nuevosErrores[linea.clave] = costo.error; continue }
      definitivas.push({ materiaPrimaId: linea.materiaPrimaId, cantidad: cantidad.valor!, costoUnitario: costo.valor! })
    }
    setErrores(nuevosErrores)
    if (!proveedorId || Object.keys(nuevosErrores).length > 0) return
    if (definitivas.length === 0) { setErrorGeneral('Agregue al menos una materia prima a la compra.'); return }

    let descuentoValido = 0
    if (descuentoTexto.trim()) {
      const resultado = validarNumero(descuentoTexto, { etiqueta: 'El descuento' })
      if (resultado.error) { setErrorGeneral(resultado.error); return }
      descuentoValido = resultado.valor!
    }
    if (descuentoValido > subtotal) { setErrorGeneral('El descuento no puede ser mayor que el subtotal.'); return }

    setEnviando(true)
    const resultado = await registrarCompra({
      proveedorId,
      fecha,
      numeroFactura,
      metodoPago,
      descuento: descuentoValido,
      aplicaIva,
      actualizarCosto,
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
        <EncabezadoPagina titulo="Nueva compra" descripcion="Registre la compra de materia prima a un proveedor." seccion={SECCION_COMPRAS} />
        <div className={`${claseTarjeta} p-8 text-center max-w-lg mx-auto`}>
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={24} className="text-emerald-600" />
          </div>
          <p className="text-lg font-semibold text-zinc-900">Compra {codigoCompra(registrada.id)} registrada</p>
          <p className="text-sm text-zinc-500 mt-1">Total: {formatoCordobas(registrada.total)}. La materia prima ya entró al inventario y se registró el gasto.</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href={`/compras?detalle=${encodeURIComponent(registrada.id)}`} className={claseBotonSecundario}>Ver compra</Link>
            <button type="button" onClick={reiniciar} className={claseBotonPrimario}><Plus size={16} />Nueva compra</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AvisoConexion />
      <AvisoConexionCompras />
      <EncabezadoPagina
        titulo="Nueva compra"
        descripcion="La materia prima recibida entra al inventario y su costo unitario se actualiza."
        seccion={SECCION_COMPRAS}
      />

      <form onSubmit={enviar} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section className={`${claseTarjeta} p-5`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo etiqueta="Proveedor" htmlFor="compra-proveedor" error={errorProveedor} requerido className="sm:col-span-2">
                <div className="flex gap-2">
                  <select id="compra-proveedor" value={proveedorId} onChange={(e) => { setProveedorId(e.target.value); setErrorProveedor(undefined) }} className={claseInput}>
                    <option value="">Seleccione...</option>
                    {proveedoresActivos.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.ruc ? ` — RUC ${p.ruc}` : ''}</option>)}
                  </select>
                  <button type="button" onClick={() => setNuevoProveedor(true)} className={`${claseBotonSecundario} px-3 shrink-0`} aria-label="Registrar proveedor" title="Registrar proveedor">
                    <UserPlus size={16} />
                  </button>
                </div>
              </Campo>
              <Campo etiqueta="Fecha de compra" htmlFor="compra-fecha" requerido>
                <input id="compra-fecha" type="date" value={fecha} max={fechaHoy()} onChange={(e) => setFecha(e.target.value || fechaHoy())} className={claseInput} />
              </Campo>
              <Campo etiqueta="N.º de factura del proveedor" htmlFor="compra-factura">
                <input id="compra-factura" value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} maxLength={50} className={claseInput} />
              </Campo>
              <Campo etiqueta="Método de pago" htmlFor="compra-pago" requerido>
                <select id="compra-pago" value={metodoPago} onChange={(e) => setMetodoPago(e.target.value as MetodoPago)} className={claseInput}>
                  {(Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]).map((m) => <option key={m} value={m}>{ETIQUETAS_METODO_PAGO[m]}</option>)}
                </select>
              </Campo>
              <Campo etiqueta="Costo de la materia prima" htmlFor="compra-costo" ayuda="Cómo se actualiza el costo unitario en Inventario.">
                <select id="compra-costo" value={actualizarCosto} onChange={(e) => setActualizarCosto(e.target.value as ActualizacionCosto)} className={claseInput}>
                  {(Object.keys(ETIQUETAS_ACTUALIZACION_COSTO) as ActualizacionCosto[]).map((m) => <option key={m} value={m}>{ETIQUETAS_ACTUALIZACION_COSTO[m]}</option>)}
                </select>
              </Campo>
            </div>
          </section>

          <section className={claseTarjeta}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <h2 className="font-semibold text-zinc-900">Materia prima</h2>
              <div className="flex flex-wrap gap-2">
                {stockBajoPendiente && (
                  <button type="button" onClick={agregarStockBajo} className={`${claseBotonSecundario} h-9`}>
                    Agregar stock bajo
                  </button>
                )}
                <button type="button" onClick={() => setLineas((actual) => [...actual, nuevaLinea()])} className={`${claseBotonSecundario} h-9`}>
                  <Plus size={15} />
                  Agregar línea
                </button>
              </div>
            </div>

            {materiasPrimas.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-zinc-500">Primero registre materias primas en Inventario.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-zinc-50/70">
                    <tr>
                      <th className={claseCabeceraTabla}>Materia prima</th>
                      <th className={`${claseCabeceraTabla} w-32`}>Cantidad</th>
                      <th className={`${claseCabeceraTabla} w-36`}>Costo unit. (C$)</th>
                      <th className={`${claseCabeceraTabla} text-right w-32`}>Subtotal</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {lineas.map((linea) => {
                      const materia = materiaPorId.get(linea.materiaPrimaId)
                      const cantidad = Number(linea.cantidad)
                      const costo = Number(linea.costo)
                      const valida = materia && cantidad > 0 && Number.isFinite(costo) && costo >= 0
                      const costoNuevo = valida ? nuevoCostoMateria(actualizarCosto, materia.existencias, materia.costoUnitario, cantidad, costo) : null
                      const usadas = new Set(lineas.filter((l) => l.clave !== linea.clave).map((l) => l.materiaPrimaId))
                      return (
                        <tr key={linea.clave} className="align-top">
                          <td className="px-3 py-2">
                            <select value={linea.materiaPrimaId} onChange={(e) => cambiarLinea(linea.clave, 'materiaPrimaId', e.target.value)} className={claseInput} aria-label="Materia prima">
                              <option value="">Seleccione...</option>
                              {materiasPrimas.map((m) => (
                                <option key={m.id} value={m.id} disabled={usadas.has(m.id)}>
                                  {m.codigo} — {m.nombre} ({formatoCantidad(m.existencias)} {ABREVIATURAS_UNIDAD[m.unidad]})
                                </option>
                              ))}
                            </select>
                            {errores[linea.clave] ? (
                              <p className="text-xs text-red-600 mt-1">{errores[linea.clave]}</p>
                            ) : materia ? (
                              <p className="text-xs text-zinc-400 mt-1">
                                Stock {formatoCantidad(materia.existencias)} → {formatoCantidad(redondear3(materia.existencias + (cantidad > 0 ? cantidad : 0)))} {ABREVIATURAS_UNIDAD[materia.unidad]}
                                {' · '}costo {formatoCordobas(materia.costoUnitario)}
                                {costoNuevo !== null && costoNuevo !== materia.costoUnitario && <> → <span className="text-zinc-600">{formatoCordobas(costoNuevo)}</span></>}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.001" inputMode="decimal" value={linea.cantidad} onChange={(e) => cambiarLinea(linea.clave, 'cantidad', e.target.value)} placeholder={materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''} className={claseInput} aria-label="Cantidad" />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="0.01" inputMode="decimal" value={linea.costo} onChange={(e) => cambiarLinea(linea.clave, 'costo', e.target.value)} className={claseInput} aria-label="Costo unitario" />
                          </td>
                          <td className="px-3 py-2 text-right text-sm font-medium text-zinc-900 leading-10 whitespace-nowrap">
                            {formatoCordobas(valida ? cantidad * costo : 0)}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => setLineas((actual) => (actual.length > 1 ? actual.filter((l) => l.clave !== linea.clave) : [nuevaLinea()]))}
                              className="h-10 w-8 flex items-center justify-center text-zinc-400 hover:text-red-600"
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

          <Campo etiqueta="Observaciones" htmlFor="compra-observaciones">
            <textarea id="compra-observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Condiciones, lote, fecha de entrega..." className={`${claseInput} h-auto py-2 resize-none`} />
          </Campo>
        </div>

        <aside className={`${claseTarjeta} p-5 space-y-5 self-start xl:sticky xl:top-6`}>
          <h2 className="font-semibold text-zinc-900">Resumen</h2>

          <Campo etiqueta="Descuento (C$)" htmlFor="compra-descuento">
            <input id="compra-descuento" type="number" min="0" step="0.01" inputMode="decimal" value={descuentoTexto} onChange={(e) => { setDescuentoTexto(e.target.value); setErrorGeneral(null) }} placeholder="0.00" className={claseInput} />
          </Campo>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={aplicaIva} onChange={(e) => setAplicaIva(e.target.checked)} className="h-4 w-4 rounded border-zinc-300" />
            La factura incluye IVA (15 %)
          </label>

          <ResumenTotales {...totales} />

          <ErrorFormulario mensaje={errorGeneral} />

          <button type="submit" disabled={enviando || lineas.every((l) => !l.materiaPrimaId)} className={`${claseBotonPrimario} w-full`}>
            {enviando ? 'Registrando...' : 'Registrar compra'}
          </button>
        </aside>
      </form>

      <Modal abierto={nuevoProveedor} titulo="Registrar proveedor" descripcion="Los campos marcados con * son obligatorios." onCerrar={() => setNuevoProveedor(false)}>
        {nuevoProveedor && (
          <ProveedorFormulario
            onCancelar={() => setNuevoProveedor(false)}
            onGuardado={(_, id) => {
              setNuevoProveedor(false)
              if (id) { setProveedorId(id); setErrorProveedor(undefined) }
            }}
          />
        )}
      </Modal>
    </>
  )
}
