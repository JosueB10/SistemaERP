'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import type { Producto } from '@/lib/inventario/tipos'
import { ABREVIATURAS_UNIDAD, formatoCordobas, validarNumero } from '@/lib/inventario/utilidades'
import { aplicarCostoProducto, guardarReceta, useProduccion } from '@/lib/produccion/store'
import { recetaDeProducto, redondear3 } from '@/lib/produccion/utilidades'
import {
  Campo,
  claseBotonSecundario,
  claseCabeceraTabla,
  claseInput,
  ErrorFormulario,
  PieFormulario
} from '../inventario/ui'

type Linea = { clave: number; materiaPrimaId: string; cantidad: string }

let siguienteClave = 0
const nuevaLinea = (materiaPrimaId = '', cantidad = ''): Linea => ({ clave: siguienteClave++, materiaPrimaId, cantidad })

export default function RecetaFormulario({
  producto,
  onCancelar,
  onGuardado
}: {
  producto: Producto
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { materiasPrimas } = useInventario()
  const { recetas } = useProduccion()
  const receta = recetaDeProducto(recetas, producto.id)

  const [nombre, setNombre] = useState(receta?.nombre ?? `Receta ${producto.nombre}`)
  const [notas, setNotas] = useState(receta?.notas ?? '')
  const [lineas, setLineas] = useState<Linea[]>(() =>
    receta && receta.lineas.length > 0
      ? receta.lineas.map((l) => nuevaLinea(l.materiaPrimaId, String(l.cantidad)))
      : [nuevaLinea()]
  )
  const [actualizarCosto, setActualizarCosto] = useState(true)
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const porId = new Map(materiasPrimas.map((m) => [m.id, m]))

  const cambiarLinea = (clave: number, campo: 'materiaPrimaId' | 'cantidad', valor: string) => {
    setLineas((actual) => actual.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)))
    setErrores((actual) => ({ ...actual, [clave]: '' }))
    setErrorGeneral(null)
  }

  const quitarLinea = (clave: number) => setLineas((actual) => actual.filter((l) => l.clave !== clave))

  const costoLinea = (linea: Linea) => {
    const materia = porId.get(linea.materiaPrimaId)
    const cantidad = Number(linea.cantidad)
    return materia && Number.isFinite(cantidad) && cantidad > 0 ? cantidad * materia.costoUnitario : 0
  }
  const costoTotal = lineas.reduce((total, linea) => total + costoLinea(linea), 0)

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    // Las filas completamente vacías se ignoran
    const usadas = lineas.filter((l) => l.materiaPrimaId || l.cantidad.trim())
    const nuevosErrores: Record<number, string> = {}
    const vistas = new Set<string>()
    const definitivas: { materiaPrimaId: string; cantidad: number }[] = []

    for (const linea of usadas) {
      if (!linea.materiaPrimaId) { nuevosErrores[linea.clave] = 'Seleccione la materia prima.'; continue }
      if (vistas.has(linea.materiaPrimaId)) { nuevosErrores[linea.clave] = 'Esta materia prima ya está en la receta.'; continue }
      vistas.add(linea.materiaPrimaId)
      const cantidad = validarNumero(linea.cantidad, { etiqueta: 'La cantidad', mayorQueCero: true, decimales: 3 })
      if (cantidad.error) { nuevosErrores[linea.clave] = cantidad.error; continue }
      definitivas.push({ materiaPrimaId: linea.materiaPrimaId, cantidad: redondear3(cantidad.valor!) })
    }

    setErrores(nuevosErrores)
    if (!nombre.trim()) { setErrorGeneral('El nombre de la receta es obligatorio.'); return }
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await guardarReceta({ productoId: producto.id, nombre, notas, lineas: definitivas })
    if (resultado.ok && actualizarCosto && definitivas.length > 0) {
      const costo = await aplicarCostoProducto(producto.id, costoTotal)
      if (!costo.ok) { setEnviando(false); setErrorGeneral(`La receta se guardó, pero no se pudo actualizar el costo: ${costo.error}`); return }
    }
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(definitivas.length ? 'Receta guardada' : 'Receta guardada sin materia prima')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre de la receta" htmlFor="receta-nombre" requerido>
          <input id="receta-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Producto" htmlFor="receta-producto">
          <input id="receta-producto" value={`${producto.sku} — ${producto.nombre}`} disabled className={claseInput} />
        </Campo>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-medium text-zinc-700">Materia prima por unidad</p>
            <p className="text-xs text-zinc-400">Cantidad que lleva UN mousepad. Se descuenta al completar una orden o al vender sin stock.</p>
          </div>
          <button type="button" onClick={() => setLineas((actual) => [...actual, nuevaLinea()])} className={`${claseBotonSecundario} h-9 shrink-0`}>
            <Plus size={15} />
            Agregar
          </button>
        </div>

        {materiasPrimas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
            Primero registre materias primas en Inventario.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full min-w-[560px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>Materia prima</th>
                  <th className={`${claseCabeceraTabla} w-40`}>Cantidad</th>
                  <th className={`${claseCabeceraTabla} text-right w-28`}>Costo</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lineas.map((linea) => {
                  const materia = porId.get(linea.materiaPrimaId)
                  return (
                    <tr key={linea.clave} className="align-top">
                      <td className="px-3 py-2">
                        <select
                          value={linea.materiaPrimaId}
                          onChange={(e) => cambiarLinea(linea.clave, 'materiaPrimaId', e.target.value)}
                          className={claseInput}
                          aria-label="Materia prima"
                        >
                          <option value="">Seleccione...</option>
                          {materiasPrimas.map((m) => (
                            <option key={m.id} value={m.id}>{m.codigo} — {m.nombre}</option>
                          ))}
                        </select>
                        {errores[linea.clave] && <p className="text-xs text-red-600 mt-1">{errores[linea.clave]}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            inputMode="decimal"
                            value={linea.cantidad}
                            onChange={(e) => cambiarLinea(linea.clave, 'cantidad', e.target.value)}
                            className={`${claseInput} pr-12`}
                            aria-label="Cantidad por unidad"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                            {materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-zinc-600 leading-10">{formatoCordobas(costoLinea(linea))}</td>
                      <td className="px-1 py-2">
                        <button
                          type="button"
                          onClick={() => quitarLinea(linea.clave)}
                          className="h-10 w-9 inline-flex items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Quitar materia prima"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-zinc-50">
                <tr>
                  <td colSpan={2} className="px-3 py-2.5 text-right text-sm font-medium text-zinc-700">Costo de materia prima por unidad</td>
                  <td className="px-3 py-2.5 text-right text-sm font-semibold text-zinc-900">{formatoCordobas(costoTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <input type="checkbox" checked={actualizarCosto} onChange={(e) => setActualizarCosto(e.target.checked)} className="mt-0.5 h-4 w-4 accent-zinc-900" />
        <span>
          Usar {formatoCordobas(costoTotal)} como costo de producción del producto
          <span className="block text-xs text-zinc-400">Costo registrado actualmente: {formatoCordobas(producto.costoProduccion)}</span>
        </span>
      </label>

      <Campo etiqueta="Notas" htmlFor="receta-notas" ayuda="Opcional: proceso, medidas, proveedor sugerido...">
        <textarea id="receta-notas" rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} className={`${claseInput} h-auto py-2 resize-none`} />
      </Campo>

      <PieFormulario onCancelar={onCancelar} textoGuardar="Guardar receta" enviando={enviando} />
    </form>
  )
}
