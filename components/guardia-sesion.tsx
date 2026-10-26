'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

import { useSesionVerificada, useUsuario } from '@/lib/cuenta/sesion'

// Segunda barrera tras proxy.ts: si la sesión se cierra (en otra pestaña o porque venció)
// o se vuelve con "Atrás" después de salir, se manda al login sin mostrar datos.
export default function GuardiaSesion({ children }: { children: React.ReactNode }) {
  const usuario = useUsuario()
  const verificada = useSesionVerificada()
  const ruta = usePathname()

  useEffect(() => {
    if (verificada && !usuario) window.location.replace(`/login?siguiente=${encodeURIComponent(ruta)}`)
  }, [verificada, usuario, ruta])

  if (!verificada || !usuario) {
    return (
      <div className="min-h-screen bg-[#f5f3f0] flex items-center justify-center">
        <p className="text-sm text-stone-500">Verificando sesión…</p>
      </div>
    )
  }
  return <>{children}</>
}
