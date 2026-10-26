'use client'

import { useState } from 'react'
import { KeyRound, LogOut, MonitorSmartphone, UserRound } from 'lucide-react'

import {
  actualizarPerfil,
  cambiarContrasena,
  cerrarOtrasSesiones,
  cerrarSesion,
  useUsuario,
  type Usuario
} from '@/lib/cuenta/sesion'
import { formatoFecha } from '@/lib/inventario/utilidades'
import {
  Campo,
  claseBotonPrimario,
  claseBotonSecundario,
  claseInput,
  claseTarjeta,
  EncabezadoPagina,
  ErrorFormulario,
  Notificacion,
  useNotificacion
} from '../inventario/ui'

export default function CuentaVista() {
  const usuario = useUsuario()
  const { mensaje, mostrar } = useNotificacion()

  if (!usuario) return <p className="text-sm text-stone-400">Cargando…</p>

  return (
    <>
      <EncabezadoPagina titulo="Mi cuenta" descripcion="Datos del usuario con el que inició sesión, contraseña y sesiones abiertas." migas={false} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* key: al guardar se rehace el formulario con los datos nuevos */}
        <Perfil key={`${usuario.nombre}|${usuario.cargo}|${usuario.telefono}`} usuario={usuario} onGuardado={mostrar} />
        <Contrasena onGuardado={mostrar} />
        <Sesiones usuario={usuario} onAccion={mostrar} />
      </div>

      <Notificacion mensaje={mensaje} />
    </>
  )
}

function Seccion({ titulo, descripcion, icono: Icono, children }: { titulo: string; descripcion: string; icono: React.ElementType; children: React.ReactNode }) {
  return (
    <section className={`${claseTarjeta} p-6`}>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600"><Icono size={19} /></span>
        <div>
          <h2 className="font-semibold text-stone-900">{titulo}</h2>
          <p className="text-xs text-stone-500 mt-0.5">{descripcion}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Perfil({ usuario, onGuardado }: { usuario: Usuario; onGuardado: (mensaje: string) => void }) {
  const [valores, setValores] = useState({ nombre: usuario.nombre, cargo: usuario.cargo, telefono: usuario.telefono })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (campo: keyof typeof valores, valor: string) => { setValores((v) => ({ ...v, [campo]: valor })); setError(null) }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    setEnviando(true)
    const resultado = await actualizarPerfil(valores)
    setEnviando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onGuardado('Perfil actualizado')
  }

  return (
    <Seccion titulo="Perfil" descripcion="Así aparece su nombre en el menú y el encabezado." icono={UserRound}>
      <form onSubmit={enviar} noValidate className="space-y-4">
        <ErrorFormulario mensaje={error} />
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-800 text-lg font-semibold text-white">{usuario.iniciales}</div>
          <div className="min-w-0">
            <p className="font-medium text-stone-900 truncate">{usuario.nombre}</p>
            <p className="text-sm text-stone-500 truncate">{usuario.correo}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre completo" htmlFor="cuenta-nombre" requerido className="sm:col-span-2">
            <input id="cuenta-nombre" value={valores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} className={claseInput} autoComplete="name" />
          </Campo>
          <Campo etiqueta="Cargo" htmlFor="cuenta-cargo">
            <input id="cuenta-cargo" value={valores.cargo} onChange={(e) => cambiar('cargo', e.target.value)} className={claseInput} placeholder="Administrador" />
          </Campo>
          <Campo etiqueta="Teléfono" htmlFor="cuenta-telefono">
            <input id="cuenta-telefono" type="tel" value={valores.telefono} onChange={(e) => cambiar('telefono', e.target.value)} className={claseInput} autoComplete="tel" />
          </Campo>
          <Campo etiqueta="Correo electrónico" htmlFor="cuenta-correo" ayuda="Es su usuario para iniciar sesión; no se puede cambiar aquí." className="sm:col-span-2">
            <input id="cuenta-correo" value={usuario.correo} disabled className={`${claseInput} bg-stone-50 text-stone-500`} />
          </Campo>
        </div>
        <div className="flex justify-end border-t border-stone-200 pt-4">
          <button type="submit" disabled={enviando} className={claseBotonPrimario}>{enviando ? 'Guardando...' : 'Guardar perfil'}</button>
        </div>
      </form>
    </Seccion>
  )
}

function Contrasena({ onGuardado }: { onGuardado: (mensaje: string) => void }) {
  const vacio = { actual: '', nueva: '', confirmacion: '' }
  const [valores, setValores] = useState(vacio)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const cambiar = (campo: keyof typeof valores, valor: string) => { setValores((v) => ({ ...v, [campo]: valor })); setError(null) }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    if (!valores.actual) { setError('Escriba su contraseña actual.'); return }
    if (valores.nueva !== valores.confirmacion) { setError('La confirmación no coincide con la nueva contraseña.'); return }
    setEnviando(true)
    const resultado = await cambiarContrasena(valores.actual, valores.nueva)
    setEnviando(false)
    if (!resultado.ok) { setError(resultado.error); return }
    setValores(vacio)
    onGuardado('Contraseña actualizada')
  }

  return (
    <Seccion titulo="Contraseña" descripcion="Use al menos 8 caracteres. Se pide la actual para confirmar que es usted." icono={KeyRound}>
      <form onSubmit={enviar} noValidate className="space-y-4">
        <ErrorFormulario mensaje={error} />
        <Campo etiqueta="Contraseña actual" htmlFor="clave-actual" requerido>
          <input id="clave-actual" type="password" value={valores.actual} onChange={(e) => cambiar('actual', e.target.value)} className={claseInput} autoComplete="current-password" />
        </Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nueva contraseña" htmlFor="clave-nueva" requerido>
            <input id="clave-nueva" type="password" value={valores.nueva} onChange={(e) => cambiar('nueva', e.target.value)} className={claseInput} autoComplete="new-password" />
          </Campo>
          <Campo etiqueta="Confirmar nueva contraseña" htmlFor="clave-confirmacion" requerido>
            <input id="clave-confirmacion" type="password" value={valores.confirmacion} onChange={(e) => cambiar('confirmacion', e.target.value)} className={claseInput} autoComplete="new-password" />
          </Campo>
        </div>
        <div className="flex justify-end border-t border-stone-200 pt-4">
          <button type="submit" disabled={enviando} className={claseBotonPrimario}>{enviando ? 'Guardando...' : 'Cambiar contraseña'}</button>
        </div>
      </form>
    </Seccion>
  )
}

function Sesiones({ usuario, onAccion }: { usuario: Usuario; onAccion: (mensaje: string) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const cerrarOtras = async () => {
    setOcupado(true)
    const resultado = await cerrarOtrasSesiones()
    setOcupado(false)
    if (!resultado.ok) { setError(resultado.error); return }
    onAccion('Se cerraron las sesiones de otros dispositivos')
  }

  return (
    <Seccion titulo="Sesiones" descripcion="Sin sesión no se puede abrir ninguna página del ERP." icono={MonitorSmartphone}>
      <ErrorFormulario mensaje={error} />
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-stone-500">Último inicio de sesión</dt>
          <dd className="text-sm font-medium text-stone-900 mt-0.5">
            {usuario.ultimoAcceso ? `${formatoFecha(usuario.ultimoAcceso)} ${new Date(usuario.ultimoAcceso).toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit' })}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-stone-500">Cuenta creada</dt>
          <dd className="text-sm font-medium text-stone-900 mt-0.5">{formatoFecha(usuario.creadoEn)}</dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-col gap-2 border-t border-stone-200 pt-4 sm:flex-row sm:justify-end">
        <button type="button" onClick={cerrarOtras} disabled={ocupado} className={claseBotonSecundario}>
          <MonitorSmartphone size={16} />
          Cerrar sesión en otros dispositivos
        </button>
        <button type="button" onClick={cerrarSesion} className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition">
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>
    </Seccion>
  )
}
