/**
 * ventas-parser.ts
 * Parsea el reporte "Diarios de ventas de mostrador" de Microsip (.xlsx).
 * Produce una fila plana por línea de artículo dentro de cada ticket.
 *
 * Estructura del reporte (columnas por índice, los encabezados son ruido):
 *   Fila de transacción: col[0]=fecha(Date), col[1]=folio, col[11]=importe_neto_tx,
 *                        col[13]=impuesto, col[16]=total_ticket
 *   Fila "Artículo":     col[1]="Artículo"  → marcador, se salta
 *   Fila de artículo:    col[0]=null, col[1]=desc, col[10]=unidades,
 *                        col[12]=precio_unitario, col[13]="X.XX %", col[16]=importe_neto
 *   Fila "Forma de cobro": col[1]="Forma de cobro"  → inicia bloque de pagos
 *   Fila de pago:        col[1]=método, col[6]=importe  (ignorar "Cambio")
 */

import * as XLSX from "xlsx"

// ─── Mapeos estáticos ────────────────────────────────────────────────────────

const FOLIO_SUCURSAL: Record<string, { sucursal_id: string; tienda: string; canal: string }> = {
  A: { sucursal_id: "16S001", tienda: "16 de Septiembre", canal: "físico" },
  B: { sucursal_id: "16S001", tienda: "16 de Septiembre", canal: "físico" },
  C: { sucursal_id: "ATL001", tienda: "Atlixco", canal: "físico" },
  D: { sucursal_id: "ATL001", tienda: "Atlixco", canal: "físico" },
  E: { sucursal_id: "CSU001", tienda: "Centro Sur", canal: "físico" },
  F: { sucursal_id: "CSU001", tienda: "Centro Sur", canal: "físico" },
  G: { sucursal_id: "CHO001", tienda: "Cholula", canal: "físico" },
  H: { sucursal_id: "CHO001", tienda: "Cholula", canal: "físico" },
  I: { sucursal_id: "COR001", tienda: "Mercado Libre", canal: "online" },
  J: { sucursal_id: "COR001", tienda: "Mercado Libre", canal: "online" },
  K: { sucursal_id: "CRZ001", tienda: "Cruz del Sur", canal: "físico" },
  L: { sucursal_id: "CRZ001", tienda: "Cruz del Sur", canal: "físico" },
  M: { sucursal_id: "SND001", tienda: "San Diego", canal: "físico" },
  N: { sucursal_id: "SND001", tienda: "San Diego", canal: "físico" },
  O: { sucursal_id: "MLI001", tienda: "ML Full", canal: "online" },
  PS: { sucursal_id: "CEDIS", tienda: "CEDIS", canal: "almacén" },
}

export const TIPO_CATEGORIA: Record<string, string> = {
  Chamarra: "Outerwear", Pantalón: "Bottoms", Conjunto: "Sets",
  Falda: "Bottoms", Playera: "Tops", Gorra: "Accessories",
  Pants: "Bottoms", Camisa: "Tops", Vestido: "Dresses",
  Blusa: "Tops", Top: "Tops", Gafas: "Accessories",
  Short: "Bottoms", Chaleco: "Outerwear", Blazer: "Formal",
  "Suéter": "Knitwear", Jeans: "Bottoms", Sudadera: "Outerwear",
  Bermuda: "Bottoms", Saco: "Formal", Jumpsuit: "Sets",
  Torera: "Outerwear", "Cinturón": "Accessories", Legging: "Bottoms",
  Corset: "Accessories", Palazzo: "Bottoms", Ensamble: "Sets",
  Camisetas: "Otro", Promo: "Bundle", Mallon: "Otro",
  Cazadora: "Outerwear", Abrigo: "Outerwear", Poncho: "Otro",
  "Blusón": "Tops", Gabardina: "Outerwear", Jumper: "Sets",
  Combo: "Sets", Camisola: "Tops", Mochila: "Otro",
  Capa: "Otro", Medias: "Accessories", Bundle: "Bundle",
  Mono: "Otro", Sujetador: "Accessories", Mameluco: "Otro",
  Prendas: "Otro", Rompevientos: "Outerwear", Pantiblusa: "Sets",
  Guantes: "Otro", Bufanda: "Accessories", Crop: "Otro",
  Camisera: "Tops", Jogger: "Otro", Flores: "Otro",
  Pantalon: "Otro", Croptop: "Otro", Accesorio: "Accessories",
}

// ─── Tipos exportados ────────────────────────────────────────────────────────

export interface ParsedVentaRow {
  fecha: string        // "YYYY-MM-DD"
  folio: string
  articulo: string
  sku: string          // último token de articulo (ej. "26501UNI")
  sku_padre: string    // prefijo numérico (ej. "26501")
  unidades: number
  precio_lista: number
  precio_pagado: number
  pct_descuento: number
  monto_descuento: number
  tiene_descuento: boolean
  importe_neto: number
  ticket_total: number
  forma_cobro_principal: string
  sucursal_id: string
  tienda: string
  canal: string
  caja_prefix: string
  anio: number
  mes: number
  semana: number
  dia_semana: number   // 0=lunes … 6=domingo (convención Python)
  rango_precio: string
  // campos enriquecibles desde inventory_kpis (vacíos al parsear)
  marca: string
  tipo_producto: string
  categoria_macro: string
}

export interface ParseVentasResult {
  rows: ParsedVentaRow[]
  fechaMin: string
  fechaMax: string
  transacciones: number
  errores: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateStr(val: unknown): string | null {
  if (val instanceof Date) {
    const y = val.getUTCFullYear()
    const m = String(val.getUTCMonth() + 1).padStart(2, "0")
    const d = String(val.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
  }
  if (typeof val === "string" && val.includes("T")) {
    return val.slice(0, 10)
  }
  return null
}

function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z")
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function dayOfWeek(dateStr: string): number {
  // 0=lunes … 6=domingo
  return (new Date(dateStr + "T12:00:00Z").getUTCDay() + 6) % 7
}

function parsePct(val: unknown): number {
  if (typeof val === "number") return val
  if (typeof val === "string") {
    const n = parseFloat(val.replace("%", "").trim())
    return isNaN(n) ? 0 : n
  }
  return 0
}

function rangoFromPrecio(p: number): string {
  if (p < 150) return "Económico (<$150)"
  if (p < 350) return "Medio ($150-$350)"
  if (p < 600) return "Premium ($350-$600)"
  return "Luxury (>$600)"
}

function sucursalFromFolio(folio: string): { sucursal_id: string; tienda: string; canal: string; caja_prefix: string } {
  if (!folio) return { sucursal_id: "UNKNOWN", tienda: "Desconocida", canal: "físico", caja_prefix: "" }
  // Check 2-char prefix "PS" first
  const prefix2 = folio.slice(0, 2).toUpperCase()
  if (FOLIO_SUCURSAL[prefix2]) return { ...FOLIO_SUCURSAL[prefix2], caja_prefix: prefix2 }
  const prefix1 = folio.slice(0, 1).toUpperCase()
  if (FOLIO_SUCURSAL[prefix1]) return { ...FOLIO_SUCURSAL[prefix1], caja_prefix: prefix1 }
  return { sucursal_id: "UNKNOWN", tienda: "Desconocida", canal: "físico", caja_prefix: prefix1 }
}

function skuFromArticulo(articulo: string): { sku: string; sku_padre: string } {
  const words = articulo.trim().split(/\s+/)
  const lastWord = words[words.length - 1] ?? ""
  const m = lastWord.match(/^(\d+)(.+)$/)
  if (m) return { sku: lastWord, sku_padre: m[1] }
  return { sku: lastWord, sku_padre: lastWord }
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export function parseVentasXlsx(buffer: Buffer): ParseVentasResult {
  const wb = XLSX.read(buffer, { cellDates: true, type: "buffer" })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]

  const result: ParsedVentaRow[] = []
  const errores: string[] = []
  let transacciones = 0

  // Estado actual de la transacción
  let currentFecha = ""
  let currentFolio = ""
  let currentTicketTotal = 0
  let inPaymentBlock = false
  // Forma de cobro se captura en bloque de pago (que viene DESPUÉS de los artículos),
  // por lo que se recoge en un mapa separado y se aplica en post-proceso.
  const formaByFolio = new Map<string, string>()

  for (const row of rawRows) {
    if (!row || row.length === 0) continue
    const col0 = row[0]
    const col1 = row[1] as string | number | null

    // ── Detectar fila de transacción (col[0] es una fecha) ──────────────────
    const dateStr = toDateStr(col0)
    if (dateStr) {
      currentFecha = dateStr
      currentFolio = String(col1 ?? "")
      currentTicketTotal = typeof row[16] === "number" ? row[16] : parseFloat(String(row[16] ?? "0")) || 0
      inPaymentBlock = false
      transacciones++
      continue
    }

    // ── Ignorar filas sin transacción activa ─────────────────────────────────
    if (!currentFecha) continue

    const col1Str = typeof col1 === "string" ? col1.trim() : ""

    // ── Marcadores especiales ────────────────────────────────────────────────
    if (col1Str === "Artículo") continue
    if (col1Str === "Forma de cobro") { inPaymentBlock = true; continue }

    // ── Bloque de pago ───────────────────────────────────────────────────────
    if (inPaymentBlock) {
      if (col1Str === "Cambio" || col1Str === "") continue
      if (!formaByFolio.has(currentFolio) && col1Str.length > 0) {
        formaByFolio.set(currentFolio, col1Str)
      }
      continue
    }

    // ── Fila de artículo ─────────────────────────────────────────────────────
    const unidades = typeof row[10] === "number" ? row[10] : parseFloat(String(row[10] ?? ""))
    const precioLista = typeof row[12] === "number" ? row[12] : parseFloat(String(row[12] ?? ""))
    const importeNeto = typeof row[16] === "number" ? row[16] : parseFloat(String(row[16] ?? ""))

    if (!col1Str || isNaN(unidades) || isNaN(precioLista) || col1Str.length < 5) continue

    const pctDesc = parsePct(row[13])
    const precioPagado = unidades > 0 ? importeNeto / unidades : precioLista
    const montoDesc = Math.max(0, precioLista * unidades - importeNeto)
    const { sku, sku_padre } = skuFromArticulo(col1Str)
    const { sucursal_id, tienda, canal, caja_prefix } = sucursalFromFolio(currentFolio)
    const anio = parseInt(currentFecha.slice(0, 4))
    const mes = parseInt(currentFecha.slice(5, 7))

    result.push({
      fecha: currentFecha,
      folio: currentFolio,
      articulo: col1Str,
      sku,
      sku_padre,
      unidades,
      precio_lista: precioLista,
      precio_pagado: precioPagado,
      pct_descuento: pctDesc,
      monto_descuento: montoDesc,
      tiene_descuento: pctDesc > 0,
      importe_neto: importeNeto,
      ticket_total: currentTicketTotal,
      forma_cobro_principal: "",  // filled in post-process via formaByFolio
      sucursal_id,
      tienda,
      canal,
      caja_prefix,
      anio,
      mes,
      semana: isoWeek(currentFecha),
      dia_semana: dayOfWeek(currentFecha),
      rango_precio: rangoFromPrecio(precioPagado),
      // enriched later
      marca: "",
      tipo_producto: "",
      categoria_macro: "",
    })
  }

  // Post-proceso: aplicar forma_cobro_principal desde el mapa (capturado en bloque de pago)
  for (const r of result) {
    r.forma_cobro_principal = formaByFolio.get(r.folio) ?? ""
  }

  const fechas = result.map(r => r.fecha).sort()
  return {
    rows: result,
    fechaMin: fechas[0] ?? "",
    fechaMax: fechas[fechas.length - 1] ?? "",
    transacciones,
    errores,
  }
}
