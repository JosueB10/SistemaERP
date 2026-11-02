'use client'

import { useState } from 'react'

import { inspeccionarLote } from '@/lib/calidad/store'
import type { DisposicionNc, Lote, SeveridadNc } from '@/lib/calidad/tipos'
import { CRITERIOS_INSPECCION, DEFECTOS_COMUNES, ETIQUETAS_DISPOSICION, ETIQUETAS_SEVERIDAD } from '@/lib/calidad/utilidades'
import { fechaHoy, formatoCantidad, validarNumero } from '@/lib/inventario/utilidades'
import { useProduccion } from '@/lib/produccion/store'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

export default function InspeccionFormulario({
  lote,
  personalizado,
  onCancelar,
  onGuardado
}: {
  lote: Lote
  personalizado: boolean
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const { responsables } = useProduccion()
  const criterios = CRITERIOS_INSPECCION.filter((c) => !c.soloPersonalizado || personalizado)
  const [marcados, setMarcados] = useState<Record<string, boolean>>(() => Object.fromEntries(criterios.map((c) => [c.clave, true])))
  const [valores, setValores] = useState({
    aprobadas: String(lote.cantidad),
    rechazadas: '0',
    fecha: fechaHoy(),
    inspectorId: '',
    observaciones: '',
    tipoDefecto: '',
    descripcion: '',
    severidad: 'menor' as SeveridadNc,
    disposicion: 'desecho' as DisposicionNc
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = (campo: keyof typeof valores, valor: string) => { setValores((a) => ({ ...a, [campo]: valor })); setError(null) }
  // Al escribir las rechazadas, las aprobadas se ajustan solas al total del lote
  const cambiarRechazadas = (valor: string) => {
    const n = Number(valor)
    setValores((a) => ({ ...a, rechazadas: valor, aprobadas: Number.isInteger(n) && n >= 0 && n <= lote.cantidad ? String(lote.cantidad - n) : a.aprobadas }))
    setError(null)
  }
  const rechazadas = Number(valores.rechazadas) || 0

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const aprobadas = validarNumero(valores.aprobadas, { etiqueta: 'Las aprobadas', entero: true })
    const rech = validarNumero(valores.rechazadas || '0', { etiqueta: 'Las rechazadas', entero: true })
    if (aprobadas.error || rech.error) { setError((aprobadas.error ?? rech.error)!); return }
    if (aprobadas.valor! + rech.valor! !== lote.cantidad) { setError(`Aprobadas + rechazadas debe sumar ${lote.cantidad}.`); return }
    if (rech.valor! > 0 && !valores.tipoDefecto.trim()) { setError('Indique el tipo de defecto de las unidades rechazadas.'); return }
    if (rech.valor! === 0 && Object.values(marcados).some((v) => !v)) { setError('Hay criterios sin cumplir: registre las unidades rechazadas o marque los criterios.'); return }
    if (!valores.fecha || valores.fecha > fechaHoy()) { setError('La fecha de inspección no puede estar vacía ni ser futura.'); return }

    setEnviando(true)
    const resultado = await inspeccionarLote(lote.id, {
      aprobadas: aprobadas.valor!,
      rechazadas: rech.valor!,
      fecha: valores.fecha,
      inspectorId: valores.inspectorId || undefined,
      criterios: marcados,
      observaciones: valores.observaciones,
      tipoDefecto: valores.tipoDefecto,
      descripcion: valores.descripcion,
      severidad: valores.severidad,
      disposicion: valores.disposicion
    })
    setEnviando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onGuardado(rech.valor! > 0
      ? `Lote inspeccionado: ${formatoCantidad(rech.valor!)} und rechazadas salieron del stock y se abrió una no conformidad`
      : `Lote ${lote.codigo} aprobado`)
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <ErrorFormulario mensaje={error} />

      <fieldset>
        <legend className="text-xs font-medium text-zinc-700 mb-2">Lista de verificación</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {criterios.map((c) => (
            <label key={c.clave} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
              <input type="checkbox" checked={marcados[c.clave] ?? false} onChange={(e) => setMarcados((a) => ({ ...a, [c.clave]: e.target.checked }))} className="h-4 w-4 accent-zinc-900" />
              {c.etiqueta}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Campo etiqueta="Aprobadas" htmlFor="insp-aprobadas" requerido>
          <input id="insp-aprobadas" type="number" min="0" step="1" value={valores.aprobadas} onChange={(e) => cambiar('aprobadas', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Rechazadas" htmlFor="insp-rechazadas" ayuda="Salen del stock">
          <input id="insp-rechazadas" type="number" min="0" step="1" value={valores.rechazadas} onChange={(e) => cambiarRechazadas(e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Fecha" htmlFor="insp-fecha" requerido>
          <input id="insp-fecha" type="date" max={fechaHoy()} value={valores.fecha} onChange={(e) => cambiar('fecha', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Inspector" htmlFor="insp-inspector">
          <select id="insp-inspector" value={valores.inspectorId} onChange={(e) => cambiar('inspectorId', e.target.value)} className={claseInput}>
            <option value="">Sin asignar</option>
            {responsables.filter((r) => r.activo).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </Campo>
      </div>

      {rechazadas > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/50 p-4 space-y-3">
          <p className="text-sm font-medium text-red-800">No conformidad por {formatoCantidad(rechazadas)} und rechazada(s)</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Campo etiqueta="Tipo de defecto" htmlFor="insp-defecto" requerido className="sm:col-span-3">
              <input id="insp-defecto" list="defectos-comunes" value={valores.tipoDefecto} onChange={(e) => cambiar('tipoDefecto', e.target.value)} placeholder="Seleccione o escriba..." className={claseInput} />
              <datalist id="defectos-comunes">{DEFECTOS_COMUNES.map((d) => <option key={d} value={d} />)}</datalist>
            </Campo>
            <Campo etiqueta="Severidad" htmlFor="insp-severidad">
              <select id="insp-severidad" value={valores.severidad} onChange={(e) => cambiar('severidad', e.target.value)} className={claseInput}>
                {(Object.keys(ETIQUETAS_SEVERIDAD) as SeveridadNc[]).map((s) => <option key={s} value={s}>{ETIQUETAS_SEVERIDAD[s]}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Disposición" htmlFor="insp-disposicion">
              <select id="insp-disposicion" value={valores.disposicion} onChange={(e) => cambiar('disposicion', e.target.value)} className={claseInput}>
                {(['desecho', 'reproceso'] as DisposicionNc[]).map((d) => <option key={d} value={d}>{ETIQUETAS_DISPOSICION[d]}</option>)}
              </select>
            </Campo>
            <Campo etiqueta="Descripción" htmlFor="insp-descripcion">
              <input id="insp-descripcion" value={valores.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} className={claseInput} />
            </Campo>
          </div>
        </div>
      )}

      <Campo etiqueta="Observaciones" htmlFor="insp-obs">
        <textarea id="insp-obs" rows={2} value={valores.observaciones} onChange={(e) => cambiar('observaciones', e.target.value)} className={`${claseInput} h-auto py-2 resize-none`} />
      </Campo>

      <PieFormulario onCancelar={onCancelar} textoGuardar="Registrar inspección" enviando={enviando} />
    </form>
  )
}
