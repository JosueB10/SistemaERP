import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// La sesión se guarda en cookies para que proxy.ts pueda bloquear las rutas sin sesión
export const supabase = createBrowserClient(
  supabaseUrl,
  supabaseAnonKey
)
