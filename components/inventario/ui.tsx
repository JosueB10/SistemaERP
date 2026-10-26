'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Search,
  X
} from 'lucide-react'

import type { EstadoStock, TipoMovimiento } from '@/lib/inventario/tipos'
import { ETIQUETAS_ESTADO, ETIQUETAS_MOVIMIENTO } from '@/lib/inventario/utilidades'
import { useErrorInventario } from '@/lib/inventario/store'

export function AvisoConexion() {
  const error = useErrorInventario()
  if (!error) return null
  return <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Revisa la conexión de Supabase y que hayas aplicado la migración SQL del proyecto.</div>
}

// ---------- Clases compartidas ----------

export const claseInput =
  'w-full h-10 px-3 rounded-lg bg-white border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-xs outline-none hover:border-zinc-300 focus:border-zinc-400 focus:ring-4 focus:ring-zinc-900/5 transition disabled:bg-zinc-50 disabled:text-zinc-500'

export const claseBotonPrimario =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-zinc-900 text-white text-sm font-medium shadow-xs hover:bg-zinc-800 active:scale-[0.98] transition disabled:opacity-50 disabled:active:scale-100'

export const claseBotonSecundario =
  'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-white border border-zinc-200 text-zinc-700 text-sm font-medium shadow-xs hover:bg-zinc-50 hover:text-zinc-900 active:scale-[0.98] transition'

export const claseBotonTabla =
  'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition'

export const claseTarjeta = 'bg-white border border-zinc-200/80 rounded-2xl shadow-xs'

// ---------- Encabezado ----------

export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  migas = true,
  seccion = { etiqueta: 'Inventario', href: '/inventario' }
}: {
  titulo: string
  descripcion: string
  acciones?: React.ReactNode
  migas?: boolean
  seccion?: { etiqueta: string; href: string }
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {migas && (
          <nav className="text-xs text-zinc-400 mb-2">
            <Link href={seccion.href} className="hover:text-zinc-700">
              {seccion.etiqueta}
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-zinc-600">{titulo}</span>
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{titulo}</h1>
        <p className="text-sm text-zinc-500 mt-1">{descripcion}</p>
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

// ---------- Indicadores ----------

const tonosIndicador = {
  neutro: 'bg-zinc-100 text-zinc-700',
  positivo: 'bg-emerald-50 text-emerald-700',
  alerta: 'bg-amber-50 text-amber-700',
  peligro: 'bg-red-50 text-red-700'
}

export function TarjetaIndicador({
  titulo,
  valor,
  detalle,
  icono: Icono,
  tono = 'neutro'
}: {
  titulo: string
  valor: string
  detalle: string
  icono: React.ElementType
  tono?: keyof typeof tonosIndicador
}) {
  return (
    <div className={`${claseTarjeta} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-zinc-500">{titulo}</p>
          <p className="text-2xl font-semibold tracking-tight text-zinc-900 mt-1.5 truncate tabular-nums">{valor}</p>
        </div>
        <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${tonosIndicador[tono]}`}>
          <Icono size={17} />
        </div>
      </div>
      <p className="text-xs text-zinc-400 mt-3">{detalle}</p>
    </div>
  )
}

// ---------- Insignias ----------

const estilosEstado: Record<EstadoStock, string> = {
  disponible: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  stock_bajo: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  agotado: 'bg-red-50 text-red-700 ring-red-600/20'
}

export function InsigniaEstado({ estado }: { estado: EstadoStock }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${estilosEstado[estado]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {ETIQUETAS_ESTADO[estado]}
    </span>
  )
}

const estilosMovimiento: Record<TipoMovimiento, string> = {
  entrada: 'bg-emerald-50 text-emerald-700',
  salida: 'bg-zinc-100 text-zinc-700',
  ajuste: 'bg-sky-50 text-sky-700'
}

export function InsigniaMovimiento({ tipo }: { tipo: TipoMovimiento }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${estilosMovimiento[tipo]}`}>
      {ETIQUETAS_MOVIMIENTO[tipo]}
    </span>
  )
}

export function InsigniaNeutra({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-xs font-medium whitespace-nowrap">
      {children}
    </span>
  )
}

export function useNotificacion() {
  const [mensaje, setMensaje] = useState<string | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  const mostrar = (texto: string) => {
    if (temporizador.current) clearTimeout(temporizador.current)
    setMensaje(texto)
    temporizador.current = setTimeout(() => setMensaje(null), 3500)
  }

  return { mensaje, mostrar }
}

export function Notificacion({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null
  return (
    <div
      role="status"
      className="animate-aparecer fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-xl shadow-zinc-900/20"
    >
      <CheckCircle2 size={18} className="text-emerald-400" />
      {mensaje}
    </div>
  )
}

// ---------- Modal ----------

export function Modal({
  abierto,
  titulo,
  descripcion,
  onCerrar,
  children,
  ancho = 'max-w-2xl'
}: {
  abierto: boolean
  titulo: string
  descripcion?: string
  onCerrar: () => void
  children: React.ReactNode
  ancho?: string
}) {
  useEffect(() => {
    if (!abierto) return
    const alPresionar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', alPresionar)
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = overflowAnterior
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-[2px]" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        className={`animate-aparecer relative w-full ${ancho} max-h-[92vh] overflow-y-auto overscroll-contain bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-zinc-900/10 ring-1 ring-zinc-900/5`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-100 bg-white/95 backdrop-blur px-6 py-4">
          <div>
            <h2 id="modal-titulo" className="text-base font-semibold tracking-tight text-zinc-900">
              {titulo}
            </h2>
            {descripcion && <p className="text-xs text-zinc-500 mt-1">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="-mr-1.5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ---------- Formularios ----------

export function Campo({
  etiqueta,
  htmlFor,
  error,
  ayuda,
  requerido,
  className = '',
  children
}: {
  etiqueta: string
  htmlFor: string
  error?: string
  ayuda?: string
  requerido?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-zinc-700 mb-1.5">
        {etiqueta}
        {requerido && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : (
        ayuda && <p className="text-xs text-zinc-400 mt-1">{ayuda}</p>
      )}
    </div>
  )
}

export function ErrorFormulario({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {mensaje}
    </div>
  )
}

export function PieFormulario({
  onCancelar,
  textoGuardar,
  enviando = false,
  deshabilitado = false
}: {
  onCancelar: () => void
  textoGuardar: string
  enviando?: boolean
  deshabilitado?: boolean
}) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-zinc-100 pt-4 sm:flex-row sm:justify-end">
      <button type="button" onClick={onCancelar} className={claseBotonSecundario}>
        Cancelar
      </button>
      <button type="submit" disabled={enviando || deshabilitado} className={claseBotonPrimario}>
        {enviando ? 'Guardando...' : textoGuardar}
      </button>
    </div>
  )
}

// ---------- Detalle por URL ----------
// El artículo abierto se refleja en ?detalle=<id> para poder enlazarlo desde otras páginas.

export function useDetalleEnUrl() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return {
    detalleId: searchParams.get('detalle'),
    abrirDetalle: (id: string) =>
      router.push(`${pathname}?detalle=${encodeURIComponent(id)}`, { scroll: false }),
    cerrarDetalle: () => router.replace(pathname, { scroll: false })
  }
}

// ---------- Tablas ----------

export function Buscador({
  valor,
  onCambio,
  placeholder
}: {
  valor: string
  onCambio: (valor: string) => void
  placeholder: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={valor}
        onChange={(evento) => onCambio(evento.target.value)}
        placeholder={placeholder}
        className={`${claseInput} pl-9`}
        aria-label={placeholder}
      />
    </div>
  )
}

export function Paginacion({
  pagina,
  totalPaginas,
  totalElementos,
  onCambiar
}: {
  pagina: number
  totalPaginas: number
  totalElementos: number
  onCambiar: (pagina: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
      <span>
        {totalElementos} {totalElementos === 1 ? 'registro' : 'registros'}
      </span>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCambiar(pagina - 1)}
            disabled={pagina <= 1}
            className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Página {pagina} de {totalPaginas}
          </span>
          <button
            type="button"
            onClick={() => onCambiar(pagina + 1)}
            disabled={pagina >= totalPaginas}
            className="p-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 disabled:opacity-40"
            aria-label="Página siguiente"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

export function usePaginacion<T>(elementos: T[], tamanoPagina: number) {
  const [paginaSolicitada, setPagina] = useState(1)
  const totalPaginas = Math.max(1, Math.ceil(elementos.length / tamanoPagina))
  // Si los filtros reducen los resultados, se ajusta a la última página disponible
  const pagina = Math.min(paginaSolicitada, totalPaginas)
  const visibles = elementos.slice((pagina - 1) * tamanoPagina, pagina * tamanoPagina)
  return { pagina, totalPaginas, visibles, setPagina }
}

export function EstadoVacio({
  titulo,
  descripcion,
  icono: Icono
}: {
  titulo: string
  descripcion?: string
  icono: React.ElementType
}) {
  return (
    <div className="py-14 text-center px-4">
      <div className="w-11 h-11 bg-zinc-50 ring-1 ring-zinc-200/80 rounded-xl flex items-center justify-center mx-auto mb-3">
        <Icono size={22} className="text-zinc-400" />
      </div>
      <p className="text-sm font-medium text-zinc-700">{titulo}</p>
      {descripcion && <p className="text-xs text-zinc-400 mt-1">{descripcion}</p>}
    </div>
  )
}

export const claseCabeceraTabla =
  'px-4 py-2.5 text-left text-xs font-medium text-zinc-500 whitespace-nowrap'

export const claseCeldaTabla = 'px-4 py-3 text-sm text-zinc-700 whitespace-nowrap'
