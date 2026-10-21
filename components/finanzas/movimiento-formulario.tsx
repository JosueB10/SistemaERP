'use client'

import { useState } from 'react'

import { guardarMovimientoFinanciero } from '@/lib/finanzas/store'
import type { MovimientoFinanciero, TipoFinanciero } from '@/lib/finanzas/tipos'
import { fechaHoy, validarNumero } from '@/lib/inventario/utilidades'
import type { MetodoPago } from '@/lib/ventas/tipos'
import { ETIQUETAS_METODO_PAGO } from '@/lib/ventas/utilidades'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

type Errores = Partial<Record<'concepto' | 'categoria' | 'monto', string>>

export default function MovimientoFormulario({
  tipo,
  movimiento,
  sugerencias,
  onCancelar,
  onGuardado
}: {
  tipo: TipoFinanciero
  movimiento?: MovimientoFinanciero
  sugerencias: string[]
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const [valores, setValores] = useState({
    concepto: movimiento?.concepto ?? '',
    categoria: movimiento?.categoria ?? '',
    monto: movimiento ? String(movimiento.monto) : '',
    fecha: movimiento?.fecha ?? fechaHoy(),
    metodoPago: movimiento?.metodoPago ?? ('efectivo' as MetodoPago),
    observaciones: movimiento?.observaciones ?? ''
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const nombre = tipo === 'ingreso' ? 'ingreso' : 'gasto'

  const cambiar = (campo: keyof typeof valores, valor: string) => {
    setValores((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo]: undefined }))
    setErrorGeneral(null)
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Errores = {}
    if (!valores.concepto.trim()) nuevosErrores.concepto = 'El concepto es obligatorio.'
    if (!valores.categoria.trim()) nuevosErrores.categoria = 'La categoría es obligatoria.'
    const monto = validarNumero(valores.monto, { etiqueta: 'El monto', mayorQueCero: true })
    if (monto.error) nuevosErrores.monto = monto.error
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await guardarMovimientoFinanciero(
      tipo,
      { ...valores, monto: monto.valor!, metodoPago: valores.metodoPago as MetodoPago },
      movimiento?.id
    )
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(movimiento ? `${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} actualizado` : `${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado`)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Concepto" htmlFor="fin-concepto" error={errores.concepto} requerido className="sm:col-span-2">
          <input
            id="fin-concepto"
            value={valores.concepto}
            onChange={(e) => cambiar('concepto', e.target.value)}
            maxLength={200}
            placeholder={tipo === 'ingreso' ? 'Ej.: Diseño de logo para cliente' : 'Ej.: Alquiler del taller de octubre'}
            className={claseInput}
          />
        </Campo>
        <Campo etiqueta="Categoría" htmlFor="fin-categoria" error={errores.categoria} requerido>
          <input id="fin-categoria" list="fin-categorias" value={valores.categoria} onChange={(e) => cambiar('categoria', e.target.value)} maxLength={100} className={claseInput} />
          <datalist id="fin-categorias">
            {sugerencias.map((categoria) => <option key={categoria} value={categoria} />)}
          </datalist>
        </Campo>
        <Campo etiqueta="Monto (C$)" htmlFor="fin-monto" error={errores.monto} requerido>
          <input id="fin-monto" type="number" min="0" step="0.01" inputMode="decimal" value={valores.monto} onChange={(e) => cambiar('monto', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Fecha" htmlFor="fin-fecha" requerido>
          <input id="fin-fecha" type="date" value={valores.fecha} onChange={(e) => cambiar('fecha', e.target.value || fechaHoy())} className={claseInput} />
        </Campo>
        <Campo etiqueta="Método de pago" htmlFor="fin-metodo" requerido>
          <select id="fin-metodo" value={valores.metodoPago} onChange={(e) => cambiar('metodoPago', e.target.value)} className={claseInput}>
            {(Object.keys(ETIQUETAS_METODO_PAGO) as MetodoPago[]).map((m) => <option key={m} value={m}>{ETIQUETAS_METODO_PAGO[m]}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Observaciones" htmlFor="fin-observaciones" className="sm:col-span-2">
          <textarea id="fin-observaciones" rows={2} value={valores.observaciones} onChange={(e) => cambiar('observaciones', e.target.value)} placeholder="N.º de recibo, referencia bancaria..." className={`${claseInput} h-auto py-2 resize-none`} />
        </Campo>
      </div>

      <PieFormulario onCancelar={onCancelar} textoGuardar={movimiento ? 'Guardar cambios' : `Registrar ${nombre}`} enviando={enviando} />
    </form>
  )
}
