/**
 * kardex-parser.ts
 * Parsea el reporte "Kardex de los artículos" de Microsip (.xlsx).
 * Produce una fila por SKU-talla con KPIs básicos calculables desde el resumen.
 *
 * Estructura del archivo (columnas por índice):
 *   Fila 0: empresa
 *   Fila 1: "Kardex de los artículos"
 *   Fila 2: período  → "Del DD al DD de MES del YYYY"
 *   Fila 3: sucursal_nombre
 *   Fila 4: "(Unidades / Costo)"
 *   Fila 5: encabezados de columna
 *   Fila 6: vacía
 *   Fila 7+: bloques de artículos
 *
 * Cada bloque de artículo tiene dos filas resumen:
 *   Fila N (unidades): col[0]=codigo, col[2]=descripcion, col[6]="Pieza",
 *                      col[10]=inv_ini, col[13]=entradas, col[15]=salidas, col[18]=inv_fin
 *   Fila N+1 (costo):  col[0]=null, col[10]=inv_ini_c, col[13]=ent_c, col[15]=sal_c, col[18]=inv_fin_c
 *   Fila N+2+ (movimientos individuales): se saltan (no necesitamos el detalle)
 */

import * as XLSX from "xlsx"

// ─── Sucursal mapping ─────────────────────────────────────────────────────────

const BASICOS_KEYWORDS = ["basic", "basico", "polo", "bts"]
const EXCLUIR_KEYWORDS = ["gancho", "ganchos"]

function detectSucursalKey(nombre: string): string {
  const n = nombre.toLowerCase()
  if (n.includes("16") && (n.includes("sept") || n.includes("16s"))) return "16S"
  if (n.includes("atlixco") || n.includes("atlx")) return "atlx"
  if (n.includes("cruz")) return "czsr"
  if (n.includes("cholula")) return "chol"
  if (n.includes("centro")) return "cs"
  if (n.includes("san diego")) return "sd"
  if (n.includes("cedis") || n.includes("almacén") || n.includes("almacen") || n.includes("general")) return "ag"
  return nombre.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)
}

// ─── Period parsing ───────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
}

function parsePeriod(s: string): { inicio: string; fin: string } | null {
  // "Del DD al DD de MES del YYYY"
  const m = s.match(
    /Del\s+(\d{1,2})\s+(?:de\s+(\w+)\s+del?\s+(\d{4})\s+)?al\s+(\d{1,2})\s+de\s+(\w+)\s+del?\s+(\d{4})/i
  )
  if (m) {
    const [, d1, mo1, y1, d2, mo2, y2] = m
    const m2 = MESES[mo2.toLowerCase()] ?? 1
    const m1 = mo1 ? (MESES[mo1.toLowerCase()] ?? m2) : m2
    const fy1 = y1 ? parseInt(y1) : parseInt(y2)
    return {
      inicio: `${fy1}-${String(m1).padStart(2, "0")}-${String(d1).padStart(2, "0")}`,
      fin:    `${y2}-${String(m2).padStart(2, "0")}-${String(d2).padStart(2, "0")}`,
    }
  }
  return null
}

// ─── SKU parsing ──────────────────────────────────────────────────────────────

function parseCodigo(codigo: string): { sku_padre: string; talla: string } {
  const m = codigo.match(/^(\d+)(.+)$/)
  if (m) return { sku_padre: m[1], talla: m[2] }
  return { sku_padre: codigo, talla: "" }
}

function extractMarca(descripcion: string): string {
  return descripcion.trim().split(/\s+/)[0] ?? ""
}

function extractTipoProducto(descripcion: string): string {
  const words = descripcion.trim().split(/\s+/)
  if (words.length < 2) return ""
  const raw = words[1].match(/^([A-Za-záéíóúñÁÉÍÓÚÑü]+)/i)
  return raw ? raw[1] : ""
}

function toNum(val: unknown): number {
  if (typeof val === "number") return val
  const n = parseFloat(String(val ?? "0").replace(",", ""))
  return isNaN(n) ? 0 : n
}

// ─── Nivel de alerta simplificado ────────────────────────────────────────────
// Sin datos de movimientos individuales, usamos sell_through + weeks_of_supply.
// Esta lógica es una aproximación a la que usa el pipeline Python (que se basa
// en bucket_aging + dias_en_piso que requieren movimientos).

function calcNivelAlerta(
  esBasico: boolean,
  invFin: number,
  sellThrough: number,
  weeksOfSupply: number | null,
): string | null {
  if (esBasico || invFin <= 0) return null
  const wos = weeksOfSupply ?? Infinity
  if (sellThrough < 0.10 || wos > 16) return "ROJA"
  if (sellThrough < 0.30 || wos > 8)  return "NARANJA"
  if (sellThrough < 0.50 || wos > 4)  return "AMARILLA"
  return null
}

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export interface ParsedKardexRow {
  codigo: string
  sku_padre: string
  talla: string
  descripcion: string
  marca: string
  tipo_producto: string
  es_basico: number    // 0 | 1
  sucursal_key: string
  sucursal_nombre: string
  periodo_inicio: string
  periodo_fin: string
  inv_ini_unidades: number
  inv_fin_unidades: number
  inv_ini_costo: number
  inv_fin_costo: number
  entradas_unidades: number
  salidas_unidades: number
  entradas_costo: number
  salidas_costo: number
  // KPIs computados
  unidades_vendidas: number    // approx: salidas_unidades (incluye traspasos)
  unidades_disponibles: number // inv_ini + entradas
  valor_inv_costo: number
  sell_through: number | null
  velocidad_semanal: number | null
  weeks_of_supply: number | null
  nivel_alerta: string | null
  updated_at: string
}

export interface ParseKardexResult {
  rows: ParsedKardexRow[]
  sucursal_key: string
  sucursal_nombre: string
  periodo_inicio: string
  periodo_fin: string
  errores: string[]
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseKardexXlsx(buffer: Buffer): ParseKardexResult {
  const wb = XLSX.read(buffer, { cellDates: true, type: "buffer" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]

  // ── Cabeceras ──────────────────────────────────────────────────────────────
  const periodoStr = String(rawRows[2]?.[0] ?? "")
  const sucursalNombre = String(rawRows[3]?.[0] ?? "").trim()
  const period = parsePeriod(periodoStr)
  const periodoInicio = period?.inicio ?? ""
  const periodoFin    = period?.fin    ?? ""
  const sucursalKey   = detectSucursalKey(sucursalNombre)

  // Semanas activas para velocidad_semanal
  let semanasActivas = 1
  if (period) {
    const diff = (new Date(periodoFin).getTime() - new Date(periodoInicio).getTime()) / 86400000
    semanasActivas = Math.max(1, diff / 7)
  }

  const today = new Date().toISOString().slice(0, 10)
  const rows: ParsedKardexRow[] = []
  const errores: string[] = []

  let i = 7 // data starts at row 7 (0-indexed)
  while (i < rawRows.length) {
    const row = rawRows[i]
    if (!row) { i++; continue }

    const col0 = row[0]

    // ── Fila de unidades: col[0] es string no vacío (código) + col[6]="Pieza" ─
    if (typeof col0 === "string" && col0.trim().length > 0 && String(row[6] ?? "").trim() === "Pieza") {
      const codigo = col0.trim()

      // Excluir artículos de operación (ganchos, etc.)
      const desc = String(row[2] ?? "").trim()
      if (EXCLUIR_KEYWORDS.some(kw => desc.toLowerCase().includes(kw))) {
        i++; continue
      }

      const invIniU  = toNum(row[10])
      const entradasU = toNum(row[13])
      const salidasU  = toNum(row[15])
      const invFinU   = toNum(row[18])

      // ── Siguiente fila: costos ─────────────────────────────────────────────
      let invIniC = 0, entradasC = 0, salidasC = 0, invFinC = 0
      const costRow = rawRows[i + 1]
      if (costRow && (costRow[0] === null || costRow[0] === undefined) && String(costRow[6] ?? "").trim() !== "Pieza") {
        invIniC   = toNum(costRow[10])
        entradasC = toNum(costRow[13])
        salidasC  = toNum(costRow[15])
        invFinC   = toNum(costRow[18])
        i++  // saltar la fila de costos
      }

      const { sku_padre, talla } = parseCodigo(codigo)
      const marca = extractMarca(desc)
      const tipoProducto = extractTipoProducto(desc)
      const esBasico = BASICOS_KEYWORDS.some(kw => desc.toLowerCase().includes(kw)) ? 1 : 0

      const unidadesDisponibles = invIniU + entradasU
      const unidadesVendidas = Math.max(0, salidasU)  // salidas incluye traspasos
      const sellThrough = unidadesDisponibles > 0 ? unidadesVendidas / unidadesDisponibles : null
      const velocidadSemanal = unidadesVendidas > 0 ? unidadesVendidas / semanasActivas : 0
      const weeksOfSupply = velocidadSemanal > 0 ? invFinU / velocidadSemanal : null

      rows.push({
        codigo,
        sku_padre,
        talla,
        descripcion: desc,
        marca,
        tipo_producto: tipoProducto,
        es_basico: esBasico,
        sucursal_key: sucursalKey,
        sucursal_nombre: sucursalNombre,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        inv_ini_unidades: invIniU,
        inv_fin_unidades: invFinU,
        inv_ini_costo: invIniC,
        inv_fin_costo: invFinC,
        entradas_unidades: entradasU,
        salidas_unidades: salidasU,
        entradas_costo: entradasC,
        salidas_costo: salidasC,
        unidades_vendidas: unidadesVendidas,
        unidades_disponibles: unidadesDisponibles,
        valor_inv_costo: invFinC,
        sell_through: sellThrough,
        velocidad_semanal: velocidadSemanal,
        weeks_of_supply: weeksOfSupply,
        nivel_alerta: calcNivelAlerta(esBasico === 1, invFinU, sellThrough ?? 0, weeksOfSupply),
        updated_at: today,
      })
    }

    i++
  }

  return { rows, sucursal_key: sucursalKey, sucursal_nombre: sucursalNombre, periodo_inicio: periodoInicio, periodo_fin: periodoFin, errores }
}
