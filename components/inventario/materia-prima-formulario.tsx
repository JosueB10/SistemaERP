'use client'

import { useState } from 'react'

import { guardarMateriaPrima, useInventario } from '@/lib/inventario/store'
import type { MateriaPrima, UnidadMedida } from '@/lib/inventario/tipos'
import {
  categoriasUnicas,
  ETIQUETAS_UNIDAD,
  validarNumero
} from '@/lib/inventario/utilidades'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from './ui'

type Errores = Partial<Record<'codigo' | 'nombre' | 'categoria' | 'existencias' | 'stockMinimo' | 'costoUnitario', string>>

export default function MateriaPrimaFormulario({
  materia,
  onCancelar,
  onGuardado
}: {
  materia?: MateriaPrima
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { materiasPrimas } = useInventario()
  const esEdicion = Boolean(materia)

  const [valores, setValores] = useState({
    codigo: materia?.codigo ?? '',
    nombre: materia?.nombre ?? '',
    categoria: materia?.categoria ?? '',
    unidad: materia?.unidad ?? ('unidad' as UnidadMedida),
    existencias: materia ? String(materia.existencias) : '0',
    stockMinimo: materia ? String(materia.stockMinimo) : '',
    costoUnitario: materia ? String(materia.costoUnitario) : ''
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const cambiar = (campo: keyof typeof valores, valor: string) => {
    setValores((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo]: undefined }))
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Errores = {}

    if (!valores.codigo.trim()) nuevosErrores.codigo = 'El código es obligatorio.'
    else if (valores.codigo.trim().length > 20) nuevosErrores.codigo = 'Máximo 20 caracteres.'
    if (!valores.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio.'
    if (!valores.categoria.trim()) nuevosErrores.categoria = 'La categoría es obligatoria.'

    const existencias = validarNumero(valores.existencias, { etiqueta: 'Las existencias' })
    const stockMinimo = validarNumero(valores.stockMinimo, { etiqueta: 'El stock mínimo' })
    const costoUnitario = validarNumero(valores.costoUnitario, { etiqueta: 'El costo unitario', decimales: 4 })

    if (existencias.error) nuevosErrores.existencias = existencias.error
    if (stockMinimo.error) nuevosErrores.stockMinimo = stockMinimo.error
    if (costoUnitario.error) nuevosErrores.costoUnitario = costoUnitario.error

    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    const resultado = await guardarMateriaPrima(
      {
        codigo: valores.codigo,
        nombre: valores.nombre.trim(),
        categoria: valores.categoria.trim(),
        unidad: valores.unidad,
        existencias: existencias.valor!,
        stockMinimo: stockMinimo.valor!,
        costoUnitario: costoUnitario.valor!
      },
      materia?.id
    )

    if (!resultado.ok) {
      setErrorGeneral(resultado.error)
      return
    }
    onGuardado(esEdicion ? 'Materia prima actualizada' : 'Materia prima registrada')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Código" htmlFor="materia-codigo" error={errores.codigo} requerido>
          <input
            id="materia-codigo"
            value={valores.codigo}
            onChange={(e) => cambiar('codigo', e.target.value.toUpperCase())}
            placeholder="MP-000"
            className={claseInput}
          />
        </Campo>

        <Campo etiqueta="Unidad de medida" htmlFor="materia-unidad" requerido>
          <select
            id="materia-unidad"
            value={valores.unidad}
            onChange={(e) => cambiar('unidad', e.target.value)}
            className={claseInput}
          >
            {(Object.keys(ETIQUETAS_UNIDAD) as UnidadMedida[]).map((unidad) => (
              <option key={unidad} value={unidad}>
                {ETIQUETAS_UNIDAD[unidad]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Nombre del material"
          htmlFor="materia-nombre"
          error={errores.nombre}
          requerido
          className="sm:col-span-2"
        >
          <input
            id="materia-nombre"
            value={valores.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            className={claseInput}
          />
        </Campo>

        <Campo
          etiqueta="Categoría"
          htmlFor="materia-categoria"
          error={errores.categoria}
          ayuda="Elija una existente o escriba una nueva."
          requerido
          className="sm:col-span-2"
        >
          <input
            id="materia-categoria"
            list="categorias-materia"
            value={valores.categoria}
            onChange={(e) => cambiar('categoria', e.target.value)}
            className={claseInput}
          />
          <datalist id="categorias-materia">
            {categoriasUnicas(materiasPrimas).map((categoria) => (
              <option key={categoria} value={categoria} />
            ))}
          </datalist>
        </Campo>

        <Campo
          etiqueta={esEdicion ? 'Existencias actuales' : 'Existencias iniciales'}
          htmlFor="materia-existencias"
          error={errores.existencias}
          ayuda={
            esEdicion
              ? 'Para modificar existencias registre un movimiento de inventario.'
              : 'Si es mayor que cero se registra como entrada inicial.'
          }
          requerido
        >
          <input
            id="materia-existencias"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valores.existencias}
            onChange={(e) => cambiar('existencias', e.target.value)}
            disabled={esEdicion}
            className={claseInput}
          />
        </Campo>

        <Campo etiqueta="Stock mínimo" htmlFor="materia-minimo" error={errores.stockMinimo} requerido>
          <input
            id="materia-minimo"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valores.stockMinimo}
            onChange={(e) => cambiar('stockMinimo', e.target.value)}
            className={claseInput}
          />
        </Campo>

        <Campo
          etiqueta="Costo unitario (C$)"
          htmlFor="materia-costo"
          error={errores.costoUnitario}
          ayuda="Costo por unidad de medida."
          requerido
        >
          <input
            id="materia-costo"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valores.costoUnitario}
            onChange={(e) => cambiar('costoUnitario', e.target.value)}
            className={claseInput}
          />
        </Campo>
      </div>

      <PieFormulario
        onCancelar={onCancelar}
        textoGuardar={esEdicion ? 'Guardar cambios' : 'Registrar materia prima'}
      />
    </form>
  )
}
