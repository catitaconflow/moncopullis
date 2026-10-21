import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const faltanVariables = !url || !anonKey

export const MENSAJE_CONFIG =
  'Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Crea panel/.env.local a partir de .env.example y reinicia el servidor.'

let cliente: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error(MENSAJE_CONFIG)
  cliente ??= createClient(url, anonKey)
  return cliente
}
