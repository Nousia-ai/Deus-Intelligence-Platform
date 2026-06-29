/**
 * Supabase server-side client (service role key).
 *
 * ⚠️  NUNCA importar en Client Components — este módulo es server-only.
 *
 * Retorna `null` si las variables de entorno no están configuradas,
 * permitiendo un fallback seguro al CSV local durante desarrollo.
 *
 * Workaround Windows: en dev, las vars de sistema sobreescriben process.env
 * antes de que Next.js cargue .env.local. Leemos el archivo directamente
 * para garantizar que .env.local siempre gane.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

function readFromEnvLocal(key: string): string | undefined {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8")
    const match = raw.match(new RegExp(`^${key}=(.+)$`, "m"))
    return match?.[1]?.trim()
  } catch {
    return undefined
  }
}

const url = readFromEnvLocal("SUPABASE_URL") ?? process.env.SUPABASE_URL
const key = readFromEnvLocal("SUPABASE_SERVICE_ROLE_KEY") ?? process.env.SUPABASE_SERVICE_ROLE_KEY

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
