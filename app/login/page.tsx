'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Solo se vuelve a rutas internas, nunca a otro sitio (?siguiente=//sitio-externo)
function destinoSeguro() {
  const siguiente = new URLSearchParams(window.location.search).get('siguiente')
  return siguiente && siguiente.startsWith('/') && !siguiente.startsWith('//') && !siguiente.startsWith('/login') ? siguiente : '/dashboard'
}

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  async function iniciarSesion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    setEnviando(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setEnviando(false)
    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Correo o contraseña incorrectos.'
        : `No se pudo iniciar sesión: ${authError.message}`)
      return
    }
    router.replace(destinoSeguro())
  }

  async function recuperarContrasena() {
    setError(null)
    setAviso(null)
    if (!email.trim()) {
      setError('Escribe tu correo arriba y vuelve a pulsar «¿Olvidaste tu contraseña?».')
      return
    }
    setEnviando(true)
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login/restablecer`
    })
    setEnviando(false)
    if (authError) {
      setError(`No se pudo enviar el correo: ${authError.message}`)
      return
    }
    setAviso(`Si ${email.trim()} tiene una cuenta, recibirá un enlace para crear una nueva contraseña.`)
  }

  return (
    <main className="min-h-dvh grid lg:grid-cols-2 bg-white">

      {/* Marca */}
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center">
            <span className="text-zinc-950 font-semibold">N</span>
          </div>
          <span className="font-semibold text-lg">NeumoPad</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            Toda la operación del taller, en un solo lugar.
          </h1>
          <p className="mt-4 text-zinc-400">
            Ventas, inventario, producción, compras, finanzas y personal conectados entre sí.
          </p>
        </div>

        <p className="relative text-xs text-zinc-500">
          © 2026 NeumoPad. Sistema administrativo.
        </p>
      </section>

      {/* Formulario */}
      <section className="flex items-center justify-center px-6 py-12 bg-zinc-50 lg:bg-white">
        <div className="w-full max-w-sm">

          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <div className="w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-semibold">N</span>
            </div>
            <span className="font-semibold text-lg text-zinc-900">NeumoPad</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Iniciar sesión
            </h2>

            <p className="text-sm text-zinc-500 mt-1.5">
              Ingresa tus credenciales para continuar
            </p>
          </div>

          <form className="space-y-5" onSubmit={iniciarSesion}>

            {/* Correo */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 mb-1.5"
              >
                Correo electrónico
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />

                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(evento) => setEmail(evento.target.value)}
                  placeholder="correo@ejemplo.com"
                  className={`${claseCampo} pr-4`}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Contraseña
                </label>

                <button
                  type="button"
                  onClick={recuperarContrasena}
                  disabled={enviando}
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900 disabled:opacity-60"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="relative">
                <LockKeyhole
                  size={17}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
                />

                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(evento) => setPassword(evento.target.value)}
                  placeholder="Tu contraseña"
                  className={`${claseCampo} pr-11`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            {aviso && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{aviso}</p>}

            {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={enviando}
              className="flex items-center justify-center w-full h-11 rounded-lg bg-zinc-900 text-white text-sm font-medium shadow-xs hover:bg-zinc-800 active:scale-[0.99] transition disabled:opacity-60"
            >
              {enviando ? 'Validando…' : 'Iniciar sesión'}
            </button>

          </form>

          <p className="text-center text-xs text-zinc-400 mt-10 lg:hidden">
            © 2026 NeumoPad. Sistema administrativo.
          </p>
        </div>
      </section>
    </main>
  )
}

const claseCampo =
  'w-full h-11 pl-10 rounded-lg bg-white border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-xs outline-none hover:border-zinc-300 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition'
