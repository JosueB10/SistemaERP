'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import type { Producto } from '@/lib/inventario/tipos'
import { ABREVIATURAS_UNIDAD, formatoCantidad, formatoCordobas, validarNumero } from '@/lib/inventario/utilidades'
import { aplicarCostoProducto, guardarReceta, useProduccion } from '@/lib/produccion/store'
import type { LineaEstructura } from '@/lib/produccion/tipos'
import { costoSubensamble, explotarEstructura, recetaDeProducto, redondear3 } from '@/lib/produccion/utilidades'
import {
  Campo,
  claseBotonSecundario,
  claseCabeceraTabla,
  claseInput,
  ErrorFormulario,
  PieFormulario
} from '../inventario/ui'

// componente: "mp:<id>" para materia prima o "se:<id>" para subensamble
type Linea = { clave: number; componente: string; cantidad: string }

let siguienteClave = 0
const nuevaLinea = (componente = '', cantidad = ''): Linea => ({ clave: siguienteClave++, componente, cantidad })
const claveComponente = (l: LineaEstructura) => `${l.tipo === 'subensamble' ? 'se' : 'mp'}:${l.componenteId}`
const leerComponente = (valor: string): Pick<LineaEstructura, 'tipo' | 'componenteId'> | null => {
  const [prefijo, id] = valor.split(':')
  if (!id) return null
  return { tipo: prefijo === 'se' ? 'subensamble' : 'materia_prima', componenteId: id }
}

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
  const { recetas, subensambles } = useProduccion()
  const receta = recetaDeProducto(recetas, producto.id)
  const subensamblesActivos = subensambles.filter((s) => s.activo && s.lineas.length > 0)

  const [nombre, setNombre] = useState(receta?.nombre ?? `Receta ${producto.nombre}`)
  const [notas, setNotas] = useState(receta?.notas ?? '')
  const [lineas, setLineas] = useState<Linea[]>(() =>
    receta && receta.estructura.length > 0
      ? receta.estructura.map((l) => nuevaLinea(claveComponente(l), String(l.cantidad)))
      : [nuevaLinea()]
  )
  const [actualizarCosto, setActualizarCosto] = useState(true)
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const materiaPorId = new Map(materiasPrimas.map((m) => [m.id, m]))
  const subPorId = new Map(subensambles.map((s) => [s.id, s]))

  const cambiarLinea = (clave: number, campo: 'componente' | 'cantidad', valor: string) => {
    setLineas((actual) => actual.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)))
    setErrores((actual) => ({ ...actual, [clave]: '' }))
    setErrorGeneral(null)
  }

  const quitarLinea = (clave: number) => setLineas((actual) => actual.filter((l) => l.clave !== clave))

  const costoUnitarioComponente = (valor: string) => {
    const comp = leerComponente(valor)
    if (!comp) return 0
    return comp.tipo === 'subensamble'
      ? costoSubensamble(subPorId.get(comp.componenteId), materiasPrimas)
      : materiaPorId.get(comp.componenteId)?.costoUnitario ?? 0
  }
  const costoLinea = (linea: Linea) => {
    const cantidad = Number(linea.cantidad)
    return Number.isFinite(cantidad) && cantidad > 0 ? cantidad * costoUnitarioComponente(linea.componente) : 0
  }
  const costoTotal = lineas.reduce((total, linea) => total + costoLinea(linea), 0)

  // Vista previa de la explosión (nivel 2): materia prima total por unidad
  const estructuraValida = lineas.flatMap((l) => {
    const comp = leerComponente(l.componente)
    const cantidad = Number(l.cantidad)
    return comp && Number.isFinite(cantidad) && cantidad > 0 ? [{ ...comp, cantidad }] : []
  })
  const explosion = explotarEstructura(estructuraValida, subensambles)
  const tieneSubensambles = estructuraValida.some((l) => l.tipo === 'subensamble')

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    // Las filas completamente vacías se ignoran
    const usadas = lineas.filter((l) => l.componente || l.cantidad.trim())
    const nuevosErrores: Record<number, string> = {}
    const vistas = new Set<string>()
    const definitivas: LineaEstructura[] = []

    for (const linea of usadas) {
      const comp = leerComponente(linea.componente)
      if (!comp) { nuevosErrores[linea.clave] = 'Seleccione el componente.'; continue }
      if (vistas.has(linea.componente)) { nuevosErrores[linea.clave] = 'Este componente ya está en la receta.'; continue }
      vistas.add(linea.componente)
      const cantidad = validarNumero(linea.cantidad, { etiqueta: 'La cantidad', mayorQueCero: true, decimales: 3 })
      if (cantidad.error) { nuevosErrores[linea.clave] = cantidad.error; continue }
      definitivas.push({ ...comp, cantidad: redondear3(cantidad.valor!) })
    }

    setErrores(nuevosErrores)
    if (!nombre.trim()) { setErrorGeneral('El nombre de la receta es obligatorio.'); return }
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await guardarReceta({ productoId: producto.id, nombre, notas, estructura: definitivas })
    if (resultado.ok && actualizarCosto && definitivas.length > 0) {
      const costo = await aplicarCostoProducto(producto.id, costoTotal)
      if (!costo.ok) { setEnviando(false); setErrorGeneral(`La receta se guardó, pero no se pudo actualizar el costo: ${costo.error}`); return }
    }
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(definitivas.length ? 'Receta guardada' : 'Receta guardada sin componentes')
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
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <p className="text-xs font-medium text-zinc-700">Componentes por unidad (nivel 1)</p>
            <p className="text-xs text-zinc-400">
              Subensambles y materia prima directa que lleva UN mousepad. Los subensambles se definen en{' '}
              <Link href="/produccion/subensambles" className="underline">Subensambles</Link>.
            </p>
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
                  <th className={claseCabeceraTabla}>Componente</th>
                  <th className={`${claseCabeceraTabla} w-40`}>Cantidad</th>
                  <th className={`${claseCabeceraTabla} text-right w-28`}>Costo</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {lineas.map((linea) => {
                  const comp = leerComponente(linea.componente)
                  const unidad = comp?.tipo === 'subensamble'
                    ? 'und'
                    : comp ? (materiaPorId.get(comp.componenteId) ? ABREVIATURAS_UNIDAD[materiaPorId.get(comp.componenteId)!.unidad] : '') : ''
                  return (
                    <tr key={linea.clave} className="align-top">
                      <td className="px-3 py-2">
                        <select
                          value={linea.componente}
                          onChange={(e) => cambiarLinea(linea.clave, 'componente', e.target.value)}
                          className={claseInput}
                          aria-label="Componente"
                        >
                          <option value="">Seleccione...</option>
                          {subensamblesActivos.length > 0 && (
                            <optgroup label="Subensambles">
                              {subensamblesActivos.map((s) => (
                                <option key={s.id} value={`se:${s.id}`}>{s.codigo} — {s.nombre}</option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Materia prima">
                            {materiasPrimas.map((m) => (
                              <option key={m.id} value={`mp:${m.id}`}>{m.codigo} — {m.nombre}</option>
                            ))}
                          </optgroup>
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
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{unidad}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-zinc-600 leading-10">{formatoCordobas(costoLinea(linea))}</td>
                      <td className="px-1 py-2">
                        <button
                          type="button"
                          onClick={() => quitarLinea(linea.clave)}
                          className="h-10 w-9 inline-flex items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Quitar componente"
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

      {tieneSubensambles && explosion.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3">
          <p className="text-xs font-medium text-zinc-700 mb-1.5">Explosión de la BOM: materia prima total por unidad (nivel 2)</p>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-xs sm:grid-cols-2">
            {explosion.map((l) => {
              const materia = materiaPorId.get(l.materiaPrimaId)
              return (
                <li key={l.materiaPrimaId} className="flex justify-between gap-3">
                  <span className="text-zinc-600">{materia?.nombre ?? 'Materia prima inactiva'}</span>
                  <span className="font-medium text-zinc-800">{formatoCantidad(l.cantidad)} {materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

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
