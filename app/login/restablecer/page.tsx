'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { LockKeyhole } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Destino del enlace de "¿Olvidaste tu contraseña?": el enlace abre una sesión temporal de recuperación
export default function RestablecerPage() {
  const [listo, setListo] = useState<boolean | null>(null)
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setListo(Boolean(data.session)))
    const { data } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (evento === 'PASSWORD_RECOVERY' || sesion) setListo(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setError(null)
    if (nueva.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (nueva !== confirmacion) { setError('Las contraseñas no coinciden.'); return }
    setEnviando(true)
    const { error: authError } = await supabase.auth.updateUser({ password: nueva })
    setEnviando(false)
    if (authError) { setError(`No se pudo cambiar la contraseña: ${authError.message}`); return }
    window.location.replace('/dashboard')
  }

  return (
    <main className="min-h-dvh bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-8">
        <div className="w-9 h-9 mb-6 bg-zinc-900 rounded-lg flex items-center justify-center">
          <span className="text-white font-semibold">N</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Nueva contraseña</h1>
        {listo === false ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-zinc-600">El enlace no es válido o ya venció. Solicita uno nuevo desde el inicio de sesión.</p>
            <Link href="/login" className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition">Volver al login</Link>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={guardar}>
            <CampoClave id="nueva" etiqueta="Nueva contraseña" valor={nueva} onCambio={setNueva} />
            <CampoClave id="confirmacion" etiqueta="Confirmar contraseña" valor={confirmacion} onCambio={setConfirmacion} />
            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={enviando || !listo} className="flex items-center justify-center w-full h-11 rounded-lg bg-zinc-900 text-white text-sm font-medium shadow-xs hover:bg-zinc-800 transition disabled:opacity-60">
              {enviando ? 'Guardando…' : listo === null ? 'Validando enlace…' : 'Guardar contraseña'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}

function CampoClave({ id, etiqueta, valor, onCambio }: { id: string; etiqueta: string; valor: string; onCambio: (valor: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700 mb-1.5">{etiqueta}</label>
      <div className="relative">
        <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        <input
          id={id}
          type="password"
          required
          autoComplete="new-password"
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          className="w-full h-11 pl-10 pr-4 rounded-lg bg-white border border-zinc-200 text-sm text-zinc-900 shadow-xs outline-none hover:border-zinc-300 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition"
        />
      </div>
    </div>
  )
}
