/**
 * POST /api/carga/revert
 *
 * Revierte una carga de ventas eliminando todas las filas de ventas_lineas
 * asociadas al etl_run_id indicado, y marca el registro en etl_log como "reverted".
 *
 * Solo funciona para cargas exitosas (status = "success") de ventas.
 * Las cargas de inventario (kardex) no son reversibles por este endpoint
 * porque usan upsert sin etl_run_id en inventory_kpis.
 *
 * Body: { etl_run_id: number }
 * Response: { ok, rows_deleted }
 */

import { NextResponse } from "next/server"
import { supabase, isSupabaseReady } from "@/lib/supabase"
import { invalidateDashboardCache } from "@/lib/analytics"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!isSupabaseReady()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Body JSON inválido" }, { status: 400 })
  }

  const etlRunId = (body as Record<string, unknown>)?.etl_run_id
  if (typeof etlRunId !== "number" || !Number.isInteger(etlRunId) || etlRunId <= 0) {
    return NextResponse.json({ error: "etl_run_id debe ser un entero positivo" }, { status: 400 })
  }

  // Verificar que el registro existe y está en estado "success"
  const { data: logEntry, error: findErr } = await supabase!
    .from("etl_log")
    .select("id, status, source, filename")
    .eq("id", etlRunId)
    .single()

  if (findErr || !logEntry) {
    return NextResponse.json({ error: "Carga no encontrada" }, { status: 404 })
  }

  if (logEntry.status !== "success") {
    return NextResponse.json(
      { error: `No se puede revertir una carga con estado "${logEntry.status}"` },
      { status: 400 }
    )
  }

  // Eliminar las filas de ventas_lineas ligadas a esta carga
  const { count, error: delErr } = await supabase!
    .from("ventas_lineas")
    .delete({ count: "exact" })
    .eq("etl_run_id", etlRunId)

  if (delErr) {
    return NextResponse.json({ error: "Error al eliminar filas: " + delErr.message }, { status: 500 })
  }

  // Marcar el registro como revertido
  await supabase!
    .from("etl_log")
    .update({
      status: "reverted",
      completed_at: new Date().toISOString(),
      error_message: `Revertido manualmente — ${count ?? 0} filas eliminadas`,
    })
    .eq("id", etlRunId)

  await invalidateDashboardCache()

  console.log(`[carga/revert] etl_run_id=${etlRunId} — ${count ?? 0} filas eliminadas`)

  return NextResponse.json({ ok: true, rows_deleted: count ?? 0 })
}
