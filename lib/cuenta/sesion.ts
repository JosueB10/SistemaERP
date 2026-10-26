'use client'

import { useEffect, useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { ResultadoAccion } from '../inventario/tipos'

// Usuario de la sesión actual, compartido por el encabezado, el menú y la página de cuenta

export interface Usuario {
  id: string
  correo: string
  nombre: string
  cargo: string
  telefono: string
  iniciales: string
  ultimoAcceso?: string
  creadoEn: string
}

let usuario: Usuario | null = null
let verificado = false
const suscriptores = new Set<() => void>()
function notificar() { suscriptores.forEach((f) => f()) }
function suscribir(f: () => void) { suscriptores.add(f); return () => suscriptores.delete(f) }

const texto = (v: unknown) => typeof v === 'string' ? v.trim() : ''

function mapUsuario(u: User | null): Usuario | null {
  if (!u) return null
  const correo = u.email ?? ''
  const nombre = texto(u.user_metadata?.nombre) || correo.split('@')[0] || 'Usuario'
  const iniciales = nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || 'U'
  return {
    id: u.id,
    correo,
    nombre,
    cargo: texto(u.user_metadata?.cargo) || 'Administrador',
    telefono: texto(u.user_metadata?.telefono),
    iniciales,
    ultimoAcceso: u.last_sign_in_at ?? undefined,
    creadoEn: u.created_at
  }
}

let escuchando = false
function escucharSesion() {
  if (escuchando) return
  escuchando = true
  supabase.auth.getUser().then(({ data }) => {
    usuario = mapUsuario(data.user)
    verificado = true
    notificar()
  })
  supabase.auth.onAuthStateChange((_evento, sesion) => {
    usuario = mapUsuario(sesion?.user ?? null)
    verificado = true
    notificar()
  })
}

export function useUsuario(): Usuario | null {
  useEffect(escucharSesion, [])
  return useSyncExternalStore(suscribir, () => usuario, () => null)
}

// false mientras aún no se sabe si hay sesión
export function useSesionVerificada(): boolean {
  useEffect(escucharSesion, [])
  return useSyncExternalStore(suscribir, () => verificado, () => false)
}

export async function cerrarSesion(): Promise<void> {
  await supabase.auth.signOut()
  // Recarga completa para limpiar los datos en memoria de todos los módulos
  window.location.replace('/login')
}

export async function actualizarPerfil(e: { nombre: string; cargo: string; telefono: string }): Promise<ResultadoAccion> {
  if (!e.nombre.trim()) return { ok: false, error: 'El nombre es obligatorio.' }
  const { error } = await supabase.auth.updateUser({ data: { nombre: e.nombre.trim(), cargo: e.cargo.trim(), telefono: e.telefono.trim() } })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function cambiarContrasena(actual: string, nueva: string): Promise<ResultadoAccion> {
  if (!usuario) return { ok: false, error: 'No hay una sesión activa.' }
  if (nueva.length < 8) return { ok: false, error: 'La nueva contraseña debe tener al menos 8 caracteres.' }
  if (nueva === actual) return { ok: false, error: 'La nueva contraseña debe ser distinta de la actual.' }
  // Se confirma la contraseña actual antes de cambiarla
  const verificacion = await supabase.auth.signInWithPassword({ email: usuario.correo, password: actual })
  if (verificacion.error) return { ok: false, error: 'La contraseña actual no es correcta.' }
  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (!error) return { ok: true }
  return { ok: false, error: error.message.includes('different from the old') ? 'La nueva contraseña debe ser distinta de la actual.' : error.message }
}

export async function cerrarOtrasSesiones(): Promise<ResultadoAccion> {
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  return error ? { ok: false, error: error.message } : { ok: true }
}
