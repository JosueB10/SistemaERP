'use client'

import Link from 'next/link'
import { useState } from 'react'

import { useInventario } from '@/lib/inventario/store'
import { fechaHoy, formatoCantidad, validarNumero } from '@/lib/inventario/utilidades'
import { guardarOrden, useProduccion } from '@/lib/produccion/store'
import type { OrdenProduccion } from '@/lib/produccion/tipos'
import { capacidadProduccion, recetaDeProducto, requerimientos, tieneMateriaDefinida } from '@/lib/produccion/utilidades'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'
import { TablaRequerimientos } from './ui'

type Errores = Partial<Record<'productoId' | 'cantidad', string>>

export default function OrdenFormulario({
  orden,
  onCancelar,
  onGuardado
}: {
  orden?: OrdenProduccion
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { productos, materiasPrimas } = useInventario()
  const { recetas, responsables } = useProduccion()

  const [valores, setValores] = useState({
    productoId: orden?.productoId ?? '',
    cantidad: orden ? String(orden.cantidadPlanificada) : '',
    fechaProgramada: orden?.fechaProgramada ?? fechaHoy(),
    empleadoId: orden?.empleadoId ?? '',
    observaciones: orden?.observaciones ?? ''
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = (campo: keyof typeof valores, valor: string) => {
    setValores((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo === 'cantidad' ? 'cantidad' : 'productoId']: undefined }))
    setErrorGeneral(null)
  }

  const receta = valores.productoId ? recetaDeProducto(recetas, valores.productoId) : undefined
  const cantidad = Number(valores.cantidad)
  const cantidadValida = Number.isInteger(cantidad) && cantidad > 0
  const capacidad = capacidadProduccion(receta, materiasPrimas)
  const disponibles = responsables.filter((r) => r.activo || r.id === valores.empleadoId)

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Errores = {}
    if (!valores.productoId) nuevosErrores.productoId = 'Seleccione el producto a fabricar.'
    const numeroValido = validarNumero(valores.cantidad, { etiqueta: 'La cantidad', mayorQueCero: true, entero: true })
    if (numeroValido.error) nuevosErrores.cantidad = numeroValido.error
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await guardarOrden(
      {
        productoId: valores.productoId,
        cantidadPlanificada: numeroValido.valor!,
        fechaProgramada: valores.fechaProgramada,
        empleadoId: valores.empleadoId || undefined,
        observaciones: valores.observaciones
      },
      orden?.id
    )
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(orden ? 'Orden actualizada' : 'Orden de producción creada')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Producto a fabricar"
          htmlFor="orden-producto"
          error={errores.productoId}
          requerido
          className="sm:col-span-2"
        >
          <select id="orden-producto" value={valores.productoId} onChange={(e) => cambiar('productoId', e.target.value)} className={claseInput}>
            <option value="">Seleccione...</option>
            {productos.map((p) => (
              <option key={p.id} value={p.id}>{p.sku} — {p.nombre}</option>
            ))}
          </select>
        </Campo>

        <Campo
          etiqueta="Cantidad a producir (und)"
          htmlFor="orden-cantidad"
          error={errores.cantidad}
          ayuda={capacidad !== null ? `Con el stock actual se pueden fabricar ${formatoCantidad(capacidad)} und.` : undefined}
          requerido
        >
          <input id="orden-cantidad" type="number" min="1" step="1" inputMode="numeric" value={valores.cantidad} onChange={(e) => cambiar('cantidad', e.target.value)} className={claseInput} />
        </Campo>

        <Campo etiqueta="Fecha programada" htmlFor="orden-fecha">
          <input id="orden-fecha" type="date" value={valores.fechaProgramada} onChange={(e) => cambiar('fechaProgramada', e.target.value)} className={claseInput} />
        </Campo>

        <Campo etiqueta="Responsable" htmlFor="orden-responsable" ayuda={responsables.length ? undefined : 'Registre empleados en Recursos Humanos para asignarlos.'} className="sm:col-span-2">
          <select id="orden-responsable" value={valores.empleadoId} onChange={(e) => cambiar('empleadoId', e.target.value)} className={claseInput}>
            <option value="">Sin asignar</option>
            {disponibles.map((r) => (
              <option key={r.id} value={r.id}>{r.codigo} — {r.nombre}</option>
            ))}
          </select>
        </Campo>

        <Campo etiqueta="Observaciones" htmlFor="orden-observaciones" className="sm:col-span-2">
          <textarea id="orden-observaciones" rows={2} value={valores.observaciones} onChange={(e) => cambiar('observaciones', e.target.value)} placeholder="Diseño, cliente, prioridad..." className={`${claseInput} h-auto py-2 resize-none`} />
        </Campo>
      </div>

      {valores.productoId && (
        tieneMateriaDefinida(receta) ? (
          <div>
            <p className="text-xs font-medium text-stone-700 mb-2">Materia prima requerida</p>
            <TablaRequerimientos lineas={requerimientos(receta, cantidadValida ? cantidad : 1, materiasPrimas)} cantidad={cantidadValida ? cantidad : 1} />
          </div>
        ) : (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Este producto aún no tiene receta: al completar la orden no se descontará materia prima automáticamente
            (podrá indicarla a mano).{' '}
            <Link href={`/produccion/recetas?producto=${encodeURIComponent(valores.productoId)}`} className="font-medium underline">
              Definir receta
            </Link>
          </div>
        )
      )}

      <PieFormulario onCancelar={onCancelar} textoGuardar={orden ? 'Guardar cambios' : 'Crear orden'} enviando={enviando} />
    </form>
  )
}
