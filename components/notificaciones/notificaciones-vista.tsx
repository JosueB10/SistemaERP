'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bell, CheckCheck, ExternalLink, Inbox, RefreshCw } from 'lucide-react'

import { ETIQUETAS_MODULO, type ModuloActividad } from '@/lib/actividad/eventos'
import {
  DIAS_NOTIFICACION,
  marcarLeidas,
  marcarNoLeida,
  recargarActividad,
  useErrorNotificaciones,
  useNotificaciones,
  type Notificacion
} from '@/lib/actividad/store'
import { coincideBusqueda } from '@/lib/inventario/utilidades'
import {
  AvisoConexion,
  Buscador,
  claseBotonSecundario,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  EstadoVacio,
  Paginacion,
  TarjetaIndicador,
  usePaginacion
} from '../inventario/ui'
import { IconoNotificacion, OrigenNotificacion } from './ui'

type Filtro = 'todas' | 'sin_leer' | 'alertas' | 'actividad'

const FILTROS: Record<Filtro, string> = {
  todas: 'Todas',
  sin_leer: 'Sin leer',
  alertas: 'Alertas',
  actividad: 'Actividad'
}

export default function NotificacionesVista() {
  const router = useRouter()
  const { notificaciones, sinLeer } = useNotificaciones()
  const errorLeidas = useErrorNotificaciones()
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [modulo, setModulo] = useState<ModuloActividad | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [actualizando, setActualizando] = useState(false)

  const filtradas = notificaciones.filter((n) => {
    const filtroOk = filtro === 'todas'
      || (filtro === 'sin_leer' && !n.leida)
      || (filtro === 'alertas' && n.clase === 'alerta')
      || (filtro === 'actividad' && n.clase === 'evento')
    return filtroOk && (!modulo || n.modulo === modulo) && coincideBusqueda(busqueda, n.titulo, n.detalle, n.documento)
  })
  const { pagina, totalPaginas, visibles, setPagina } = usePaginacion(filtradas, 15)

  const alertas = notificaciones.filter((n) => n.clase === 'alerta')
  const criticas = alertas.filter((n) => n.clase === 'alerta' && n.nivel === 'peligro').length

  const actualizar = async () => {
    setActualizando(true)
    await recargarActividad()
    setActualizando(false)
  }

  const abrir = (n: Notificacion) => {
    marcarLeidas([n.clave])
    router.push(n.href)
  }

  return (
    <>
      <AvisoConexion />
      {errorLeidas && (
        <div role="alert" className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{errorLeidas}</div>
      )}
      <EncabezadoPagina
        titulo="Notificaciones"
        descripcion={`Alertas vigentes y lo ocurrido en los últimos ${DIAS_NOTIFICACION} días. Pulse una notificación para ir al documento que la originó.`}
        migas={false}
        acciones={
          <>
            <button type="button" onClick={actualizar} disabled={actualizando} className={claseBotonSecundario}>
              <RefreshCw size={16} className={actualizando ? 'animate-spin' : undefined} />
              Actualizar
            </button>
            <button type="button" onClick={() => marcarLeidas(notificaciones.map((n) => n.clave))} disabled={!sinLeer} className={claseBotonSecundario}>
              <CheckCheck size={16} />
              Marcar todas como leídas
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <TarjetaIndicador titulo="Sin leer" valor={String(sinLeer)} detalle={`De ${notificaciones.length} notificación(es)`} icono={Bell} tono={sinLeer ? 'alerta' : 'neutro'} />
        <TarjetaIndicador titulo="Alertas vigentes" valor={String(alertas.length)} detalle={criticas ? `${criticas} crítica(s)` : 'Ninguna crítica'} icono={AlertTriangle} tono={criticas ? 'peligro' : alertas.length ? 'alerta' : 'neutro'} />
        <TarjetaIndicador titulo="Actividad reciente" valor={String(notificaciones.length - alertas.length)} detalle={`Últimos ${DIAS_NOTIFICACION} días`} icono={Inbox} />
      </div>

      <div className={claseTarjeta}>
        <div className="flex flex-col gap-3 border-b border-stone-200 p-4 lg:flex-row lg:items-center">
          <div role="tablist" aria-label="Filtrar notificaciones" className="flex gap-1 overflow-x-auto">
            {(Object.keys(FILTROS) as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filtro === f}
                onClick={() => { setFiltro(f); setPagina(1) }}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${filtro === f ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
              >
                {FILTROS[f]}
                {f === 'sin_leer' && sinLeer > 0 && <span className="ml-1.5 text-xs opacity-80">{sinLeer}</span>}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:ml-auto">
            <Buscador valor={busqueda} onCambio={(v) => { setBusqueda(v); setPagina(1) }} placeholder="Buscar por texto o documento" />
            <select value={modulo} onChange={(e) => { setModulo(e.target.value as ModuloActividad | ''); setPagina(1) }} className={`${claseInput} sm:w-48`} aria-label="Filtrar por módulo">
              <option value="">Todos los módulos</option>
              {(Object.keys(ETIQUETAS_MODULO) as ModuloActividad[]).map((m) => <option key={m} value={m}>{ETIQUETAS_MODULO[m]}</option>)}
            </select>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <EstadoVacio
            icono={Bell}
            titulo={notificaciones.length ? 'No hay notificaciones que coincidan' : 'No hay notificaciones'}
            descripcion={notificaciones.length ? 'Pruebe con otro filtro o búsqueda.' : 'Aquí aparecerán las ventas, compras, producción y alertas de inventario.'}
          />
        ) : (
          <ul className="divide-y divide-stone-100">
            {visibles.map((n) => (
              <li key={n.clave} className={`flex gap-3 px-4 py-3.5 ${n.leida ? '' : 'bg-sky-50/50'}`}>
                <IconoNotificacion notificacion={n} />
                <button type="button" onClick={() => abrir(n)} className="min-w-0 flex-1 text-left">
                  <p className={`text-sm ${n.leida ? 'text-stone-700' : 'font-semibold text-stone-900'}`}>{n.titulo}</p>
                  <p className="mt-0.5 text-xs text-stone-500">{n.detalle}</p>
                  <OrigenNotificacion notificacion={n} />
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-start">
                  <Link href={n.href} onClick={() => marcarLeidas([n.clave])} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100">
                    <ExternalLink size={13} />
                    Ver origen
                  </Link>
                  <button
                    type="button"
                    onClick={() => (n.leida ? marcarNoLeida(n.clave) : marcarLeidas([n.clave]))}
                    className="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                  >
                    {n.leida ? 'Marcar no leída' : 'Marcar leída'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Paginacion pagina={pagina} totalPaginas={totalPaginas} totalElementos={filtradas.length} onCambiar={setPagina} />
      </div>
    </>
  )
}
