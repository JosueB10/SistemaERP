import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas que se pueden abrir sin haber iniciado sesión
const RUTAS_PUBLICAS = ['/login']

// Antes de servir cualquier página se valida la sesión con Supabase: sin sesión todo redirige al login
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          respuesta = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options))
        }
      }
    }
  )

  // getUser() consulta a Supabase: una cookie falsificada o vencida no pasa
  const { data: { user } } = await supabase.auth.getUser()
  const ruta = request.nextUrl.pathname
  const publica = RUTAS_PUBLICAS.some((r) => ruta === r || ruta.startsWith(`${r}/`))

  if (!user && !publica) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.search = ruta === '/' ? '' : `?siguiente=${encodeURIComponent(ruta + request.nextUrl.search)}`
    return conCookies(NextResponse.redirect(destino), respuesta)
  }

  // Con sesión el login no tiene sentido; restablecer contraseña sí se permite
  if (user && (ruta === '/login' || ruta === '/')) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/dashboard'
    destino.search = ''
    return conCookies(NextResponse.redirect(destino), respuesta)
  }

  // Las páginas privadas no se guardan en caché: al cerrar sesión, "Atrás" no muestra datos
  if (!publica) respuesta.headers.set('Cache-Control', 'private, no-store')
  return respuesta
}

// Conserva las cookies de sesión renovadas al redirigir
function conCookies(redireccion: NextResponse, origen: NextResponse) {
  origen.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie))
  return redireccion
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)']
}
