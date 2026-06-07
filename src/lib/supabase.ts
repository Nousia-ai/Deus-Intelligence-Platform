/**
 * Supabase server-side client (service role key).
 *
 * ⚠️  NUNCA importar en Client Components — este módulo es server-only.
 *
 * Retorna `null` si las variables de entorno no están configuradas,
 * permitiendo un fallback seguro al CSV local durante desarrollo.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null

/** Devuelve true si Supabase está configurado y disponible */
export const isSupabaseReady = (): boolean => supabase !== null
