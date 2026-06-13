/**
 * POST /api/carga/ventas
 *
 * Acepta multipart/form-data con un campo "file" (xlsx de ventas Microsip).
 * Parsea, enriquece desde inventory_kpis, elimina el rango de fechas del archivo
 * en ventas_lineas, e inserta las nuevas filas.
 *
 * Warning flow (dos pasos):
 *   1. Primera llamada (sin X-Confirm): si el archivo cubre fechas de meses anteriores
 *      con datos existentes, devuelve { warning: true, rows_at_risk, fecha_min, fecha_max }
 *      sin crear etl_log ni modificar datos.
 *   2. Segunda llamada (X-Confirm: true): procede sin verificación de warning.
 *
 * Body: FormData { file: File (.xlsx) }
 * Response: { ok, rows_inserted, fecha_min, fecha_max, transacciones, duration_ms }
 *        ó  { warning: true, rows_at_risk, fecha_min, fecha_max }
 */

import { NextResponse } from "next/server"
import { supabase, isSupabaseReady } from "@/lib/supabase"
import { parseVentasXlsx, TIPO_CATEGORIA } from "@/lib/etl/ventas-parser"
import { invalidateDashboardCache } from "@/lib/analytics"
import { revalidatePath } from "next/cache"

export const runtime   = "nodejs"
export const maxDuration = 60

const BATCH_SIZE = 500

// ─── Enriquecimiento desde inventory_kpis ────────────────────────────────────

interface ProductInfo {
  marca: string
  tipo_producto: string
  categoria_macro: string
}

async function enrichFromInventory(skus: string[]): Promise<Map<string, ProductInfo>> {
  const map = new Map<string, ProductInfo>()
  if (!supabase || skus.length === 0) return map

  const batches: string[][] = []
  for (let i = 0; i < skus.length; i += 500) batches.push(skus.slice(i, i + 500))

  for (const batch of batches) {
    const { data } = await supabase
      .from("inventory_kpis")
      .select("codigo,marca,tipo_producto")
      .in("codigo", batch)

    for (const row of data ?? []) {
      if (!map.has(row.codigo)) {
        const tipo = row.tipo_producto ?? ""
        map.set(row.codigo, {
          marca: row.marca ?? "",
          tipo_producto: tipo,
          categoria_macro: TIPO_CATEGORIA[tipo] ?? "Otro",
        })
      }
    }
  }
  return map
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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

  // ── Parsear xlsx ───────────────────────────────────────────────────────────
  const parsed = parseVentasXlsx(buffer)
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "El archivo no contiene filas de ventas" }, { status: 422 })
  }

  // ── Warning: archivo cubre meses anteriores con datos existentes ───────────
  // Se omite si el cliente envía X-Confirm: true (segunda llamada post-confirmación).
  const forceConfirm = request.headers.get("X-Confirm") === "true"

  if (!forceConfirm && parsed.fechaMin) {
    const now = new Date()
    const currentMonthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`

    if (parsed.fechaMin < currentMonthStart) {
      // Contar filas existentes en los meses anteriores que serían borradas
      const { count } = await supabase!
        .from("ventas_lineas")
        .select("*", { count: "exact", head: true })
        .gte("fecha", parsed.fechaMin)
        .lt("fecha", currentMonthStart)

      if ((count ?? 0) > 0) {
        return NextResponse.json({
          warning: true,
          rows_at_risk: count,
          fecha_min: parsed.fechaMin,
          fecha_max: parsed.fechaMax,
        })
      }
    }
  }

  // ── Crear registro en etl_log (solo cuando vamos a proceder realmente) ─────
  const { data: logEntry, error: logErr } = await supabase!
    .from("etl_log")
    .insert({ source: "erp_import", filename: file.name, status: "running" })
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
    // ── Enriquecer con datos de inventory_kpis ────────────────────────────────
    const uniqueSkus = [...new Set(parsed.rows.map(r => r.sku))]
    const productMap = await enrichFromInventory(uniqueSkus)

    for (const row of parsed.rows) {
      const info = productMap.get(row.sku)
      if (info) {
        row.marca = info.marca
        row.tipo_producto = info.tipo_producto
        row.categoria_macro = info.categoria_macro
      }
    }

    // ── Eliminar filas existentes para el rango de fechas del archivo ─────────
    if (parsed.fechaMin && parsed.fechaMax) {
      const { error: delErr } = await supabase!
        .from("ventas_lineas")
        .delete()
        .gte("fecha", parsed.fechaMin)
        .lte("fecha", parsed.fechaMax)
      if (delErr) {
        await finishLog("error", { error_message: "Error al limpiar rango: " + delErr.message })
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
    }

    // ── Insertar en lotes ─────────────────────────────────────────────────────
    let inserted = 0
    const totalRows = parsed.rows.length

    for (let b = 0; b < totalRows; b += BATCH_SIZE) {
      const slice = parsed.rows.slice(b, b + BATCH_SIZE)
      const dbRows = slice.map(r => ({
        etl_run_id: etlRunId,
        articulo: r.articulo,
        marca: r.marca,
        marca_en_canonico: r.marca,
        tipo_producto: r.tipo_producto,
        categoria_macro: r.categoria_macro,
        color: "", familia_color: "", talla: "", tipo_talla: "",
        genero: "", detalles: "", material: "", corte: "", patron: "", sku: r.sku,
        es_marca_propia: false, es_multicolor: false, es_bundle: false, es_cortesia: false,
        manga: "", cuello: "", linea: "", detalles_extra: "",
        tiene_corte: false, tiene_material: false, tiene_manga: false,
        tiene_linea: false, tiene_cuello: false,
        fecha: r.fecha,
        caja_prefix: r.caja_prefix,
        tienda: r.tienda,
        canal: r.canal,
        unidades: r.unidades,
        precio_lista: r.precio_lista,
        precio_pagado: r.precio_pagado,
        pct_descuento: r.pct_descuento,
        monto_descuento: r.monto_descuento,
        tiene_descuento: r.tiene_descuento,
        importe_neto: r.importe_neto,
        ticket_total: r.ticket_total,
        forma_cobro_principal: r.forma_cobro_principal,
        rango_precio: r.rango_precio,
        anio: r.anio,
        mes: r.mes,
        semana: r.semana,
        dia_semana: r.dia_semana,
        costo_unitario: null,
        sucursal_id: r.sucursal_id,
        sku_padre: r.sku_padre,
        folio: r.folio,
        dup_group_size: 1,
        n_duplicates: 0,
      }))

      const { error: insErr } = await supabase!.from("ventas_lineas").insert(dbRows)
      if (insErr) {
        console.error(`[carga/ventas] Batch error:`, insErr.message)
      } else {
        inserted += slice.length
      }
    }

    // ── Distribución por sucursal (para diagnóstico en UI) ───────────────────
    const sucursal_dist: Record<string, number> = {}
    for (const r of parsed.rows) {
      sucursal_dist[r.sucursal_id] = (sucursal_dist[r.sucursal_id] || 0) + 1
    }

    // ── Invalidar caché — la próxima visita a /inicio recargará datos frescos ──
    await invalidateDashboardCache()
    revalidatePath("/inicio")

    // ── Actualizar etl_log ────────────────────────────────────────────────────
    await finishLog("success", {
      rows_processed: totalRows,
      rows_inserted: inserted,
      rows_skipped: totalRows - inserted,
    })

    const duration = Date.now() - t0
    console.log(`[carga/ventas] OK: ${inserted} filas en ${duration} ms`)

    return NextResponse.json({
      ok: true,
      rows_inserted: inserted,
      rows_total: totalRows,
      fecha_min: parsed.fechaMin,
      fecha_max: parsed.fechaMax,
      transacciones: parsed.transacciones,
      skus_enriquecidos: productMap.size,
      sucursal_dist,
      duration_ms: duration,
      etl_run_id: etlRunId,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[carga/ventas] ERROR:", msg)
    await finishLog("error", { error_message: msg })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
