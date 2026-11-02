'use client'

import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import type { Producto } from '@/lib/inventario/tipos'
import { validarNumero } from '@/lib/inventario/utilidades'
import { guardarRuta, useProduccion } from '@/lib/produccion/store'
import type { OperacionRutaEntrada } from '@/lib/produccion/tipos'
import { cicloEstandarUnidad, formatoMinutos } from '@/lib/produccion/utilidades'
import { claseBotonSecundario, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

type Paso = { clave: number; nombre: string; centroTrabajoId: string; preparacion: string; estandar: string; instrucciones: string }

let siguienteClave = 0
const nuevoPaso = (p: Partial<Omit<Paso, 'clave'>> = {}): Paso => ({
  clave: siguienteClave++,
  nombre: p.nombre ?? '',
  centroTrabajoId: p.centroTrabajoId ?? '',
  preparacion: p.preparacion ?? '0',
  estandar: p.estandar ?? '',
  instrucciones: p.instrucciones ?? ''
})

export default function RutaFormulario({
  producto,
  onCancelar,
  onGuardado
}: {
  producto: Producto
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { rutas, centros } = useProduccion()
  const actual = rutas.filter((r) => r.productoId === producto.id).sort((a, b) => a.secuencia - b.secuencia)
  const centrosActivos = centros.filter((c) => c.activo)

  const [pasos, setPasos] = useState<Paso[]>(() =>
    actual.length
      ? actual.map((r) => nuevoPaso({
          nombre: r.nombre,
          centroTrabajoId: r.centroTrabajoId,
          preparacion: String(r.tiempoPreparacionMin),
          estandar: String(r.tiempoEstandarMin),
          instrucciones: r.instrucciones ?? ''
        }))
      : [nuevoPaso()]
  )
  const [errores, setErrores] = useState<Record<number, string>>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = (clave: number, campo: keyof Omit<Paso, 'clave'>, valor: string) => {
    setPasos((a) => a.map((p) => (p.clave === clave ? { ...p, [campo]: valor } : p)))
    setErrores((a) => ({ ...a, [clave]: '' }))
    setErrorGeneral(null)
  }
  const mover = (indice: number, delta: number) => {
    setPasos((a) => {
      const copia = [...a]
      const destino = indice + delta
      if (destino < 0 || destino >= copia.length) return a
      ;[copia[indice], copia[destino]] = [copia[destino], copia[indice]]
      return copia
    })
  }

  const cicloEstimado = cicloEstandarUnidad(pasos.map((p) => ({ tiempoEstandarMin: Number(p.estandar) || 0 })))

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Record<number, string> = {}
    const definitivos: OperacionRutaEntrada[] = []
    for (const paso of pasos.filter((p) => p.nombre.trim() || p.centroTrabajoId || p.estandar.trim())) {
      if (!paso.nombre.trim()) { nuevosErrores[paso.clave] = 'Escriba el nombre del paso.'; continue }
      if (!paso.centroTrabajoId) { nuevosErrores[paso.clave] = 'Seleccione el centro de trabajo.'; continue }
      const prep = validarNumero(paso.preparacion || '0', { etiqueta: 'La preparación', decimales: 2 })
      const std = validarNumero(paso.estandar, { etiqueta: 'El tiempo estándar', mayorQueCero: true, decimales: 2 })
      if (prep.error || std.error) { nuevosErrores[paso.clave] = (prep.error ?? std.error)!; continue }
      definitivos.push({
        nombre: paso.nombre,
        centroTrabajoId: paso.centroTrabajoId,
        tiempoPreparacionMin: prep.valor!,
        tiempoEstandarMin: std.valor!,
        instrucciones: paso.instrucciones
      })
    }
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await guardarRuta(producto.id, definitivos)
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(definitivos.length ? `Ruta guardada: ${definitivos.length} paso(s)` : 'Ruta eliminada')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      {centrosActivos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500">
          Primero registre los centros de trabajo.
        </p>
      ) : (
        <>
          <p className="text-xs text-zinc-500">
            Pasos en el orden en que se fabrican. El tiempo estándar es por unidad (minutos); la preparación se cuenta una vez por orden.
            Las órdenes ya iniciadas conservan la ruta con que empezaron.
          </p>
          <ol className="space-y-3">
            {pasos.map((paso, indice) => (
              <li key={paso.clave} className="rounded-xl border border-zinc-200 p-3">
                <div className="flex items-start gap-3">
                  <span className="mt-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">{indice + 1}</span>
                  <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-6">
                    <input value={paso.nombre} onChange={(e) => cambiar(paso.clave, 'nombre', e.target.value)} placeholder="Nombre del paso" className={`${claseInput} sm:col-span-3`} aria-label="Nombre del paso" />
                    <select value={paso.centroTrabajoId} onChange={(e) => cambiar(paso.clave, 'centroTrabajoId', e.target.value)} className={`${claseInput} sm:col-span-3`} aria-label="Centro de trabajo">
                      <option value="">Centro de trabajo...</option>
                      {centrosActivos.map((c) => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
                    </select>
                    <label className="sm:col-span-2 text-xs text-zinc-500">
                      Preparación (min)
                      <input type="number" min="0" step="0.5" value={paso.preparacion} onChange={(e) => cambiar(paso.clave, 'preparacion', e.target.value)} className={`${claseInput} mt-1`} />
                    </label>
                    <label className="sm:col-span-2 text-xs text-zinc-500">
                      Estándar (min/und)
                      <input type="number" min="0" step="0.1" value={paso.estandar} onChange={(e) => cambiar(paso.clave, 'estandar', e.target.value)} className={`${claseInput} mt-1`} />
                    </label>
                    <label className="sm:col-span-2 text-xs text-zinc-500">
                      Instrucciones
                      <input value={paso.instrucciones} onChange={(e) => cambiar(paso.clave, 'instrucciones', e.target.value)} placeholder="Opcional" className={`${claseInput} mt-1`} />
                    </label>
                    {errores[paso.clave] && <p className="sm:col-span-6 text-xs text-red-600">{errores[paso.clave]}</p>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => mover(indice, -1)} disabled={indice === 0} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 disabled:opacity-30" aria-label="Subir paso"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => mover(indice, 1)} disabled={indice === pasos.length - 1} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 disabled:opacity-30" aria-label="Bajar paso"><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => setPasos((a) => a.filter((p) => p.clave !== paso.clave))} className="h-8 w-8 inline-flex items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label="Quitar paso"><Trash2 size={14} /></button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setPasos((a) => [...a, nuevoPaso()])} className={`${claseBotonSecundario} h-9`}>
              <Plus size={15} />
              Agregar paso
            </button>
            <p className="text-sm text-zinc-600">Tiempo de ciclo estándar: <span className="font-semibold text-zinc-900">{formatoMinutos(cicloEstimado)}</span> por unidad</p>
          </div>
        </>
      )}

      <PieFormulario onCancelar={onCancelar} textoGuardar="Guardar ruta" enviando={enviando} deshabilitado={centrosActivos.length === 0} />
    </form>
  )
}
