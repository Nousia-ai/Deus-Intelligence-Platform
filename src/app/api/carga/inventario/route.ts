/**
 * POST /api/carga/inventario
 *
 * Acepta multipart/form-data con un campo "file" (xlsx de kardex Microsip).
 * Parsea y hace upsert en inventory_kpis (UNIQUE: codigo + sucursal_key).
 *
 * Body: FormData { file: File (.xlsx) }
 * Response: { ok, rows_upserted, sucursal_key, periodo_inicio, periodo_fin, duration_ms }
 */

import { NextResponse } from "next/server"
import { supabase, isSupabaseReady } from "@/lib/supabase"
import { parseKardexXlsx } from "@/lib/etl/kardex-parser"

export const runtime    = "nodejs"
export const maxDuration = 60

const BATCH_SIZE = 500

export async function POST(request: Request) {
  if (!isSupabaseReady()) {
    return NextResponse.json(
      { error: "Supabase no configurado — verificar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "No se pudo leer el form data" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "Campo 'file' requerido" }, { status: 400 })
  if (!file.name.endsWith(".xlsx")) return NextResponse.json({ error: "Solo se aceptan archivos .xlsx" }, { status: 400 })

  const t0 = Date.now()
  const buffer = Buffer.from(await file.arrayBuffer())

  // ── Crear registro en etl_log ──────────────────────────────────────────────
  const { data: logEntry, error: logErr } = await supabase!
    .from("etl_log")
    .insert({ source: "kardex_import", filename: file.name, status: "running" })
    .select("id")
    .single()
  if (logErr || !logEntry) {
    return NextResponse.json({ error: "Error al crear etl_log: " + logErr?.message }, { status: 500 })
  }
  const etlRunId = logEntry.id as number

  const finishLog = async (status: "success" | "error", extra: Record<string, unknown>) => {
    await supabase!.from("etl_log").update({
      status,
      completed_at: new Date().toISOString(),
      ...extra,
    }).eq("id", etlRunId)
  }

  try {
    // ── Parsear xlsx ──────────────────────────────────────────────────────────
    const parsed = parseKardexXlsx(buffer)
    if (parsed.rows.length === 0) {
      await finishLog("error", { error_message: "El archivo no contiene artículos" })
      return NextResponse.json({ error: "El archivo no contiene artículos" }, { status: 422 })
    }

    // ── Upsert en lotes ───────────────────────────────────────────────────────
    let upserted = 0
    const totalRows = parsed.rows.length

    for (let b = 0; b < totalRows; b += BATCH_SIZE) {
      const slice = parsed.rows.slice(b, b + BATCH_SIZE)
      const dbRows = slice.map(r => ({
        codigo:            r.codigo,
        sku_padre:         r.sku_padre,
        talla:             r.talla,
        descripcion:       r.descripcion,
        marca:             r.marca,
        tipo_producto:     r.tipo_producto,
        es_basico:         r.es_basico,
        es_promo:          0,
        sucursal_key:      r.sucursal_key,
        sucursal_nombre:   r.sucursal_nombre,
        periodo_inicio:    r.periodo_inicio || null,
        periodo_fin:       r.periodo_fin || null,
        inv_ini_unidades:  r.inv_ini_unidades,
        inv_fin_unidades:  r.inv_fin_unidades,
        inv_ini_costo:     r.inv_ini_costo,
        inv_fin_costo:     r.inv_fin_costo,
        valor_inv_costo:   r.valor_inv_costo,
        unidades_vendidas: r.unidades_vendidas,
        unidades_disponibles: r.unidades_disponibles,
        sell_through:      r.sell_through,
        velocidad_semanal: r.velocidad_semanal,
        semanas_activas:   null,
        weeks_of_supply:   r.weeks_of_supply,
        dsi:               null,
        dias_en_piso:      null,
        dias_sin_venta:    null,
        bucket_aging:      null,
        demand_index:      null,
        perfil_demanda:    null,
        nivel_alerta:      r.nivel_alerta,
        fuente_fecha:      "kardex",
        fecha_primera_entrada: null,
        fecha_ultima_venta:    null,
        updated_at:        r.updated_at,
      }))

      const { error: upsErr } = await supabase!
        .from("inventory_kpis")
        .upsert(dbRows, { onConflict: "codigo,sucursal_key" })

      if (upsErr) {
        console.error(`[carga/inventario] Batch upsert error:`, upsErr.message)
      } else {
        upserted += slice.length
      }
    }

    // ── Actualizar etl_log ────────────────────────────────────────────────────
    await finishLog("success", {
      rows_processed: totalRows,
      rows_inserted: upserted,
      rows_updated: upserted,
    })

    const duration = Date.now() - t0
    console.log(`[carga/inventario] OK: ${upserted} upserted (${parsed.sucursal_key}) en ${duration} ms`)

    return NextResponse.json({
      ok: true,
      rows_upserted: upserted,
      rows_total: totalRows,
      sucursal_key: parsed.sucursal_key,
      sucursal_nombre: parsed.sucursal_nombre,
      periodo_inicio: parsed.periodo_inicio,
      periodo_fin: parsed.periodo_fin,
      duration_ms: duration,
      etl_run_id: etlRunId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[carga/inventario] ERROR:", msg)
    await finishLog("error", { error_message: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
