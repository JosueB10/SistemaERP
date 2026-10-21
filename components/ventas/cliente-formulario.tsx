'use client'

import { useState } from 'react'

import { guardarCliente } from '@/lib/ventas/store'
import type { Cliente } from '@/lib/ventas/tipos'
import { Campo, claseInput, ErrorFormulario, PieFormulario } from '../inventario/ui'

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Errores = Partial<Record<'nombre' | 'correo', string>>

export default function ClienteFormulario({
  cliente,
  onCancelar,
  onGuardado
}: {
  cliente?: Cliente
  onCancelar: () => void
  onGuardado: (mensaje: string, id: string) => void
}) {
  const [valores, setValores] = useState({
    nombre: cliente?.nombre ?? '',
    identificacion: cliente?.identificacion ?? '',
    telefono: cliente?.telefono ?? '',
    correo: cliente?.correo ?? '',
    direccion: cliente?.direccion ?? '',
    notas: cliente?.notas ?? ''
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
    const resultado = await guardarCliente(valores, cliente?.id)
    setEnviando(false)
    if (!resultado.ok) { setErrorGeneral(resultado.error); return }
    onGuardado(cliente ? 'Cliente actualizado' : 'Cliente registrado', resultado.id ?? '')
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-5">
      <ErrorFormulario mensaje={errorGeneral} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre o razón social" htmlFor="cliente-nombre" error={errores.nombre} requerido className="sm:col-span-2">
          <input id="cliente-nombre" value={valores.nombre} onChange={(e) => cambiar('nombre', e.target.value)} maxLength={150} className={claseInput} />
        </Campo>
        <Campo etiqueta="Cédula o RUC" htmlFor="cliente-identificacion">
          <input id="cliente-identificacion" value={valores.identificacion} onChange={(e) => cambiar('identificacion', e.target.value)} maxLength={30} className={claseInput} />
        </Campo>
        <Campo etiqueta="Teléfono" htmlFor="cliente-telefono">
          <input id="cliente-telefono" type="tel" value={valores.telefono} onChange={(e) => cambiar('telefono', e.target.value)} maxLength={30} className={claseInput} />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="cliente-correo" error={errores.correo} className="sm:col-span-2">
          <input id="cliente-correo" type="email" value={valores.correo} onChange={(e) => cambiar('correo', e.target.value)} maxLength={150} className={claseInput} />
        </Campo>
        <Campo etiqueta="Dirección" htmlFor="cliente-direccion" className="sm:col-span-2">
          <input id="cliente-direccion" value={valores.direccion} onChange={(e) => cambiar('direccion', e.target.value)} className={claseInput} />
        </Campo>
        <Campo etiqueta="Notas" htmlFor="cliente-notas" className="sm:col-span-2">
          <textarea id="cliente-notas" rows={2} value={valores.notas} onChange={(e) => cambiar('notas', e.target.value)} placeholder="Preferencias, diseños habituales..." className={`${claseInput} h-auto py-2 resize-none`} />
        </Campo>
      </div>

      <PieFormulario onCancelar={onCancelar} textoGuardar={cliente ? 'Guardar cambios' : 'Registrar cliente'} enviando={enviando} />
    </form>
  )
}
