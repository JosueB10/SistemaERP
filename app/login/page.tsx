'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        
        {/* Logo / Marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">N</span>
          </div>

          <h1 className="text-3xl font-bold text-neutral-900">
            NeumoPad
          </h1>

          <p className="text-neutral-500 mt-2">
            Sistema de gestión empresarial
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
          
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Iniciar sesión
            </h2>

            <p className="text-sm text-neutral-500 mt-1">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          <form className="space-y-5">
            
            {/* Correo */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Correo electrónico
              </label>

              <div className="relative">
                <Mail
                  size={19}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />

                <input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  className="w-full h-11 pl-10 pr-4 rounded-lg border border-stone-300 outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 text-sm"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-neutral-700 mb-2"
              >
                Contraseña
              </label>

              <div className="relative">
                <LockKeyhole
                  size={19}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
                />

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-11 rounded-lg border border-stone-300 outline-none focus:border-neutral-700 focus:ring-1 focus:ring-neutral-700 text-sm"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* Recuperar contraseña */}
            <div className="text-right">
              <button
                type="button"
                className="text-sm text-neutral-600 hover:text-neutral-900"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {/* Botón */}
            <Link
              href="/dashboard"
              className="flex items-center justify-center w-full h-11 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition"
            >
              Iniciar sesión
            </Link>

          </form>
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          © 2026 NeumoPad. Sistema administrativo.
        </p>
      </div>
    </main>
  )
}