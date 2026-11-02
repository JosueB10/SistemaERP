'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, formatoCordobas, validarNumero } from '@/lib/inventario/utilidades'
import { guardarSubensamble } from '@/lib/produccion/store'
import type { LineaReceta, Subensamble } from '@/lib/produccion/tipos'
import { redondear3 } from '@/lib/produccion/utilidades'
import { Campo, claseBotonSecundario, claseCabeceraTabla, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

type Linea = { clave: number; materiaPrimaId: string; cantidad: string }

let siguienteClave = 0
const nuevaLinea = (materiaPrimaId = '', cantidad = ''): Linea => ({ clave: siguienteClave++, materiaPrimaId, cantidad })

export default function SubensambleFormulario({
  subensamble,
  codigoSugerido,
  onCancelar,
  onGuardado
}: {
  subensamble?: Subensamble
  codigoSugerido: string
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { materiasPrimas } = useInventario()
  const [codigo, setCodigo] = useState(subensamble?.codigo ?? codigoSugerido)
  const [nombre, setNombre] = useState(subensamble?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(subensamble?.descripcion ?? '')
  const [lineas, setLineas] = useState<Linea[]>(() =>
    subensamble?.lineas.length ? subensamble.lineas.map((l) => nuevaLinea(l.materiaPrimaId, String(l.cantidad))) : [nuevaLinea()]
  )
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const porId = new Map(materiasPrimas.map((m) => [m.id, m]))
  const costoLinea = (l: Linea) => {
    const cantidad = Number(l.cantidad)
    return Number.isFinite(cantidad) && cantidad > 0 ? cantidad * (porId.get(l.materiaPrimaId)?.costoUnitario ?? 0) : 0
  }
  const costoTotal = lineas.reduce((t, l) => t + costoLinea(l), 0)

  const cambiarLinea = (clave: number, campo: 'materiaPrimaId' | 'cantidad', valor: string) => {
    setLineas((actual) => actual.map((l) => (l.clave === clave ? { ...l, [campo]: valor } : l)))
    setErrores((actual) => ({ ...actual, [clave]: '' }))
    setErrorGeneral(null)
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Record<number, string> = {}
    const vistas = new Set<string>()
    const definitivas: LineaReceta[] = []
    for (const linea of lineas.filter((l) => l.materiaPrimaId || l.cantidad.trim())) {
      if (!linea.materiaPrimaId) { nuevosErrores[linea.clave] = 'Seleccione la materia prima.'; continue }
      if (vistas.has(linea.materiaPrimaId)) { nuevosErrores[linea.clave] = 'Esta materia prima ya está en el subensamble.'; continue }
      vistas.add(linea.materiaPrimaId)
      const cantidad = validarNumero(linea.cantidad, { etiqueta: 'La cantidad', mayorQueCero: true, decimales: 3 })
      if (cantidad.error) { nuevosErrores[linea.clave] = cantidad.error; continue }
      definitivas.push({ materiaPrimaId: linea.materiaPrimaId, cantidad: redondear3(cantidad.valor!) })
    }
    setErrores(nuevosErrores)
    if (!codigo.trim() || !nombre.trim()) { setErrorGeneral('El código y el nombre son obligatorios.'); return }
    if (Object.keys(nuevosErrores).length > 0) return
    if (definitivas.length === 0) { setErrorGeneral('Agregue al menos una materia prima.'); return }

    setEnviando(true)
    const resultado = await guardarSubensamble({ codigo, nombre, descripcion, lineas: definitivas }, subensamble?.id)
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(subensamble ? 'Subensamble actualizado' : 'Subensamble registrado')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo etiqueta="Código" htmlFor="se-codigo" requerido>
          <input id="se-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className={claseInput} />
        </Campo>
        <Campo etiqueta="Nombre" htmlFor="se-nombre" requerido className="sm:col-span-2">
          <input id="se-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Base de caucho planchada" className={claseInput} />
        </Campo>
      </div>

      <Campo etiqueta="Descripción" htmlFor="se-descripcion" ayuda="Opcional: en qué paso de la ruta se fabrica, medidas...">
        <textarea id="se-descripcion" rows={2} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={`${claseInput} h-auto py-2 resize-none`} />
      </Campo>

      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <p className="text-xs font-medium text-zinc-700">Materia prima por unidad de subensamble (nivel 2)</p>
            <p className="text-xs text-zinc-400">Se descuenta al cerrar la orden del producto que lo usa.</p>
          </div>
          <button type="button" onClick={() => setLineas((a) => [...a, nuevaLinea()])} className={`${claseBotonSecundario} h-9 shrink-0`}>
            <Plus size={15} />
            Agregar
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full min-w-[520px]">
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
                      <select value={linea.materiaPrimaId} onChange={(e) => cambiarLinea(linea.clave, 'materiaPrimaId', e.target.value)} className={claseInput} aria-label="Materia prima">
                        <option value="">Seleccione...</option>
                        {materiasPrimas.map((m) => <option key={m.id} value={m.id}>{m.codigo} — {m.nombre}</option>)}
                      </select>
                      {errores[linea.clave] && <p className="text-xs text-red-600 mt-1">{errores[linea.clave]}</p>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="relative">
                        <input type="number" min="0" step="0.001" inputMode="decimal" value={linea.cantidad} onChange={(e) => cambiarLinea(linea.clave, 'cantidad', e.target.value)} className={`${claseInput} pr-12`} aria-label="Cantidad" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400">{materia ? ABREVIATURAS_UNIDAD[materia.unidad] : ''}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-zinc-600 leading-10">{formatoCordobas(costoLinea(linea))}</td>
                    <td className="px-1 py-2">
                      <button type="button" onClick={() => setLineas((a) => a.filter((l) => l.clave !== linea.clave))} className="h-10 w-9 inline-flex items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar materia prima">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-zinc-50">
              <tr>
                <td colSpan={2} className="px-3 py-2.5 text-right text-sm font-medium text-zinc-700">Costo por unidad de subensamble</td>
                <td className="px-3 py-2.5 text-right text-sm font-semibold text-zinc-900">{formatoCordobas(costoTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <PieFormulario onCancelar={onCancelar} textoGuardar={subensamble ? 'Guardar cambios' : 'Registrar subensamble'} enviando={enviando} />
    </form>
  )
}
