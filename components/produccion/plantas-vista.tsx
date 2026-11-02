'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Cog, Leaf, Lightbulb, Pencil, Plus, Power, Zap } from 'lucide-react'

import { formatoCordobas, formatoNumero, validarNumero } from '@/lib/inventario/utilidades'
import { formatoKw } from '@/lib/iiot/utilidades'
import { cambiarEstadoPlanta, guardarPlanta, useProduccion } from '@/lib/produccion/store'
import type { Planta } from '@/lib/produccion/tipos'
import {
  AvisoConexion,
  Campo,
  claseBotonPrimario,
  claseBotonTabla,
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
import { AvisoConexionProduccion, SECCION_PRODUCCION } from './ui'

export default function PlantasVista() {
  const { plantas, centros, ordenes } = useProduccion()
  const { mensaje, mostrar } = useNotificacion()
  const [modal, setModal] = useState<{ planta?: Planta } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const alternar = async (p: Planta) => {
    setError(null)
    const resultado = await cambiarEstadoPlanta(p.id, !p.activo)
    if (!resultado.ok) { setError(resultado.error); return }
    mostrar(p.activo ? 'Planta desactivada' : 'Planta activada')
  }

  const enProceso = ordenes.filter((o) => o.estado === 'en_proceso')

  return (
    <>
      <AvisoConexion />
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Plantas"
        descripcion="Naves o sedes donde se produce. Cada centro de trabajo pertenece a una planta; así el ERP puede crecer a más de una sede y separar su producción y su energía."
        seccion={SECCION_PRODUCCION}
        acciones={
          <button type="button" onClick={() => setModal({})} className={claseBotonPrimario}>
            <Plus size={16} />
            Nueva planta
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Plantas activas" valor={String(plantas.filter((p) => p.activo).length)} detalle={`${centros.filter((c) => c.activo).length} centros de trabajo en total`} icono={Building2} />
        <TarjetaIndicador titulo="Potencia instalada" valor={formatoKw(centros.filter((c) => c.activo).reduce((t, c) => t + c.potenciaKw, 0) + plantas.filter((p) => p.activo).reduce((t, p) => t + p.iluminacionKw, 0))} detalle="Máquinas + iluminación" icono={Zap} tono="alerta" />
        <TarjetaIndicador titulo="Centros sin planta" valor={String(centros.filter((c) => c.activo && !c.plantaId).length)} detalle="Asígnelos en Centros de trabajo" icono={Cog} tono={centros.some((c) => c.activo && !c.plantaId) ? 'alerta' : 'neutro'} />
      </div>

      <ErrorFormulario mensaje={error} />

      {plantas.length === 0 ? (
        <div className={claseTarjeta}>
          <EstadoVacio icono={Building2} titulo="Aún no hay plantas" descripcion="Ejecute la migración 202610300001_plantas_energia_destajo.sql o registre una con el botón Nueva planta." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {plantas.map((p) => {
            const propios = centros.filter((c) => c.plantaId === p.id)
            const activos = propios.filter((c) => c.activo)
            const trabajando = enProceso.filter((o) => o.operaciones.some((op) => op.estado === 'en_proceso' && propios.some((c) => c.id === op.centroTrabajoId)))
            const potencia = activos.reduce((t, c) => t + c.potenciaKw, 0)
            const capacidadDia = activos.length ? Math.min(...activos.map((c) => c.capacidadHora * c.horasTurno)) : 0
            return (
              <section key={p.id} className={`${claseTarjeta} p-5 ${p.activo ? '' : 'opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-zinc-400">{p.codigo}{p.activo ? '' : ' · inactiva'}</p>
                    <h2 className="text-lg font-semibold text-zinc-900">{p.nombre}</h2>
                    {p.ubicacion && <p className="text-sm text-zinc-500">{p.ubicacion}</p>}
                  </div>
                  <div className="inline-flex gap-1">
                    <button type="button" onClick={() => setModal({ planta: p })} className={claseBotonTabla}><Pencil size={14} />Editar</button>
                    <button type="button" onClick={() => alternar(p)} className={claseBotonTabla}><Power size={14} />{p.activo ? 'Desactivar' : 'Activar'}</button>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
                  <Dato etiqueta="Centros" valor={String(activos.length)} />
                  <Dato etiqueta="Órdenes trabajando" valor={String(trabajando.length)} />
                  <Dato etiqueta="Máquinas" valor={formatoKw(potencia)} />
                  <Dato etiqueta="Lámparas" valor={formatoKw(p.iluminacionKw)} />
                </dl>
                <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-zinc-600 sm:grid-cols-2">
                  <p className="flex items-center gap-1.5"><Leaf size={13} className="text-emerald-600" />Factor de emisión: {formatoNumero(p.factorEmisionKgKwh, 3)} kg CO₂/kWh</p>
                  <p className="flex items-center gap-1.5"><Zap size={13} className="text-amber-500" />Tarifa eléctrica: {formatoCordobas(p.tarifaKwh)}/kWh</p>
                  <p className="flex items-center gap-1.5"><Lightbulb size={13} className="text-amber-500" />Medidor de lámparas: LUCES-{p.codigo.replace(/-/g, '')}</p>
                  <p className="flex items-center gap-1.5"><Cog size={13} className="text-zinc-400" />Capacidad por turno (cuello): {formatoNumero(capacidadDia)} und</p>
                </div>
                {propios.length > 0 && (
                  <p className="mt-3 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-700">Centros:</span> {propios.map((c) => `${c.codigo} ${c.nombre}`).join(' · ')}
                  </p>
                )}
                {trabajando.length > 0 && (
                  <p className="mt-2 text-xs text-sky-700">
                    Produciendo ahora: {trabajando.map((o) => o.codigo).join(', ')} · <Link href="/produccion/iiot" className="underline">ver en Monitoreo IIoT</Link>
                  </p>
                )}
              </section>
            )
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-zinc-500">
        La capacidad por turno es la del centro más lento de la planta (capacidad por hora × horas del turno): ese centro es el cuello de botella y marca cuánto puede sacar la planta.
      </p>

      <Modal abierto={Boolean(modal)} titulo={modal?.planta ? `Editar ${modal.planta.codigo}` : 'Nueva planta'} descripcion="Los campos marcados con * son obligatorios." onCerrar={() => setModal(null)}>
        {modal && (
          <PlantaFormulario
            key={modal.planta?.id ?? 'nueva'}
            planta={modal.planta}
            codigoSugerido={`PL-${String(plantas.length + 1).padStart(2, '0')}`}
            onCancelar={() => setModal(null)}
            onGuardado={(texto) => { setModal(null); mostrar(texto) }}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-2 py-2">
      <dt className="text-[11px] text-zinc-500">{etiqueta}</dt>
      <dd className="text-sm font-semibold tabular-nums text-zinc-900">{valor}</dd>
    </div>
  )
}

function PlantaFormulario({
  planta,
  codigoSugerido,
  onCancelar,
  onGuardado
}: {
  planta?: Planta
  codigoSugerido: string
  onCancelar: () => void
  onGuardado: (mensaje: string) => void
}) {
  const [valores, setValores] = useState({
    codigo: planta?.codigo ?? codigoSugerido,
    nombre: planta?.nombre ?? '',
    ubicacion: planta?.ubicacion ?? '',
    iluminacionKw: planta ? String(planta.iluminacionKw) : '0',
    factorEmisionKgKwh: planta ? String(planta.factorEmisionKgKwh) : '0.35',
    tarifaKwh: planta ? String(planta.tarifaKwh) : '0'
  })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (campo: keyof typeof valores, valor: string) => { setValores((a) => ({ ...a, [campo]: valor })); setError(null) }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!valores.codigo.trim() || !valores.nombre.trim()) { setError('El código y el nombre son obligatorios.'); return }
    const luces = validarNumero(valores.iluminacionKw, { etiqueta: 'La potencia de iluminación', decimales: 2 })
    const factor = validarNumero(valores.factorEmisionKgKwh, { etiqueta: 'El factor de emisión', decimales: 3 })
    const tarifa = validarNumero(valores.tarifaKwh, { etiqueta: 'La tarifa', decimales: 2 })
    const primerError = luces.error ?? factor.error ?? tarifa.error
    if (primerError) { setError(primerError); return }

    setEnviando(true)
    const resultado = await guardarPlanta({
      codigo: valores.codigo,
      nombre: valores.nombre,
      ubicacion: valores.ubicacion,
      iluminacionKw: luces.valor!,
      factorEmisionKgKwh: factor.valor!,
      tarifaKwh: tarifa.valor!
    }, planta?.id)
    setEnviando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onGuardado(planta ? 'Planta actualizada' : 'Planta registrada')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4">
      <ErrorFormulario mensaje={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo etiqueta="Código" htmlFor="pl-codigo" requerido>
          <input id="pl-codigo" value={valores.codigo} onChange={(e) => cambiar('codigo', e.target.value.toUpperCase())} className={claseInput} />
        </Campo>
        <Campo etiqueta="Nombre" htmlFor="pl-nombre" requerido className="sm:col-span-2">
          <input id="pl-nombre" value={valores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} placeholder="Ej. Planta Masaya" className={claseInput} />
        </Campo>
      </div>
      <Campo etiqueta="Ubicación" htmlFor="pl-ubicacion">
        <input id="pl-ubicacion" value={valores.ubicacion} onChange={(e) => cambiar('ubicacion', e.target.value)} className={claseInput} />
      </Campo>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Campo etiqueta="Iluminación (kW)" htmlFor="pl-luces" ayuda="Suma de las lámparas encendidas en el turno">
          <input id="pl-luces" type="number" min="0" step="0.01" value={valores.iluminacionKw} onChange={(e) => cambiar('iluminacionKw', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Factor de emisión (kg CO₂/kWh)" htmlFor="pl-factor" ayuda="Referencia: confírmelo con el dato oficial de la red">
          <input id="pl-factor" type="number" min="0" step="0.001" value={valores.factorEmisionKgKwh} onChange={(e) => cambiar('factorEmisionKgKwh', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Tarifa (C$ por kWh)" htmlFor="pl-tarifa" ayuda="Según su factura eléctrica">
          <input id="pl-tarifa" type="number" min="0" step="0.01" value={valores.tarifaKwh} onChange={(e) => cambiar('tarifaKwh', e.target.value)} className={claseInput} />
        </Campo>
      </div>
      <PieFormulario onCancelar={onCancelar} textoGuardar={planta ? 'Guardar cambios' : 'Registrar planta'} enviando={enviando} />
    </form>
  )
}
