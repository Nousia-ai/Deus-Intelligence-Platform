/**
 * POST /api/admin/seed-csv
 *
 * Herramienta de recovery: lee df_ventas_v4.csv y siembra ventas_lineas.
 * Primero elimina el rango de fechas del CSV, luego inserta todas las filas.
 * Usar cuando ventas_lineas esté vacío o corrupto.
 */

import { NextResponse } from "next/server"
import { supabase, isSupabaseReady } from "@/lib/supabase"
import { invalidateDashboardCache } from "@/lib/analytics"
import { revalidatePath } from "next/cache"
import * as fs from "fs"
import * as path from "path"

export const runtime = "nodejs"
export const maxDuration = 300

const BATCH = 500

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuote = false
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote
    } else if (ch === "," && !inQuote) {
      result.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function skuFromArticulo(articulo: string): string {
  const words = articulo.trim().split(/\s+/)
  return words[words.length - 1] ?? ""
}

export async function POST() {
  if (!isSupabaseReady()) {
    return NextResponse.json({ error: "Supabase no configurado" }, { status: 500 })
  }

  const t0 = Date.now()
  const csvPath = path.join(process.cwd(), "src", "data", "df_ventas_v4.csv")
  if (!fs.existsSync(csvPath)) {
    return NextResponse.json({ error: "CSV no encontrado: " + csvPath }, { status: 404 })
  }

  // Registro en etl_log
  const { data: logEntry } = await supabase!
    .from("etl_log")
    .insert({ source: "csv_seed", filename: "df_ventas_v4.csv", status: "running" })
    .select("id")
    .single()
  const etlRunId = logEntry?.id ?? null

  try {
    const csvText = fs.readFileSync(csvPath, "utf8")
    const lines = csvText.trim().split(/\r?\n/)
    const header = parseCSVLine(lines[0]).map(h => h.replace(/"/g, "").trim())

    const idxOf = (col: string) => header.indexOf(col)

    // Parse rows
    const rows = lines.slice(1).map(line => {
      const cols = parseCSVLine(line)
      const get = (col: string) => cols[idxOf(col)]?.replace(/"/g, "").trim() ?? ""
      const articulo = get("articulo")
      const anioRaw = get("año") || get("anio")
      return {
        etl_run_id: etlRunId,
        articulo,
        marca: get("marca"),
        marca_en_canonico: get("marca"),
        tipo_producto: get("tipo_producto"),
        categoria_macro: get("categoria_macro"),
        color: get("color"),
        familia_color: get("familia_color"),
        talla: get("talla"),
        tipo_talla: get("tipo_talla"),
        genero: get("genero"),
        detalles: get("detalles"),
        material: get("material"),
        corte: get("corte"),
        patron: get("patron"),
        sku: skuFromArticulo(articulo),
        es_marca_propia: get("es_marca_propia") === "1" || get("es_marca_propia").toLowerCase() === "true",
        es_multicolor:   get("es_multicolor")   === "1" || get("es_multicolor").toLowerCase()   === "true",
        es_bundle:       get("es_bundle")        === "1" || get("es_bundle").toLowerCase()        === "true",
        es_cortesia:     get("es_cortesia")      === "1" || get("es_cortesia").toLowerCase()      === "true",
        manga: get("manga"),
        cuello: get("cuello"),
        linea: get("linea"),
        detalles_extra: get("detalles_extra"),
        tiene_corte:     get("tiene_corte")     === "1" || get("tiene_corte").toLowerCase()     === "true",
        tiene_material:  get("tiene_material")  === "1" || get("tiene_material").toLowerCase()  === "true",
        tiene_manga:     get("tiene_manga")     === "1" || get("tiene_manga").toLowerCase()     === "true",
        tiene_linea:     get("tiene_linea")     === "1" || get("tiene_linea").toLowerCase()     === "true",
        tiene_cuello:    get("tiene_cuello")    === "1" || get("tiene_cuello").toLowerCase()    === "true",
        fecha: get("fecha"),
        caja_prefix: get("caja_prefix"),
        tienda: get("tienda"),
        canal: get("canal"),
        unidades:            parseFloat(get("unidades"))            || 0,
        precio_lista:        parseFloat(get("precio_lista"))        || 0,
        precio_pagado:       parseFloat(get("precio_pagado"))       || 0,
        pct_descuento:       parseFloat(get("pct_descuento"))       || 0,
        monto_descuento:     parseFloat(get("monto_descuento"))     || 0,
        tiene_descuento:     get("tiene_descuento") === "1" || get("tiene_descuento").toLowerCase() === "true",
        importe_neto:        parseFloat(get("importe_neto"))        || 0,
        ticket_total:        parseFloat(get("ticket_total"))        || 0,
        forma_cobro_principal: get("forma_cobro_principal"),
        rango_precio: get("rango_precio"),
        anio:      parseInt(anioRaw)              || 0,
        mes:       parseInt(get("mes"))           || 0,
        semana:    parseInt(get("semana"))        || 0,
        dia_semana: parseInt(get("dia_semana"))   || 0,
        costo_unitario: get("costo_unitario") ? (parseFloat(get("costo_unitario")) || null) : null,
        sucursal_id: get("sucursal_id"),
        sku_padre:   get("sku_padre"),
        folio:       get("folio"),
        dup_group_size: parseInt(get("dup_group_size")) || 1,
        n_duplicates:   parseInt(get("n_duplicates"))   || 0,
      }
    }).filter(r => r.fecha.length === 10 && r.articulo.length > 0)

    if (rows.length === 0) {
      return NextResponse.json({ error: "No se parsearon filas del CSV" }, { status: 422 })
    }

    const fechas = rows.map(r => r.fecha).sort()
    const fechaMin = fechas[0]
    const fechaMax = fechas[fechas.length - 1]

    // Limpiar el rango que cubre el CSV (idempotente)
    const { error: delErr } = await supabase!
      .from("ventas_lineas")
      .delete()
      .gte("fecha", fechaMin)
      .lte("fecha", fechaMax)
    if (delErr) console.error("[seed-csv] delete error:", delErr.message)

    // Insertar en lotes
    let inserted = 0
    const totalBatches = Math.ceil(rows.length / BATCH)
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error: insErr } = await supabase!.from("ventas_lineas").insert(batch)
      if (insErr) {
        console.error(`[seed-csv] batch ${Math.floor(i / BATCH) + 1}/${totalBatches} error:`, insErr.message)
      } else {
        inserted += batch.length
      }
    }

    // Actualizar etl_log
    if (etlRunId) {
      await supabase!.from("etl_log").update({
        status: "success",
        completed_at: new Date().toISOString(),
        rows_processed: rows.length,
        rows_inserted: inserted,
        rows_skipped: rows.length - inserted,
      }).eq("id", etlRunId)
    }

    await invalidateDashboardCache()
    revalidatePath("/inicio")

    const duration = Date.now() - t0
    console.log(`[seed-csv] OK: ${inserted}/${rows.length} filas en ${duration}ms`)

    return NextResponse.json({
      ok: true,
      rows_total: rows.length,
      rows_inserted: inserted,
      fecha_min: fechaMin,
      fecha_max: fechaMax,
      duration_ms: duration,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[seed-csv] ERROR:", msg)
    if (etlRunId) {
      await supabase!.from("etl_log").update({
        status: "error",
        completed_at: new Date().toISOString(),
        error_message: msg,
      }).eq("id", etlRunId)
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
