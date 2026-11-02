'use client'

import { useState } from 'react'
import { Cog, Gauge, Pencil, Plus, Power, Timer } from 'lucide-react'

import { formatoCordobas, formatoNumero, validarNumero } from '@/lib/inventario/utilidades'
import { cambiarEstadoCentro, guardarCentroTrabajo, useProduccion } from '@/lib/produccion/store'
import type { CentroTrabajo, Planta } from '@/lib/produccion/tipos'
import { formatoKw } from '@/lib/iiot/utilidades'
import { cargaPendientePorCentro, formatoMinutos, indicadores } from '@/lib/produccion/utilidades'
import {
  AvisoConexion,
  Campo,
  claseBotonPrimario,
  claseBotonTabla,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  ErrorFormulario,
  EstadoVacio,
  Modal,
  Notificacion,
  PieFormulario,
  TarjetaIndicador,
  useNotificacion
} from '../inventario/ui'
import { AvisoConexionProduccion, SECCION_PRODUCCION, ValorOee } from './ui'

export default function CentrosTrabajoVista() {
  const { centros: todos, rutas, ordenes, plantas } = useProduccion()
  const { mensaje, mostrar } = useNotificacion()
  const [modal, setModal] = useState<{ centro?: CentroTrabajo } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [plantaFiltro, setPlantaFiltro] = useState('')
  const centros = plantaFiltro ? todos.filter((c) => c.plantaId === plantaFiltro) : todos
  const plantaPorId = new Map(plantas.map((p) => [p.id, p]))

  // Carga pendiente: minutos estándar de las operaciones sin terminar de las órdenes abiertas
  const cargaPorCentro = cargaPendientePorCentro(ordenes, rutas)
  const operacionesTerminadas = ordenes.flatMap((o) => o.operaciones)
  const cargaTotal = [...cargaPorCentro.values()].reduce((t, v) => t + v, 0)
  const cuello = centros
    .filter((c) => c.activo)
    .map((c) => ({ centro: c, carga: cargaPorCentro.get(c.id) ?? 0 }))
    .sort((a, b) => b.carga - a.carga)[0]

  const alternar = async (c: CentroTrabajo) => {
    setError(null)
    const resultado = await cambiarEstadoCentro(c.id, !c.activo)
    if (!resultado.ok) { setError(resultado.error); return }
    mostrar(c.activo ? 'Centro desactivado' : 'Centro activado')
  }

  return (
    <>
      <AvisoConexion />
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Centros de trabajo"
        descripcion="Máquinas y puestos de la planta con su capacidad. Las rutas de fabricación indican qué paso se hace en cada centro."
        seccion={SECCION_PRODUCCION}
        acciones={
          <div className="flex flex-wrap gap-2">
            {plantas.length > 1 && (
              <select value={plantaFiltro} onChange={(e) => setPlantaFiltro(e.target.value)} className={`${claseInput} w-48`} aria-label="Planta">
                <option value="">Todas las plantas</option>
                {plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            )}
            <button type="button" onClick={() => setModal({})} className={claseBotonPrimario}>
              <Plus size={16} />
              Nuevo centro
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Centros activos" valor={String(centros.filter((c) => c.activo).length)} detalle={`${rutas.length} paso(s) de ruta asignados`} icono={Cog} />
        <TarjetaIndicador titulo="Carga pendiente" valor={formatoMinutos(cargaTotal)} detalle="Tiempo estándar de las órdenes abiertas" icono={Timer} tono={cargaTotal ? 'alerta' : 'neutro'} />
        <TarjetaIndicador
          titulo="Centro más cargado"
          valor={cuello && cuello.carga > 0 ? cuello.centro.nombre : '—'}
          detalle={cuello && cuello.carga > 0 ? `${formatoMinutos(cuello.carga)} pendientes · posible cuello de botella` : 'Sin carga pendiente'}
          icono={Gauge}
        />
      </div>

      <ErrorFormulario mensaje={error} />

      <div className={`${claseTarjeta} mt-4`}>
        {centros.length === 0 ? (
          <EstadoVacio icono={Cog} titulo="Aún no hay centros de trabajo" descripcion="Ejecute la migración de datos de rutas o registre los centros con el botón Nuevo centro." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1240px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>Centro</th>
                  <th className={claseCabeceraTabla}>Planta</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Capacidad</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Costo / hora</th>
                  <th className={claseCabeceraTabla}>Rango IIoT</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Potencia</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Destajo</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Carga pendiente</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Ocupación (1 turno)</th>
                  <th className={`${claseCabeceraTabla} text-right`}>OEE histórico</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {centros.map((c) => {
                  const carga = cargaPorCentro.get(c.id) ?? 0
                  const ocupacion = carga / (c.horasTurno * 60)
                  const oee = indicadores(operacionesTerminadas.filter((o) => o.centroTrabajoId === c.id))
                  return (
                    <tr key={c.id} className={`hover:bg-zinc-50/60 ${c.activo ? '' : 'opacity-60'}`}>
                      <td className={claseCeldaTabla}>
                        <p className="font-medium text-zinc-900">{c.nombre}</p>
                        <p className="font-mono text-xs text-zinc-400">{c.codigo}{c.activo ? '' : ' · inactivo'}</p>
                      </td>
                      <td className={claseCeldaTabla}>{c.plantaId ? plantaPorId.get(c.plantaId)?.nombre ?? '—' : <span className="text-zinc-400">Sin planta</span>}</td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        {formatoNumero(c.capacidadHora, 1)} und/h
                        <p className="text-xs text-zinc-400">{formatoNumero(c.capacidadHora * c.horasTurno)} und por turno de {formatoNumero(c.horasTurno, 1)} h</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(c.costoHora)}</td>
                      <td className={claseCeldaTabla}>
                        {c.temperaturaMin != null || c.temperaturaMax != null
                          ? `${c.temperaturaMin ?? '—'}–${c.temperaturaMax ?? '—'} °C`
                          : <span className="text-zinc-400">—</span>}
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        {formatoKw(c.potenciaKw)}
                        <p className="text-xs text-zinc-400">espera {formatoKw(c.potenciaEsperaKw)}</p>
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{c.tarifaDestajo ? `${formatoCordobas(c.tarifaDestajo)}/pz` : <span className="text-zinc-400">—</span>}</td>
                      <td className={`${claseCeldaTabla} text-right`}>{formatoMinutos(carga)}</td>
                      <td className={`${claseCeldaTabla} text-right font-medium ${ocupacion > 1 ? 'text-red-600' : ocupacion > 0.8 ? 'text-amber-700' : 'text-zinc-700'}`}>
                        {Math.round(ocupacion * 100)} %
                      </td>
                      <td className={`${claseCeldaTabla} text-right`}>{oee ? <ValorOee valor={oee.oee} /> : <span className="text-zinc-400">—</span>}</td>
                      <td className={`${claseCeldaTabla} text-right`}>
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => setModal({ centro: c })} className={claseBotonTabla}><Pencil size={14} />Editar</button>
                          <button type="button" onClick={() => alternar(c)} className={claseBotonTabla}><Power size={14} />{c.activo ? 'Desactivar' : 'Activar'}</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={Boolean(modal)} titulo={modal?.centro ? `Editar ${modal.centro.codigo}` : 'Nuevo centro de trabajo'} descripcion="Los campos marcados con * son obligatorios." onCerrar={() => setModal(null)}>
        {modal && (
          <CentroFormulario
            key={modal.centro?.id ?? 'nuevo'}
            centro={modal.centro}
            codigoSugerido={`CT-${String(todos.length + 1).padStart(2, '0')}`}
            plantas={plantas.filter((p) => p.activo || p.id === modal.centro?.plantaId)}
            onCancelar={() => setModal(null)}
            onGuardado={(texto) => { setModal(null); mostrar(texto) }}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function CentroFormulario({
  centro,
  codigoSugerido,
  plantas,
  onCancelar,
  onGuardado
}: {
  centro?: CentroTrabajo
  codigoSugerido: string
  plantas: Planta[]
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const [valores, setValores] = useState({
    codigo: centro?.codigo ?? codigoSugerido,
    nombre: centro?.nombre ?? '',
    descripcion: centro?.descripcion ?? '',
    capacidadHora: centro ? String(centro.capacidadHora) : '',
    horasTurno: centro ? String(centro.horasTurno) : '8',
    costoHora: centro ? String(centro.costoHora) : '0',
    temperaturaMin: centro?.temperaturaMin != null ? String(centro.temperaturaMin) : '',
    temperaturaMax: centro?.temperaturaMax != null ? String(centro.temperaturaMax) : '',
    plantaId: centro?.plantaId ?? plantas[0]?.id ?? '',
    potenciaKw: centro ? String(centro.potenciaKw) : '0',
    potenciaEsperaKw: centro ? String(centro.potenciaEsperaKw) : '0',
    tarifaDestajo: centro ? String(centro.tarifaDestajo) : '0'
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (campo: keyof typeof valores, valor: string) => { setValores((a) => ({ ...a, [campo]: valor })); setError(null) }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!valores.codigo.trim() || !valores.nombre.trim()) { setError('El código y el nombre son obligatorios.'); return }
    const capacidad = validarNumero(valores.capacidadHora, { etiqueta: 'La capacidad', decimales: 2 })
    const horas = validarNumero(valores.horasTurno, { etiqueta: 'Las horas por turno', mayorQueCero: true, decimales: 2 })
    const costo = validarNumero(valores.costoHora, { etiqueta: 'El costo por hora', decimales: 2 })
    const potencia = validarNumero(valores.potenciaKw, { etiqueta: 'La potencia', decimales: 2 })
    const espera = validarNumero(valores.potenciaEsperaKw, { etiqueta: 'La potencia en espera', decimales: 2 })
    const destajo = validarNumero(valores.tarifaDestajo, { etiqueta: 'La tarifa de destajo', decimales: 2 })
    const primerError = capacidad.error ?? horas.error ?? costo.error ?? potencia.error ?? espera.error ?? destajo.error
    if (primerError) { setError(primerError); return }
    if (horas.valor! > 24) { setError('Un turno no puede durar más de 24 horas.'); return }
    const tMin = valores.temperaturaMin.trim() ? Number(valores.temperaturaMin) : undefined
    const tMax = valores.temperaturaMax.trim() ? Number(valores.temperaturaMax) : undefined
    if ((tMin !== undefined && !Number.isFinite(tMin)) || (tMax !== undefined && !Number.isFinite(tMax))) { setError('El rango de temperatura no es válido.'); return }
    if (tMin !== undefined && tMax !== undefined && tMin >= tMax) { setError('La temperatura mínima debe ser menor que la máxima.'); return }

    setEnviando(true)
    const resultado = await guardarCentroTrabajo({
      codigo: valores.codigo,
      nombre: valores.nombre,
      descripcion: valores.descripcion,
      capacidadHora: capacidad.valor!,
      horasTurno: horas.valor!,
      costoHora: costo.valor!,
      temperaturaMin: tMin,
      temperaturaMax: tMax,
      plantaId: valores.plantaId || undefined,
      potenciaKw: potencia.valor!,
      potenciaEsperaKw: espera.valor!,
      tarifaDestajo: destajo.valor!
    }, centro?.id)
    setEnviando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onGuardado(centro ? 'Centro actualizado' : 'Centro registrado')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <ErrorFormulario mensaje={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo etiqueta="Código" htmlFor="ct-codigo" requerido>
          <input id="ct-codigo" value={valores.codigo} onChange={(e) => cambiar('codigo', e.target.value.toUpperCase())} className={claseInput} />
        </Campo>
        <Campo etiqueta="Nombre" htmlFor="ct-nombre" requerido className="sm:col-span-2">
          <input id="ct-nombre" value={valores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Ej. Prensa térmica" className={claseInput} />
        </Campo>
      </div>
      <Campo etiqueta="Planta" htmlFor="ct-planta" ayuda="Nave o sede donde está la máquina">
        <select id="ct-planta" value={valores.plantaId} onChange={(e) => cambiar('plantaId', e.target.value)} className={claseInput}>
          <option value="">Sin planta</option>
          {plantas.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.codigo})</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Descripción" htmlFor="ct-descripcion">
        <textarea id="ct-descripcion" rows={2} value={valores.descripcion} onChange={(e) => cambiar('descripcion', e.target.value)} className={`${claseInput} h-auto py-2 resize-none`} />
      </Campo>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo etiqueta="Capacidad (und/hora)" htmlFor="ct-capacidad" requerido>
          <input id="ct-capacidad" type="number" min="0" step="0.01" value={valores.capacidadHora} onChange={(e) => cambiar('capacidadHora', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Horas por turno" htmlFor="ct-horas" requerido>
          <input id="ct-horas" type="number" min="0" step="0.5" value={valores.horasTurno} onChange={(e) => cambiar('horasTurno', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Costo por hora (C$)" htmlFor="ct-costo">
          <input id="ct-costo" type="number" min="0" step="0.01" value={valores.costoHora} onChange={(e) => cambiar('costoHora', e.target.value)} className={claseInput} />
        </Campo>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Temperatura mínima (°C)" htmlFor="ct-tmin" ayuda="Opcional: para alarmas del sensor IIoT">
          <input id="ct-tmin" type="number" step="0.1" value={valores.temperaturaMin} onChange={(e) => cambiar('temperaturaMin', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Temperatura máxima (°C)" htmlFor="ct-tmax">
          <input id="ct-tmax" type="number" step="0.1" value={valores.temperaturaMax} onChange={(e) => cambiar('temperaturaMax', e.target.value)} className={claseInput} />
        </Campo>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo etiqueta="Potencia trabajando (kW)" htmlFor="ct-potencia" ayuda="Para energía y huella de carbono">
          <input id="ct-potencia" type="number" min="0" step="0.01" value={valores.potenciaKw} onChange={(e) => cambiar('potenciaKw', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Potencia en espera (kW)" htmlFor="ct-espera" ayuda="Encendida sin producir">
          <input id="ct-espera" type="number" min="0" step="0.01" value={valores.potenciaEsperaKw} onChange={(e) => cambiar('potenciaEsperaKw', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Destajo (C$ por pieza)" htmlFor="ct-destajo" ayuda="Pago por pieza buena en esta operación">
          <input id="ct-destajo" type="number" min="0" step="0.01" value={valores.tarifaDestajo} onChange={(e) => cambiar('tarifaDestajo', e.target.value)} className={claseInput} />
        </Campo>
      </div>
      <PieFormulario onCancelar={onCancelar} textoGuardar={centro ? 'Guardar cambios' : 'Registrar centro'} enviando={enviando} />
    </form>
  )
}
