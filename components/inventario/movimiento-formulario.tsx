'use client'

import { useState } from 'react'

import { registrarMovimiento, useInventario } from '@/lib/inventario/store'
import type {
  ClaseArticulo,
  SentidoAjuste,
  TipoMovimiento
} from '@/lib/inventario/tipos'
import {
  buscarArticulo,
  ETIQUETAS_CLASE,
  ETIQUETAS_MOVIMIENTO,
  fechaHoy,
  formatoCantidad,
  MOTIVOS_SUGERIDOS,
  validarNumero,
  variacionMovimiento
} from '@/lib/inventario/utilidades'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from './ui'

type Errores = Partial<Record<'fecha' | 'articulo' | 'cantidad' | 'motivo', string>>

export default function MovimientoFormulario({
  claseInicial = 'producto',
  articuloIdInicial = '',
  tipoInicial = 'entrada',
  onCancelar,
  onGuardado
}: {
  claseInicial?: ClaseArticulo
  articuloIdInicial?: string
  tipoInicial?: TipoMovimiento
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const datos = useInventario()

  const [valores, setValores] = useState({
    fecha: fechaHoy(),
    clase: claseInicial,
    articuloId: articuloIdInicial,
    tipo: tipoInicial,
    sentido: 'incremento' as SentidoAjuste,
    cantidad: '',
    motivo: '',
    observaciones: ''
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  const cambiar = <C extends keyof typeof valores>(campo: C, valor: (typeof valores)[C]) => {
    setValores((actual) => ({ ...actual, [campo]: valor }))
    setErrorGeneral(null)
    const campoError = campo === 'articuloId' ? 'articulo' : campo
    setErrores((actual) => ({ ...actual, [campoError]: undefined }))
  }

  const esProducto = valores.clase === 'producto'
  const opciones = esProducto
    ? datos.productos.map((item) => ({ id: item.id, codigo: item.sku, nombre: item.nombre }))
    : datos.materiasPrimas.map((item) => ({ id: item.id, codigo: item.codigo, nombre: item.nombre }))

  const articulo = valores.articuloId
    ? buscarArticulo(datos, valores.clase, valores.articuloId)
    : undefined

  const cantidadNumerica = Number(valores.cantidad)
  const vistaPrevia =
    articulo && valores.cantidad !== '' && Number.isFinite(cantidadNumerica) && cantidadNumerica > 0
      ? articulo.existencias +
        variacionMovimiento({ tipo: valores.tipo, sentido: valores.sentido, cantidad: cantidadNumerica })
      : null

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Errores = {}

    if (!valores.fecha) nuevosErrores.fecha = 'La fecha es obligatoria.'
    else if (valores.fecha > fechaHoy()) nuevosErrores.fecha = 'La fecha no puede ser futura.'
    if (!articulo) nuevosErrores.articulo = 'Seleccione un artículo.'
    if (!valores.motivo.trim()) nuevosErrores.motivo = 'El motivo es obligatorio.'

    const cantidad = validarNumero(valores.cantidad, {
      etiqueta: 'La cantidad',
      mayorQueCero: true,
      entero: esProducto
    })
    if (cantidad.error) nuevosErrores.cantidad = cantidad.error
    else if (vistaPrevia !== null && vistaPrevia < 0) {
      nuevosErrores.cantidad = `No hay existencias suficientes. Disponible: ${formatoCantidad(articulo!.existencias)} ${articulo!.unidad}.`
    }

    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    const resultado = await registrarMovimiento({
      fecha: valores.fecha,
      claseArticulo: valores.clase,
      articuloId: valores.articuloId,
      tipo: valores.tipo,
      sentido: valores.tipo === 'ajuste' ? valores.sentido : undefined,
      cantidad: cantidad.valor!,
      motivo: valores.motivo,
      observaciones: valores.observaciones
    })

    if (!resultado.ok) {
      setErrorGeneral(resultado.error)
      return
    }
    onGuardado(valores.tipo === 'ajuste' ? 'Ajuste registrado' : `${ETIQUETAS_MOVIMIENTO[valores.tipo]} registrada`)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Fecha" htmlFor="mov-fecha" error={errores.fecha} requerido>
          <input
            id="mov-fecha"
            type="date"
            value={valores.fecha}
            max={fechaHoy()}
            onChange={(e) => cambiar('fecha', e.target.value)}
            className={claseInput}
          />
        </Campo>

        <Campo etiqueta="Tipo de movimiento" htmlFor="mov-tipo" requerido>
          <select
            id="mov-tipo"
            value={valores.tipo}
            onChange={(e) => cambiar('tipo', e.target.value as TipoMovimiento)}
            className={claseInput}
          >
            {(Object.keys(ETIQUETAS_MOVIMIENTO) as TipoMovimiento[]).map((tipo) => (
              <option key={tipo} value={tipo}>
                {ETIQUETAS_MOVIMIENTO[tipo]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Clase de artículo" htmlFor="mov-clase" requerido>
          <select
            id="mov-clase"
            value={valores.clase}
            onChange={(e) => {
              setValores((actual) => ({ ...actual, clase: e.target.value as ClaseArticulo, articuloId: '' }))
            }}
            className={claseInput}
          >
            {(Object.keys(ETIQUETAS_CLASE) as ClaseArticulo[]).map((clase) => (
              <option key={clase} value={clase}>
                {ETIQUETAS_CLASE[clase]}
              </option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta={esProducto ? 'Producto' : 'Materia prima'}
          htmlFor="mov-articulo"
          error={errores.articulo}
          ayuda={
            articulo
              ? `Existencias actuales: ${formatoCantidad(articulo.existencias)} ${articulo.unidad}`
              : undefined
          }
          requerido
        >
          <select
            id="mov-articulo"
            value={valores.articuloId}
            onChange={(e) => cambiar('articuloId', e.target.value)}
            className={claseInput}
          >
            <option value="">Seleccione...</option>
            {opciones.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.codigo} — {opcion.nombre}
              </option>
            ))}
          </select>
        </Campo>

        {valores.tipo === 'ajuste' && (
          <Campo etiqueta="Sentido del ajuste" htmlFor="mov-sentido" requerido className="sm:col-span-2">
            <div id="mov-sentido" className="grid grid-cols-2 gap-2">
              {(['incremento', 'decremento'] as SentidoAjuste[]).map((sentido) => (
                <button
                  key={sentido}
                  type="button"
                  onClick={() => cambiar('sentido', sentido)}
                  className={`h-10 rounded-lg border text-sm font-medium transition ${
                    valores.sentido === sentido
                      ? 'border-stone-900 bg-stone-900 text-white'
                      : 'border-stone-300 bg-white text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {sentido === 'incremento' ? 'Aumentar existencias' : 'Disminuir existencias'}
                </button>
              ))}
            </div>
          </Campo>
        )}

        <Campo
          etiqueta={`Cantidad${articulo ? ` (${articulo.unidad})` : ''}`}
          htmlFor="mov-cantidad"
          error={errores.cantidad}
          ayuda={esProducto ? 'Solo unidades enteras.' : 'Admite hasta 2 decimales.'}
          requerido
        >
          <input
            id="mov-cantidad"
            type="number"
            min="0"
            step={esProducto ? '1' : '0.01'}
            inputMode="decimal"
            value={valores.cantidad}
            onChange={(e) => cambiar('cantidad', e.target.value)}
            className={claseInput}
          />
        </Campo>

        <Campo etiqueta="Motivo" htmlFor="mov-motivo" error={errores.motivo} requerido>
          <input
            id="mov-motivo"
            list="motivos-movimiento"
            value={valores.motivo}
            onChange={(e) => cambiar('motivo', e.target.value)}
            placeholder="Seleccione o escriba un motivo"
            className={claseInput}
          />
          <datalist id="motivos-movimiento">
            {MOTIVOS_SUGERIDOS[valores.tipo].map((motivo) => (
              <option key={motivo} value={motivo} />
            ))}
          </datalist>
        </Campo>

        <Campo etiqueta="Observaciones" htmlFor="mov-observaciones" className="sm:col-span-2">
          <textarea
            id="mov-observaciones"
            rows={3}
            value={valores.observaciones}
            onChange={(e) => cambiar('observaciones', e.target.value)}
            placeholder="Opcional"
            className={`${claseInput} h-auto py-2 resize-none`}
          />
        </Campo>
      </div>

      {articulo && vistaPrevia !== null && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            vistaPrevia < 0
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-stone-200 bg-stone-50 text-stone-700'
          }`}
        >
          Existencias: <strong>{formatoCantidad(articulo.existencias)}</strong> →{' '}
          <strong>{formatoCantidad(Math.round(vistaPrevia * 100) / 100)}</strong> {articulo.unidad}
          {vistaPrevia < 0 && ' — el movimiento no puede dejar existencias negativas.'}
        </div>
      )}

      <PieFormulario onCancelar={onCancelar} textoGuardar="Registrar movimiento" />
    </form>
  )
}
