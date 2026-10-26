'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { ArrowRight, CalendarCheck, ClipboardList, Users, Wallet } from 'lucide-react'

import { fechaHoy, formatoCordobas, formatoFecha } from '@/lib/inventario/utilidades'
import { useRecursosHumanos } from '@/lib/recursos-humanos/store'
import { nombreCompleto, TASAS_NOMINA } from '@/lib/recursos-humanos/utilidades'
import { claseTarjeta, EncabezadoPagina, EstadoVacio, TarjetaIndicador } from '../inventario/ui'
import { AvisoConexionRrhh, InsigniaAsistencia, InsigniaNomina } from './ui'

const accesosRapidos = [
  { titulo: 'Empleados', descripcion: 'Expedientes, cargos y salarios', href: '/recursos-humanos/empleados', icono: Users },
  { titulo: 'Asistencia', descripcion: 'Registro diario y horas extra', href: '/recursos-humanos/asistencia', icono: CalendarCheck },
  { titulo: 'Nómina', descripcion: 'Planillas, INSS e IR', href: '/recursos-humanos/nomina', icono: Wallet }
]

export default function ResumenRrhhVista() {
  const { empleados, asistencias, nominas } = useRecursosHumanos()
  const hoy = fechaHoy()

  const vigentes = useMemo(() => empleados.filter((e) => e.estado !== 'inactivo'), [empleados])
  const planillaMensual = vigentes.reduce((total, e) => total + e.salarioMensual, 0)
  const costoPatronal = planillaMensual * (TASAS_NOMINA.inssPatronal + TASAS_NOMINA.inatec)
  const hoyRegistros = asistencias.filter((a) => a.fecha === hoy)
  const novedadesHoy = hoyRegistros.filter((a) => a.estado !== 'presente')
  const porId = new Map(empleados.map((e) => [e.id, e]))
  const ultimasNominas = nominas.slice(0, 4)
  const pendientes = nominas.filter((n) => n.estado === 'borrador').length

  return (
    <>
      <AvisoConexionRrhh />
      <EncabezadoPagina titulo="Recursos Humanos" descripcion="Personal, asistencia y nómina de NeumoPad." migas={false} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <TarjetaIndicador
          titulo="Personal vigente"
          valor={String(vigentes.length)}
          detalle={`${vigentes.filter((e) => e.estado === 'vacaciones').length} de vacaciones`}
          icono={Users}
        />
        <TarjetaIndicador
          titulo="Planilla mensual bruta"
          valor={formatoCordobas(planillaMensual)}
          detalle={`+ ${formatoCordobas(costoPatronal)} de aportes patronales`}
          icono={Wallet}
        />
        <TarjetaIndicador
          titulo="Asistencia de hoy"
          valor={`${hoyRegistros.length}/${vigentes.length}`}
          detalle={hoyRegistros.length ? 'Empleados registrados' : 'Aún sin registrar'}
          icono={CalendarCheck}
          tono={hoyRegistros.length < vigentes.length ? 'alerta' : 'positivo'}
        />
        <TarjetaIndicador
          titulo="Planillas por pagar"
          valor={String(pendientes)}
          detalle="En estado borrador"
          icono={ClipboardList}
          tono={pendientes ? 'alerta' : 'neutro'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        {accesosRapidos.map(({ titulo, descripcion, href, icono: Icono }) => (
          <Link key={href} href={href} className={`${claseTarjeta} p-4 flex items-center gap-3 hover:border-zinc-400 transition group`}>
            <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-600"><Icono size={19} /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900">{titulo}</p>
              <p className="text-xs text-zinc-500 truncate">{descripcion}</p>
            </div>
            <ArrowRight size={16} className="text-zinc-300 group-hover:text-zinc-700 transition" />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={claseTarjeta}>
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">Novedades de hoy</h2>
            <Link href="/recursos-humanos/asistencia" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">Registrar</Link>
          </div>
          {novedadesHoy.length === 0 ? (
            <EstadoVacio icono={CalendarCheck} titulo="Sin novedades" descripcion={hoyRegistros.length ? 'Todo el personal registrado está presente.' : 'Registre la asistencia del día.'} />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {novedadesHoy.map((a) => {
                const empleado = porId.get(a.empleadoId)
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="font-medium text-zinc-900">{empleado ? nombreCompleto(empleado) : '—'}</span>
                    <InsigniaAsistencia estado={a.estado} />
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className={claseTarjeta}>
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">Últimas planillas</h2>
            <Link href="/recursos-humanos/nomina" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">Ver todas</Link>
          </div>
          {ultimasNominas.length === 0 ? (
            <EstadoVacio icono={Wallet} titulo="Aún no hay planillas" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {ultimasNominas.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="text-zinc-700">{formatoFecha(n.periodoInicio)} – {formatoFecha(n.periodoFin)}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-zinc-900">{formatoCordobas(n.totalNeto)}</span>
                    <InsigniaNomina estado={n.estado} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
