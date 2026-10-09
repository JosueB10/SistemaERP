'use client'

import { useState } from 'react'

import { guardarProducto, useInventario } from '@/lib/inventario/store'
import type { Producto, TipoProducto } from '@/lib/inventario/tipos'
import {
  categoriasUnicas,
  ETIQUETAS_TIPO_PRODUCTO,
  formatoCordobas,
  validarNumero
} from '@/lib/inventario/utilidades'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from './ui'

type Errores = Partial<Record<'sku' | 'nombre' | 'categoria' | 'precioVenta' | 'costoProduccion' | 'existencias' | 'stockMinimo', string>>

export default function ProductoFormulario({
  producto,
  onCancelar,
  onGuardado
}: {
  producto?: Producto
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { productos } = useInventario()
  const esEdicion = Boolean(producto)

  const [valores, setValores] = useState({
    sku: producto?.sku ?? '',
    nombre: producto?.nombre ?? '',
    tipo: producto?.tipo ?? ('estandar' as TipoProducto),
    categoria: producto?.categoria ?? '',
    precioVenta: producto ? String(producto.precioVenta) : '',
    costoProduccion: producto ? String(producto.costoProduccion) : '',
    existencias: producto ? String(producto.existencias) : '0',
    stockMinimo: producto ? String(producto.stockMinimo) : ''
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const cambiar = (campo: keyof typeof valores, valor: string) => {
    setValores((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo]: undefined }))
  }

  const precio = Number(valores.precioVenta)
  const costo = Number(valores.costoProduccion)
  const mostrarAvisoMargen =
    valores.precioVenta !== '' && valores.costoProduccion !== '' && costo > precio

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Errores = {}

    if (!valores.sku.trim()) nuevosErrores.sku = 'El SKU es obligatorio.'
    else if (valores.sku.trim().length > 20) nuevosErrores.sku = 'Máximo 20 caracteres.'
    if (!valores.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio.'
    if (!valores.categoria.trim()) nuevosErrores.categoria = 'La categoría es obligatoria.'

    const precioVenta = validarNumero(valores.precioVenta, { etiqueta: 'El precio de venta', mayorQueCero: true })
    const costoProduccion = validarNumero(valores.costoProduccion, { etiqueta: 'El costo de producción' })
    const existencias = validarNumero(valores.existencias, { etiqueta: 'Las existencias', entero: true })
    const stockMinimo = validarNumero(valores.stockMinimo, { etiqueta: 'El stock mínimo', entero: true })

    if (precioVenta.error) nuevosErrores.precioVenta = precioVenta.error
    if (costoProduccion.error) nuevosErrores.costoProduccion = costoProduccion.error
    if (existencias.error) nuevosErrores.existencias = existencias.error
    if (stockMinimo.error) nuevosErrores.stockMinimo = stockMinimo.error

    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    const resultado = await guardarProducto(
      {
        sku: valores.sku,
        nombre: valores.nombre.trim(),
        tipo: valores.tipo,
        categoria: valores.categoria.trim(),
        precioVenta: precioVenta.valor!,
        costoProduccion: costoProduccion.valor!,
        existencias: existencias.valor!,
        stockMinimo: stockMinimo.valor!
      },
      producto?.id
    )

    if (!resultado.ok) {
      setErrorGeneral(resultado.error)
      return
    }
    onGuardado(esEdicion ? 'Producto actualizado' : 'Producto registrado')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Código SKU" htmlFor="producto-sku" error={errores.sku} requerido>
          <input
            id="producto-sku"
            value={valores.sku}
            onChange={(e) => cambiar('sku', e.target.value.toUpperCase())}
            placeholder="NP-STD-000"
            className={claseInput}
          />
        </Campo>

        <Campo etiqueta="Tipo" htmlFor="producto-tipo" requerido>
          <select
            id="producto-tipo"
            value={valores.tipo}
            onChange={(e) => cambiar('tipo', e.target.value)}
            className={claseInput}
          >
            {(Object.keys(ETIQUETAS_TIPO_PRODUCTO) as TipoProducto[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETAS_TIPO_PRODUCTO[tipo]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Nombre del mousepad"
          htmlFor="producto-nombre"
          error={errores.nombre}
          requerido
          className="sm:col-span-2"
        >
          <input
            id="producto-nombre"
            value={valores.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            placeholder="Mousepad ..."
            className={claseInput}
          />
        </Campo>

        <Campo
          etiqueta="Categoría"
          htmlFor="producto-categoria"
          error={errores.categoria}
          ayuda="Elija una existente o escriba una nueva."
          requerido
          className="sm:col-span-2"
        >
          <input
            id="producto-categoria"
            list="categorias-producto"
            value={valores.categoria}
            onChange={(e) => cambiar('categoria', e.target.value)}
            className={claseInput}
          />
          <datalist id="categorias-producto">
            {categoriasUnicas(productos).map((categoria) => (
              <option key={categoria} value={categoria} />
            ))}
          </datalist>
        </Campo>

        <Campo etiqueta="Precio de venta (C$)" htmlFor="producto-precio" error={errores.precioVenta} requerido>
          <input
            id="producto-precio"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valores.precioVenta}
            onChange={(e) => cambiar('precioVenta', e.target.value)}
            className={claseInput}
          />
        </Campo>

        <Campo
          etiqueta="Costo de producción estimado (C$)"
          htmlFor="producto-costo"
          error={errores.costoProduccion}
          ayuda={mostrarAvisoMargen ? `Atención: el costo supera el precio de venta (${formatoCordobas(precio)}).` : undefined}
          requerido
        >
          <input
            id="producto-costo"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={valores.costoProduccion}
            onChange={(e) => cambiar('costoProduccion', e.target.value)}
            className={claseInput}
          />
        </Campo>

        <Campo
          etiqueta={esEdicion ? 'Existencias actuales' : 'Existencias iniciales'}
          htmlFor="producto-existencias"
          error={errores.existencias}
          ayuda={
            esEdicion
              ? 'Para modificar existencias registre un movimiento de inventario.'
              : 'Si es mayor que cero se registra como entrada inicial.'
          }
          requerido
        >
          <input
            id="producto-existencias"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={valores.existencias}
            onChange={(e) => cambiar('existencias', e.target.value)}
            disabled={esEdicion}
            className={claseInput}
          />
        </Campo>

        <Campo etiqueta="Stock mínimo" htmlFor="producto-minimo" error={errores.stockMinimo} requerido>
          <input
            id="producto-minimo"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={valores.stockMinimo}
            onChange={(e) => cambiar('stockMinimo', e.target.value)}
            className={claseInput}
          />
        </Campo>
      </div>

      <PieFormulario
        onCancelar={onCancelar}
        textoGuardar={esEdicion ? 'Guardar cambios' : 'Registrar producto'}
      />
    </form>
  )
}
