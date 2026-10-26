'use client'

import Link from 'next/link'
import { useState } from 'react'

import { useInventario } from '@/lib/inventario/store'
import { fechaHoy, formatoCantidad, validarNumero } from '@/lib/inventario/utilidades'
import { guardarOrden, useProduccion } from '@/lib/produccion/store'
import type { OrdenProduccion } from '@/lib/produccion/tipos'
import { capacidadProduccion, materiaComprometida, recetaDeProducto, requerimientos, tieneMateriaDefinida } from '@/lib/produccion/utilidades'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'
import { TablaRequerimientos } from './ui'

type Errores = Partial<Record<'productoId' | 'cantidad', string>>

export default function OrdenFormulario({
  orden,
  inicial,
  onCancelar,
  onGuardado
}: {
  orden?: OrdenProduccion
  // Valores propuestos al crear (por ejemplo, lo que falta para una venta pendiente)
  inicial?: { productoId: string; cantidad: number; ventaId?: string; observaciones?: string }
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { productos, materiasPrimas } = useInventario()
  const { recetas, ordenes, responsables } = useProduccion()

  const [valores, setValores] = useState({
    productoId: orden?.productoId ?? inicial?.productoId ?? '',
    cantidad: orden ? String(orden.cantidadPlanificada) : inicial ? String(inicial.cantidad) : '',
    fechaProgramada: orden?.fechaProgramada ?? fechaHoy(),
    empleadoId: orden?.empleadoId ?? '',
    observaciones: orden?.observaciones ?? inicial?.observaciones ?? ''
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
  // Lo que ya reservaron las otras órdenes abiertas no está disponible para esta
  const comprometida = materiaComprometida(ordenes, recetas, orden?.id)
  const capacidad = capacidadProduccion(receta, materiasPrimas, comprometida)
  const lineas = tieneMateriaDefinida(receta) ? requerimientos(receta, cantidadValida ? cantidad : 1, materiasPrimas, comprometida) : []
  const faltantes = cantidadValida ? lineas.filter((linea) => linea.faltante > 0) : []
  const sinMateria = capacidad === 0
  const disponibles = responsables.filter((r) => r.activo || r.id === valores.empleadoId)

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Errores = {}
    if (!valores.productoId) nuevosErrores.productoId = 'Seleccione el producto a fabricar.'
    const numeroValido = validarNumero(valores.cantidad, { etiqueta: 'La cantidad', mayorQueCero: true, entero: true })
    if (numeroValido.error) nuevosErrores.cantidad = numeroValido.error
    else if (sinMateria) nuevosErrores.cantidad = 'No hay materia prima disponible para fabricar este producto. Registre una compra primero.'
    else if (faltantes.length > 0) nuevosErrores.cantidad = `Materia prima insuficiente: con el stock disponible solo se pueden fabricar ${formatoCantidad(capacidad ?? 0)} und.`
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await guardarOrden(
      {
        productoId: valores.productoId,
        cantidadPlanificada: numeroValido.valor!,
        fechaProgramada: valores.fechaProgramada,
        empleadoId: valores.empleadoId || undefined,
        ventaId: orden ? undefined : inicial?.ventaId,
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
          ayuda={capacidad !== null ? `Con la materia prima disponible se pueden fabricar ${formatoCantidad(capacidad)} und${comprometida.size ? ' (descontando lo reservado por otras órdenes abiertas)' : ''}.` : undefined}
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
            <p className="text-xs font-medium text-zinc-700 mb-2">Materia prima requerida</p>
            <TablaRequerimientos lineas={lineas} cantidad={cantidadValida ? cantidad : 1} />
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

      {(sinMateria || faltantes.length > 0) && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sinMateria
            ? 'Se acabó la materia prima para este producto: no se puede crear la orden hasta que se registre una compra.'
            : `No se puede ${orden ? 'guardar' : 'crear'} la orden: faltan ${faltantes.map((l) => `${formatoCantidad(l.faltante)} ${l.unidad} de ${l.nombre}`).join(', ')}. Reduzca la cantidad a ${formatoCantidad(capacidad ?? 0)} und o compre más materia prima.`}
        </div>
      )}

      <PieFormulario onCancelar={onCancelar} textoGuardar={orden ? 'Guardar cambios' : 'Crear orden'} enviando={enviando} deshabilitado={sinMateria || faltantes.length > 0} />
    </form>
  )
}
