'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { ABREVIATURAS_UNIDAD, fechaHoy, formatoCantidad, formatoCordobas, validarNumero } from '@/lib/inventario/utilidades'
import { completarOrden, useProduccion } from '@/lib/produccion/store'
import type { OrdenProduccion } from '@/lib/produccion/tipos'
import { recetaDeProducto, redondear3 } from '@/lib/produccion/utilidades'
import { Campo, claseCabeceraTabla, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

export default function OrdenCompletar({
  orden,
  onCancelar,
  onGuardado
}: {
  orden: OrdenProduccion
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { productos, materiasPrimas } = useInventario()
  const { recetas } = useProduccion()
  const producto = productos.find((p) => p.id === orden.productoId)
  const receta = recetaDeProducto(recetas, orden.productoId)
  const porId = new Map(materiasPrimas.map((m) => [m.id, m]))

  const [cantidad, setCantidad] = useState(String(orden.cantidadPlanificada))
  const [fechaFin, setFechaFin] = useState(fechaHoy())
  const [observaciones, setObservaciones] = useState('')
  // Materias primas agregadas a mano (además de las de la receta)
  const [extras, setExtras] = useState<string[]>([])
  // Consumo real escrito por el usuario; si no lo cambia se usa el teórico
  const [reales, setReales] = useState<Record<string, string>>({})
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cantidadNumerica = Number(cantidad)
  const unidades = Number.isInteger(cantidadNumerica) && cantidadNumerica > 0 ? cantidadNumerica : 0

  const filas = [
    ...(receta?.lineas ?? []).map((l) => ({ materiaPrimaId: l.materiaPrimaId, teorico: redondear3(l.cantidad * unidades), deReceta: true })),
    ...extras.map((id) => ({ materiaPrimaId: id, teorico: 0, deReceta: false }))
  ].map((fila) => {
    const materia = porId.get(fila.materiaPrimaId)
    const real = reales[fila.materiaPrimaId] ?? String(fila.teorico)
    const realNumero = Number(real)
    return { ...fila, materia, real, costo: materia && Number.isFinite(realNumero) ? realNumero * materia.costoUnitario : 0 }
  })
  const costoTotal = filas.reduce((total, f) => total + f.costo, 0)
  const enUso = new Set(filas.map((f) => f.materiaPrimaId))

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setErrorGeneral(null)
    const cantidadValida = validarNumero(cantidad, { etiqueta: 'La cantidad producida', mayorQueCero: true, entero: true })
    if (cantidadValida.error) { setErrorGeneral(cantidadValida.error); return }
    if (!fechaFin || fechaFin > fechaHoy()) { setErrorGeneral('La fecha de finalización no puede estar vacía ni ser futura.'); return }

    const nuevosErrores: Record<string, string> = {}
    const consumos: { materiaPrimaId: string; cantidadTeorica: number; cantidadReal: number }[] = []
    for (const fila of filas) {
      const real = validarNumero(fila.real, { etiqueta: 'El consumo', decimales: 3 })
      if (real.error) { nuevosErrores[fila.materiaPrimaId] = real.error; continue }
      if (fila.materia && real.valor! > fila.materia.existencias) {
        nuevosErrores[fila.materiaPrimaId] = `Solo hay ${formatoCantidad(fila.materia.existencias)} ${ABREVIATURAS_UNIDAD[fila.materia.unidad]}.`
        continue
      }
      consumos.push({ materiaPrimaId: fila.materiaPrimaId, cantidadTeorica: fila.teorico, cantidadReal: redondear3(real.valor!) })
    }
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await completarOrden(orden.id, { cantidadProducida: cantidadValida.valor!, fechaFin, consumos, observaciones })
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(`Orden completada: +${formatoCantidad(cantidadValida.valor!)} und al inventario`)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Cantidad producida (und)" htmlFor="completar-cantidad" ayuda={`Planificado: ${formatoCantidad(orden.cantidadPlanificada)} und de ${producto?.nombre ?? 'producto'}.`} requerido>
          <input id="completar-cantidad" type="number" min="1" step="1" inputMode="numeric" value={cantidad} onChange={(e) => { setCantidad(e.target.value); setErrorGeneral(null) }} className={claseInput} />
        </Campo>
        <Campo etiqueta="Fecha de finalización" htmlFor="completar-fecha" requerido>
          <input id="completar-fecha" type="date" max={fechaHoy()} value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={claseInput} />
        </Campo>
      </div>

      <div>
        <p className="text-xs font-medium text-stone-700">Materia prima consumida</p>
        <p className="text-xs text-stone-400 mb-2">
          Se calcula con la receta. Ajuste el consumo real si hubo merma o sobrante; esto es lo que se descuenta del inventario.
        </p>
        <div className="overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full min-w-[620px]">
            <thead className="bg-stone-50">
              <tr>
                <th className={claseCabeceraTabla}>Materia prima</th>
                <th className={`${claseCabeceraTabla} text-right`}>Teórico</th>
                <th className={`${claseCabeceraTabla} w-36`}>Consumo real</th>
                <th className={`${claseCabeceraTabla} text-right`}>Disponible</th>
                <th className={`${claseCabeceraTabla} text-right`}>Costo</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-5 text-center text-sm text-stone-400">El producto no tiene receta. Agregue la materia prima usada o complete sin consumo.</td></tr>
              )}
              {filas.map((fila) => {
                const unidad = fila.materia ? ABREVIATURAS_UNIDAD[fila.materia.unidad] : ''
                return (
                  <tr key={fila.materiaPrimaId} className="align-top text-sm">
                    <td className="px-4 py-3 text-stone-800">
                      {fila.materia?.nombre ?? 'Materia prima inactiva'}
                      {!fila.deReceta && <span className="ml-2 text-xs text-stone-400">(agregada)</span>}
                      {errores[fila.materiaPrimaId] && <p className="text-xs text-red-600 mt-1">{errores[fila.materiaPrimaId]}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-500 whitespace-nowrap">{formatoCantidad(fila.teorico)} {unidad}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        inputMode="decimal"
                        value={fila.real}
                        onChange={(e) => {
                          setReales((actual) => ({ ...actual, [fila.materiaPrimaId]: e.target.value }))
                          setErrores((actual) => ({ ...actual, [fila.materiaPrimaId]: '' }))
                        }}
                        className={`${claseInput} h-9`}
                        aria-label={`Consumo real de ${fila.materia?.nombre ?? 'materia prima'}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-right text-stone-500 whitespace-nowrap">{fila.materia ? `${formatoCantidad(fila.materia.existencias)} ${unidad}` : '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatoCordobas(fila.costo)}</td>
                    <td className="px-1 py-2">
                      {!fila.deReceta && (
                        <button type="button" onClick={() => setExtras((actual) => actual.filter((id) => id !== fila.materiaPrimaId))} className="h-9 w-9 inline-flex items-center justify-center rounded-md text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="bg-stone-50">
              <tr>
                <td colSpan={4} className="px-4 py-2.5 text-right text-sm font-medium text-stone-700">
                  Costo de materia prima{unidades > 0 && ` (${formatoCordobas(costoTotal / unidades)} por unidad)`}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-semibold text-stone-900">{formatoCordobas(costoTotal)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <select
          value=""
          onChange={(e) => e.target.value && setExtras((actual) => [...actual, e.target.value])}
          className={`${claseInput} mt-2 sm:w-80`}
          aria-label="Agregar otra materia prima"
        >
          <option value="">+ Agregar otra materia prima usada...</option>
          {materiasPrimas.filter((m) => !enUso.has(m.id)).map((m) => (
            <option key={m.id} value={m.id}>{m.codigo} — {m.nombre}</option>
          ))}
        </select>
      </div>

      <Campo etiqueta="Observaciones" htmlFor="completar-observaciones">
        <textarea id="completar-observaciones" rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Opcional: merma, incidencias..." className={`${claseInput} h-auto py-2 resize-none`} />
      </Campo>

      <PieFormulario onCancelar={onCancelar} textoGuardar="Completar orden" enviando={enviando} />
    </form>
  )
}
