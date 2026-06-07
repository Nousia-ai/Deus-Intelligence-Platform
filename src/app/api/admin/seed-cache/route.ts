/**
 * /api/admin/seed-cache
 *
 * GET  — diagnóstico: estado de la conexión y del caché actual
 * POST — fuerza recomputo desde CSV y escribe resultado en Supabase
 *
 * Usar POST siempre que los datos cambien (nuevos CSVs, ETL ERP, etc.).
 * Ejemplo: curl -X POST https://tu-dominio.vercel.app/api/admin/seed-cache
 */
import { NextResponse } from "next/server"
import { computeDashboardSummary, invalidateDashboardCache, setSupabaseCache } from "@/lib/analytics"
import { supabase, isSupabaseReady } from "@/lib/supabase"

export async function GET() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  const envStatus = {
    supabase_url_set: !!url,
    supabase_url_prefix: url ? url.slice(0, 35) + "…" : null,
    service_role_set: !!key,
    client_initialized: isSupabaseReady(),
  }

  let cache: Record<string, unknown> | null = null
  if (supabase) {
    const { data, error } = await supabase
      .from("dashboard_cache")
      .select("id, computed_at, source, row_count")
      .eq("id", 1)
      .maybeSingle()
    cache = error
      ? { error: error.message }
      : data
        ? { computed_at: data.computed_at, source: data.source, row_count: data.row_count }
        : null
  }

  return NextResponse.json({ env: envStatus, cache })
}

export async function POST() {
  if (!isSupabaseReady()) {
    return NextResponse.json(
      { error: "Supabase no configurado — verificar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    )
  }

  const t0 = Date.now()

  try {
    // 1. Limpiar módulo cache para forzar relectura del CSV
    await invalidateDashboardCache()

    // 2. Computar desde CSV (tarda ~15-17 s con el CSV actual de 70 MB)
    console.log("[seed-cache] Computando desde CSV…")
    const summary = computeDashboardSummary()

    // 3. Escribir en Supabase (awaited — necesitamos la confirmación)
    await setSupabaseCache(summary, "csv")

    const duration = Date.now() - t0
    console.log(`[seed-cache] OK en ${duration} ms`)

    return NextResponse.json({
      ok: true,
      duration_ms: duration,
      totalRevenue: summary.totalRevenue,
      years: summary.availableYears,
      branches: summary.availableBranches.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[seed-cache] ERROR:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// Asegurar runtime Node.js (no Edge) — necesario para leer el CSV del filesystem
export const runtime = "nodejs"
export const maxDuration = 60 // segundos (requiere Vercel Pro para > 10 s)
