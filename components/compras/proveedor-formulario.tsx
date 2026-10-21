'use client'

import { useState } from 'react'

import { guardarProveedor } from '@/lib/compras/store'
import type { Proveedor } from '@/lib/compras/tipos'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Errores = Partial<Record<'nombre' | 'correo', string>>

export default function ProveedorFormulario({
  proveedor,
  onCancelar,
  onGuardado
}: {
  proveedor?: Proveedor
  onCancelar: () => void
  onGuardado: (mensaje: string, id: string) => void
}) {
  const [valores, setValores] = useState({
    nombre: proveedor?.nombre ?? '',
    ruc: proveedor?.ruc ?? '',
    contacto: proveedor?.contacto ?? '',
    telefono: proveedor?.telefono ?? '',
    correo: proveedor?.correo ?? '',
    direccion: proveedor?.direccion ?? '',
    notas: proveedor?.notas ?? ''
  })
  const [errores, setErrores] = useState<Errores>({})
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const cambiar = (campo: keyof typeof valores, valor: string) => {
    setValores((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo]: undefined }))
    setErrorGeneral(null)
  }

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault()
    const nuevosErrores: Errores = {}
    if (!valores.nombre.trim()) nuevosErrores.nombre = 'El nombre es obligatorio.'
    if (valores.correo.trim() && !PATRON_CORREO.test(valores.correo.trim())) nuevosErrores.correo = 'Correo no válido.'
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    setEnviando(true)
    const resultado = await guardarProveedor(valores, proveedor?.id)
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(proveedor ? 'Proveedor actualizado' : 'Proveedor registrado', resultado.id ?? '')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre o razón social" htmlFor="proveedor-nombre" error={errores.nombre} requerido className="sm:col-span-2">
          <input id="proveedor-nombre" value={valores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} maxLength={150} className={claseInput} />
        </Campo>
        <Campo etiqueta="RUC" htmlFor="proveedor-ruc">
          <input id="proveedor-ruc" value={valores.ruc} onChange={(e) => cambiar('ruc', e.target.value)} maxLength={30} className={claseInput} />
        </Campo>
        <Campo etiqueta="Persona de contacto" htmlFor="proveedor-contacto">
          <input id="proveedor-contacto" value={valores.contacto} onChange={(e) => cambiar('contacto', e.target.value)} maxLength={150} className={claseInput} />
        </Campo>
        <Campo etiqueta="Teléfono" htmlFor="proveedor-telefono">
          <input id="proveedor-telefono" type="tel" value={valores.telefono} onChange={(e) => cambiar('telefono', e.target.value)} maxLength={30} className={claseInput} />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="proveedor-correo" error={errores.correo}>
          <input id="proveedor-correo" type="email" value={valores.correo} onChange={(e) => cambiar('correo', e.target.value)} maxLength={150} className={claseInput} />
        </Campo>
        <Campo etiqueta="Dirección" htmlFor="proveedor-direccion" className="sm:col-span-2">
          <input id="proveedor-direccion" value={valores.direccion} onChange={(e) => cambiar('direccion', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Notas" htmlFor="proveedor-notas" className="sm:col-span-2">
          <textarea id="proveedor-notas" rows={2} value={valores.notas} onChange={(e) => cambiar('notas', e.target.value)} placeholder="Materiales que provee, condiciones de pago, tiempos de entrega..." className={`${claseInput} h-auto py-2 resize-none`} />
        </Campo>
      </div>

      <PieFormulario onCancelar={onCancelar} textoGuardar={proveedor ? 'Guardar cambios' : 'Registrar proveedor'} enviando={enviando} />
    </form>
  )
}
