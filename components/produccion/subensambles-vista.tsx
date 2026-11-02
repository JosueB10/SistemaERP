'use client'

import { useMemo, useState } from 'react'
import { Boxes, Layers, Pencil, Plus, Power } from 'lucide-react'

import { useInventario } from '@/lib/inventario/store'
import { coincideBusqueda, formatoCordobas } from '@/lib/inventario/utilidades'
import { cambiarEstadoSubensamble, useProduccion } from '@/lib/produccion/store'
import type { Subensamble } from '@/lib/produccion/tipos'
import { costoSubensamble } from '@/lib/produccion/utilidades'
import {
  AvisoConexion,
  Buscador,
  claseBotonPrimario,
  claseBotonTabla,
  claseCabeceraTabla,
  claseCeldaTabla,
  claseTarjeta,
  EncabezadoPagina,
  ErrorFormulario,
  EstadoVacio,
  InsigniaNeutra,
  Modal,
  Notificacion,
  TarjetaIndicador,
  useNotificacion
} from '../inventario/ui'
import SubensambleFormulario from './subensamble-formulario'
import { ArbolBom, AvisoConexionProduccion, SECCION_PRODUCCION } from './ui'

export default function SubensamblesVista() {
  const { productos, materiasPrimas } = useInventario()
  const { subensambles, recetas } = useProduccion()
  const { mensaje, mostrar } = useNotificacion()
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<{ subensamble?: Subensamble } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Productos cuya receta usa cada subensamble
  const usos = useMemo(() => {
    const mapa = new Map<string, string[]>()
    for (const receta of recetas) {
      const producto = productos.find((p) => p.id === receta.productoId)
      for (const linea of receta.estructura) {
        if (linea.tipo !== 'subensamble' || !producto) continue
        mapa.set(linea.componenteId, [...(mapa.get(linea.componenteId) ?? []), producto.sku])
      }
    }
    return mapa
  }, [recetas, productos])

  const filtrados = subensambles.filter((s) => coincideBusqueda(busqueda, s.codigo, s.nombre, s.descripcion))
  const activos = subensambles.filter((s) => s.activo).length
  const enUso = subensambles.filter((s) => usos.has(s.id)).length
  const codigoSugerido = `SE-${String(subensambles.length + 1).padStart(3, '0')}`

  const alternar = async (s: Subensamble) => {
    setError(null)
    const resultado = await cambiarEstadoSubensamble(s.id, !s.activo)
    if (!resultado.ok) { setError(resultado.error); return }
    mostrar(s.activo ? 'Subensamble desactivado' : 'Subensamble activado')
  }

  return (
    <>
      <AvisoConexion />
      <AvisoConexionProduccion />
      <EncabezadoPagina
        titulo="Subensambles"
        descripcion="Piezas intermedias de la BOM (por ejemplo, la base de caucho planchada o la superficie de tela). Cada una tiene su propia materia prima."
        seccion={SECCION_PRODUCCION}
        acciones={
          <button type="button" onClick={() => setModal({})} className={claseBotonPrimario}>
            <Plus size={16} />
            Nuevo subensamble
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Subensambles activos" valor={String(activos)} detalle="Disponibles para usar en recetas" icono={Boxes} />
        <TarjetaIndicador titulo="En uso" valor={String(enUso)} detalle="Forman parte de al menos una receta" icono={Layers} tono={enUso ? 'positivo' : 'neutro'} />
        <TarjetaIndicador titulo="Niveles de la BOM" valor={enUso ? '2' : '1'} detalle="Producto → subensamble → materia prima" icono={Layers} />
      </div>

      <ErrorFormulario mensaje={error} />

      <div className={`${claseTarjeta} mt-4`}>
        <div className="border-b border-zinc-100 p-4">
          <Buscador valor={busqueda} onCambio={setBusqueda} placeholder="Buscar subensamble" />
        </div>
        {filtrados.length === 0 ? (
          <EstadoVacio
            icono={Boxes}
            titulo={subensambles.length ? 'No hay subensambles que coincidan' : 'Aún no hay subensambles'}
            descripcion={subensambles.length ? undefined : 'Cree subensambles y luego agréguelos en la receta de cada producto.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="bg-zinc-50/70">
                <tr>
                  <th className={claseCabeceraTabla}>Subensamble</th>
                  <th className={claseCabeceraTabla}>Materia prima por unidad</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Costo</th>
                  <th className={claseCabeceraTabla}>Usado en</th>
                  <th className={`${claseCabeceraTabla} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtrados.map((s) => (
                  <tr key={s.id} className={`align-top hover:bg-zinc-50/60 ${s.activo ? '' : 'opacity-60'}`}>
                    <td className={claseCeldaTabla}>
                      <p className="font-medium text-zinc-900">{s.nombre}</p>
                      <p className="font-mono text-xs text-zinc-400">{s.codigo}{s.activo ? '' : ' · inactivo'}</p>
                      {s.descripcion && <p className="text-xs text-zinc-500 whitespace-normal max-w-xs mt-1">{s.descripcion}</p>}
                    </td>
                    <td className={`${claseCeldaTabla} whitespace-normal`}>
                      <ArbolBom
                        estructura={s.lineas.map((l) => ({ tipo: 'materia_prima', componenteId: l.materiaPrimaId, cantidad: l.cantidad }))}
                        subensambles={[]}
                        materiasPrimas={materiasPrimas}
                      />
                    </td>
                    <td className={`${claseCeldaTabla} text-right`}>{formatoCordobas(costoSubensamble(s, materiasPrimas))}</td>
                    <td className={claseCeldaTabla}>
                      <div className="flex flex-wrap gap-1">
                        {(usos.get(s.id) ?? []).map((sku) => <InsigniaNeutra key={sku}>{sku}</InsigniaNeutra>)}
                        {!usos.has(s.id) && <span className="text-xs text-zinc-400">Sin uso</span>}
                      </div>
                    </td>
                    <td className={`${claseCeldaTabla} text-right`}>
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => setModal({ subensamble: s })} className={claseBotonTabla}><Pencil size={14} />Editar</button>
                        <button type="button" onClick={() => alternar(s)} className={claseBotonTabla}><Power size={14} />{s.activo ? 'Desactivar' : 'Activar'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal abierto={Boolean(modal)} titulo={modal?.subensamble ? `Editar ${modal.subensamble.codigo}` : 'Nuevo subensamble'} onCerrar={() => setModal(null)} ancho="max-w-3xl">
        {modal && (
          <SubensambleFormulario
            key={modal.subensamble?.id ?? 'nuevo'}
            subensamble={modal.subensamble}
            codigoSugerido={codigoSugerido}
            onCancelar={() => setModal(null)}
            onGuardado={(texto) => { setModal(null); mostrar(texto) }}
          />
        )}
      </Modal>

      <Notificacion mensaje={mensaje} />
    </>
  )
}
