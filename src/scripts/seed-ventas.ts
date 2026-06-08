/**
 * seed-ventas.ts
 * ──────────────────────────────────────────────────────────────────────────────
 * Carga df_ventas_v4.csv en la tabla ventas_lineas de Supabase.
 * Operación segura: solo corre si la tabla está vacía.
 *
 * Uso:
 *   npm run seed:ventas
 *
 * Para re-sembrar desde cero (truncar primero):
 *   npm run seed:ventas -- --clean
 *
 * Tiempo estimado: 3–5 minutos (185 K filas en lotes de 1 000 vía PostgREST)
 * ──────────────────────────────────────────────────────────────────────────────
 */

import fs from "fs"
import path from "path"
import Papa from "papaparse"
import { createClient } from "@supabase/supabase-js"

// ── Cargar .env.local (sin dependencia extra) ─────────────────────────────────
const envPath = path.resolve(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n")
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const eq = t.indexOf("=")
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    const val = t.slice(eq + 1).trim()
    if (key && !process.env[key]) process.env[key] = val
  }
}

// ── Configuración ─────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BATCH_SIZE   = 1_000
const CSV_PATH     = path.resolve(process.cwd(), "src", "data", "df_ventas_v4.csv")
const CLEAN_FLAG   = process.argv.includes("--clean")

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌  SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridas en .env.local")
  process.exit(1)
}
if (!fs.existsSync(CSV_PATH)) {
  console.error(`❌  CSV no encontrado en ${CSV_PATH}`)
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

// ── Helpers ───────────────────────────────────────────────────────────────────
const bool = (v: string) => v === "1" || v === "True" || v === "true"
const num  = (v: string, def = 0) => (v && v !== "" ? parseFloat(v) : def)
const numN = (v: string) => (v && v !== "" ? parseFloat(v) : null)
const int  = (v: string, def = 0) => (v && v !== "" ? parseInt(v, 10) : def)
const str  = (v: string) => v ?? ""
const ago  = (row: Record<string, string>) =>
  row["año"] || row["a\xc3\xb1o"] || row["aÃ±o"] || row["anio"] || "0"

function formatTime(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.floor(ms / 60_000)} m ${Math.round((ms % 60_000) / 1000)} s`
}

// ── Mapeo CSV → DB ────────────────────────────────────────────────────────────
function mapRow(row: Record<string, string>, etl_run_id: number): Record<string, unknown> {
  return {
    etl_run_id,
    // Producto
    articulo:              str(row.articulo),
    marca:                 str(row.marca),
    marca_en_canonico:     str(row.marca_en_canonico),
    tipo_producto:         str(row.tipo_producto),
    categoria_macro:       str(row.categoria_macro),
    color:                 str(row.color),
    familia_color:         str(row.familia_color),
    talla:                 str(row.talla),
    tipo_talla:            str(row.tipo_talla),
    genero:                str(row.genero),
    detalles:              str(row.detalles),
    material:              str(row.material),
    corte:                 str(row.corte),
    patron:                str(row.patron),
    sku:                   str(row.sku),
    es_marca_propia:       bool(row.es_marca_propia),
    es_multicolor:         bool(row.es_multicolor),
    es_bundle:             bool(row.es_bundle),
    es_cortesia:           bool(row.es_cortesia),
    // Atributos adicionales
    manga:                 str(row.manga),
    cuello:                str(row.cuello),
    linea:                 str(row.linea),
    detalles_extra:        str(row.detalles_extra),
    tiene_corte:           bool(row.tiene_corte),
    tiene_material:        bool(row.tiene_material),
    tiene_manga:           bool(row.tiene_manga),
    tiene_linea:           bool(row.tiene_linea),
    tiene_cuello:          bool(row.tiene_cuello),
    // Transacción
    fecha:                 str(row.fecha),
    caja_prefix:           str(row.caja_prefix),
    tienda:                str(row.tienda),
    canal:                 str(row.canal),
    unidades:              num(row.unidades, 1),
    precio_lista:          num(row.precio_lista),
    precio_pagado:         num(row.precio_pagado),
    pct_descuento:         num(row.pct_descuento),
    monto_descuento:       num(row.monto_descuento),
    tiene_descuento:       bool(row.tiene_descuento),
    importe_neto:          num(row.importe_neto),
    ticket_total:          num(row.ticket_total),
    forma_cobro_principal: str(row.forma_cobro_principal),
    rango_precio:          str(row.rango_precio),
    anio:                  int(ago(row)),
    mes:                   int(row.mes),
    semana:                int(row.semana),
    dia_semana:            int(row.dia_semana),
    // Costo e IDs
    costo_unitario:        numN(row.costo_unitario),
    sucursal_id:           str(row.sucursal_id),
    sku_padre:             str(row.sku_padre),
    folio:                 str(row.folio),
    // Metadatos dedup
    dup_group_size:        num(row.dup_group_size, 1),
    n_duplicates:          num(row.n_duplicates, 0),
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀  DEUS Intelligence Platform — seed ventas_lineas")
  console.log("────────────────────────────────────────────────────")

  // 1. Verificar tabla vacía (o limpiar si --clean)
  const { count, error: cntErr } = await sb
    .from("ventas_lineas")
    .select("*", { count: "exact", head: true })

  if (cntErr) {
    console.error("❌  Error al verificar ventas_lineas:", cntErr.message)
    console.error("   ¿Ejecutaste el schema.sql en el SQL Editor de Supabase?")
    process.exit(1)
  }

  if ((count ?? 0) > 0) {
    if (!CLEAN_FLAG) {
      console.log(`⚠️   ventas_lineas ya tiene ${count?.toLocaleString()} filas.`)
      console.log("    Para re-sembrar desde cero ejecuta:")
      console.log("      npm run seed:ventas -- --clean")
      console.log("    O trunca manualmente en Supabase SQL Editor:")
      console.log("      TRUNCATE ventas_lineas RESTART IDENTITY;")
      process.exit(0)
    }
    console.log(`🧹  --clean: eliminando ${count?.toLocaleString()} filas existentes…`)
    // Borra en lotes para no exceder límites de PostgREST
    let deleted = 0
    while (true) {
      const { data, error } = await sb
        .from("ventas_lineas")
        .delete()
        .gte("id", 1)
        .limit(5_000)
        .select("id")
      if (error) { console.error("❌  Error al limpiar:", error.message); process.exit(1) }
      deleted += data?.length ?? 0
      process.stdout.write(`\r   Eliminadas ${deleted.toLocaleString()} filas…`)
      if (!data?.length) break
    }
    console.log(`\r   ✓ Limpieza completa (${deleted.toLocaleString()} filas eliminadas)   `)
  }

  // 2. Crear entrada en etl_log
  const { data: logEntry, error: logErr } = await sb
    .from("etl_log")
    .insert({
      source:   "csv_seed",
      filename: "df_ventas_v4.csv",
      status:   "running",
    })
    .select("id")
    .single()

  if (logErr || !logEntry) {
    console.error("❌  No se pudo crear entrada en etl_log:", logErr?.message)
    process.exit(1)
  }
  const etl_run_id = logEntry.id as number
  console.log(`📋  ETL run #${etl_run_id} iniciado`)

  // 3. Parsear CSV completo
  console.log(`📂  Leyendo ${CSV_PATH}…`)
  const csvContent = fs.readFileSync(CSV_PATH, "utf-8")
  const { data: rawRows, errors } = Papa.parse(csvContent, {
    header:         true,
    skipEmptyLines: true,
    dynamicTyping:  false,
  })

  if (errors.length > 0) {
    console.warn(`⚠️   PapaParse reportó ${errors.length} errores menores (se ignoran filas inválidas)`)
  }

  const rows = rawRows as Record<string, string>[]
  const totalRows  = rows.length
  const totalBatches = Math.ceil(totalRows / BATCH_SIZE)
  console.log(`✅  ${totalRows.toLocaleString()} filas parseadas → ${totalBatches} lotes de ${BATCH_SIZE}`)
  console.log("────────────────────────────────────────────────────")

  // 4. Insertar en lotes
  let inserted   = 0
  let failed     = 0
  const t0       = Date.now()

  for (let b = 0; b < totalBatches; b++) {
    const slice = rows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE)
    const batch = slice.map(r => mapRow(r, etl_run_id))

    const { error: insErr } = await sb.from("ventas_lineas").insert(batch)

    if (insErr) {
      failed += slice.length
      console.error(`\n❌  Lote ${b + 1} falló: ${insErr.message}`)
      // Continuar con el siguiente lote
    } else {
      inserted += slice.length
    }

    // Progreso cada 10 lotes o en el último
    if ((b + 1) % 10 === 0 || b === totalBatches - 1) {
      const elapsed  = Date.now() - t0
      const pct      = ((b + 1) / totalBatches * 100).toFixed(1)
      const rate     = inserted / (elapsed / 1000)
      const remaining = (totalRows - inserted - failed) / rate * 1000
      process.stdout.write(
        `\r  Lote ${(b + 1).toString().padStart(3)} / ${totalBatches}` +
        `  [${pct.padStart(5)}%]` +
        `  ${inserted.toLocaleString()} insertadas` +
        `  ~${formatTime(remaining)} restante    `
      )
    }
  }

  console.log("\n────────────────────────────────────────────────────")
  const totalTime = Date.now() - t0

  // 5. Actualizar etl_log
  const status = failed === 0 ? "success" : "error"
  await sb.from("etl_log").update({
    status,
    rows_processed: totalRows,
    rows_inserted:  inserted,
    rows_skipped:   failed,
    completed_at:   new Date().toISOString(),
    ...(failed > 0 ? { error_message: `${failed} filas fallidas en inserción` } : {}),
  }).eq("id", etl_run_id)

  // 6. Resumen final
  console.log(`${status === "success" ? "✅" : "⚠️ "} Seed completado en ${formatTime(totalTime)}`)
  console.log(`   Insertadas : ${inserted.toLocaleString()} filas`)
  if (failed > 0) console.log(`   Fallidas   : ${failed.toLocaleString()} filas`)
  console.log(`   ETL run #${etl_run_id} → ${status}`)
  console.log("")
  console.log("💡  Próximo paso: verifica en Supabase Dashboard → Table Editor → ventas_lineas")
}

main().catch(err => {
  console.error("\n❌  Error fatal:", err)
  process.exit(1)
})
