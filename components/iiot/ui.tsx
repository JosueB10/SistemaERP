'use client'

import { useSyncExternalStore } from 'react'
import { ArrowRight, ChevronDown, Cpu, Database, HelpCircle, MonitorSmartphone, Server } from 'lucide-react'

import { ETIQUETAS_ESTADO_LECTURA, SIGNIFICADO_ESTADO, type EstadoDispositivo } from '@/lib/iiot/utilidades'
import { claseTarjeta } from '../inventario/ui'

const estilosEstado: Record<EstadoDispositivo, string> = {
  operando: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  preparacion: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  inactivo: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20',
  paro: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  alarma: 'bg-red-50 text-red-700 ring-red-600/20',
  sin_senal: 'bg-zinc-800 text-white ring-zinc-900/20'
}

export function InsigniaLectura({ estado }: { estado: EstadoDispositivo }) {
  return (
    <span title={SIGNIFICADO_ESTADO[estado]} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${estilosEstado[estado]}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${estado === 'operando' ? 'animate-pulse' : ''}`} />
      {ETIQUETAS_ESTADO_LECTURA[estado]}
    </span>
  )
}

// Barra con la franja verde del rango correcto y una marca donde está el valor actual
export function MedidorRango({ valor, minimo, maximo, unidad }: { valor: number; minimo: number; maximo: number; unidad: string }) {
  const margen = Math.max((maximo - minimo) * 0.6, 10)
  const desde = Math.min(minimo - margen, valor)
  const hasta = Math.max(maximo + margen, valor)
  const pos = (v: number) => `${((v - desde) / (hasta - desde)) * 100}%`
  const dentro = valor >= minimo && valor <= maximo
  return (
    <div>
      <div className="relative h-2 rounded-full bg-zinc-100" role="img" aria-label={`${valor} ${unidad}, rango correcto ${minimo}–${maximo} ${unidad}`}>
        <div className="absolute inset-y-0 rounded-full bg-emerald-200" style={{ left: pos(minimo), width: `calc(${pos(maximo)} - ${pos(minimo)})` }} />
        <div className={`absolute -top-1 h-4 w-1.5 -translate-x-1/2 rounded-full ${dentro ? 'bg-emerald-700' : 'bg-red-600'}`} style={{ left: pos(valor) }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-400 tabular-nums">
        <span>{minimo} {unidad}</span>
        <span className={dentro ? 'text-emerald-700' : 'font-semibold text-red-600'}>{dentro ? 'En rango' : valor < minimo ? 'Muy baja' : 'Muy alta'}</span>
        <span>{maximo} {unidad}</span>
      </div>
    </div>
  )
}

// Se recuerda en el navegador si el usuario cerró la explicación
const CLAVE_AYUDA = 'neumopad:iiot-ayuda-cerrada'
const oyentesAyuda = new Set<() => void>()
const suscribirAyuda = (f: () => void) => { oyentesAyuda.add(f); return () => { oyentesAyuda.delete(f) } }
const leerAyuda = () => { try { return localStorage.getItem(CLAVE_AYUDA) } catch { return null } }

// Explicación en palabras simples de cómo llegan los datos de las máquinas al ERP
export function ComoFunciona() {
  const abierto = useSyncExternalStore(suscribirAyuda, leerAyuda, () => null) !== '1'
  const alternar = () => {
    try { localStorage.setItem(CLAVE_AYUDA, abierto ? '1' : '0') } catch { /* sin almacenamiento */ }
    oyentesAyuda.forEach((f) => f())
  }

  const pasos = [
    { icono: Cpu, titulo: '1. La máquina mide', texto: 'Cada máquina tiene sensores: temperatura de la plancha, presión, humedad, un contador de piezas y un medidor de energía.' },
    { icono: Server, titulo: '2. Envía la lectura', texto: 'Cada 3 segundos manda lo que midió por internet a la API del ERP (/api/iiot/lecturas) con una clave secreta.' },
    { icono: Database, titulo: '3. El ERP la revisa', texto: 'Guarda la lectura, la une a la orden que se está fabricando y, si la temperatura está fuera de rango, marca una alarma.' },
    { icono: MonitorSmartphone, titulo: '4. Usted la ve aquí', texto: 'Esta pantalla consulta las lecturas cada 5 segundos. Al contar todas las piezas, la máquina avisa y la orden avanza sola.' }
  ]

  return (
    <section className={`${claseTarjeta} mb-6`}>
      <button type="button" onClick={alternar} aria-expanded={abierto} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
        <span className="flex items-center gap-2 font-semibold text-zinc-900"><HelpCircle size={17} className="text-sky-600" />¿Cómo funciona el IIoT?</span>
        <ChevronDown size={16} className={`text-zinc-400 transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>
      {abierto && (
        <div className="border-t border-zinc-100 px-5 pb-5 pt-4 space-y-5">
          <p className="text-sm text-zinc-600">
            IIoT (Internet Industrial de las Cosas) significa que las máquinas de la planta están conectadas y
            reportan solas lo que hacen. En NeumoPad no tenemos máquinas reales conectadas, así que un programa
            (<code className="font-mono text-xs bg-zinc-100 px-1 rounded">iiot/emulador.py</code>) hace de cuenta que es cada máquina y manda datos realistas.
          </p>
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {pasos.map((p, i) => (
              <li key={p.titulo} className="relative rounded-xl bg-zinc-50 p-4">
                <p.icono size={18} className="text-sky-600" />
                <p className="mt-2 text-sm font-semibold text-zinc-900">{p.titulo}</p>
                <p className="mt-1 text-xs text-zinc-600">{p.texto}</p>
                {i < pasos.length - 1 && <ArrowRight size={16} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-zinc-300 md:block" />}
              </li>
            ))}
          </ol>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">Qué significa cada estado</p>
              <ul className="space-y-1.5">
                {(Object.keys(SIGNIFICADO_ESTADO) as EstadoDispositivo[]).map((e) => (
                  <li key={e} className="flex items-start gap-2 text-xs text-zinc-600">
                    <span className="w-32 shrink-0"><InsigniaLectura estado={e} /></span>
                    {SIGNIFICADO_ESTADO[e]}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-xs text-zinc-600 space-y-2">
              <p className="font-semibold uppercase tracking-wide text-zinc-400">Qué simula el emulador</p>
              <p><strong>Paros:</strong> atascos o falta de operario. La máquina queda «Detenida» y ese tiempo baja el OEE.</p>
              <p><strong>Picos de temperatura:</strong> la plancha se sale del rango (por ejemplo, la prensa de 150 a 180 °C) y salta una alarma.</p>
              <p><strong>Apagones:</strong> una máquina se apaga y deja de reportar. Aparece «Sin señal» y después sigue donde quedó.</p>
              <p><strong>Cortes de red:</strong> las lecturas se guardan en una cola dentro de la máquina. Al volver la red se envían con su hora original, y aquí se ve cuánto esperaron.</p>
              <p><strong>Energía:</strong> cada máquina y las lámparas reportan su consumo en kW y kWh. Con eso se calcula el costo y la huella de carbono.</p>
              <p className="rounded-lg bg-white border border-zinc-200 px-3 py-2">
                Para encender la planta: en la terminal del proyecto ejecute <code className="font-mono bg-zinc-100 px-1 rounded">npm run dev:planta</code> y cree una orden de producción.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
