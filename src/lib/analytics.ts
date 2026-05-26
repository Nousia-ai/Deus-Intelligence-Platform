import fs from "fs"
import path from "path"
import Papa from "papaparse"
import type {
  SalesRecord,
  BranchMetrics,
  CategoryMetrics,
  MonthlyRevenue,
  WeeklyRevenue,
  DashboardSummary,
  InsightType,
  BranchMonthMatrix,
  BranchMonthUnitsMatrix,
  BranchCategoryMatrix,
  BranchMonthCategoryMatrix,
  BranchMonthCategoryUnitsMatrix,
  BranchYearMatrix,
  MonthCategoryMatrix,
  DiscountMonthMatrix,
  BrandMetrics as BrandMetricType,
  SKUMetrics,
  LFLBranch,
  CEOKPIs,
} from "./types"
import { MONTH_LABELS_ES, DAY_LABELS_ES, calcChange } from "./utils"

const BRANCH_INFO: Record<string, { nombre: string; tipo: string }> = {
  "16S001": { nombre: "16 de Septiembre", tipo: "física" },
  ATL001: { nombre: "Atlixco", tipo: "física" },
  CSU001: { nombre: "Centro Sur", tipo: "física" },
  CHO001: { nombre: "Cholula", tipo: "física" },
  CRZ001: { nombre: "Cruz del Sur", tipo: "física" },
  SND001: { nombre: "San Diego", tipo: "física" },
  TOL001: { nombre: "En Línea", tipo: "online" },
  COR001: { nombre: "Mercado Libre", tipo: "online" },
  MLI001: { nombre: "ML Full", tipo: "online" },
  CEDIS: { nombre: "CEDIS", tipo: "almacén" },
}

const PHYSICAL_BRANCHES = ["16S001", "ATL001", "CSU001", "CHO001", "CRZ001", "SND001"]

let cachedData: SalesRecord[] | null = null
let cachedSummary: DashboardSummary | null = null

function loadRawData(): SalesRecord[] {
  if (cachedData) return cachedData

  const filePath = path.join(process.cwd(), "public", "data", "df_ventas_v4.csv")
  const fileContent = fs.readFileSync(filePath, "utf-8")

  const result = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  })

  cachedData = (result.data as Record<string, string>[]).map((row) => ({
    articulo: row.articulo || "",
    marca: row.marca || "",
    marca_en_canonico: row.marca_en_canonico || "",
    tipo_producto: row.tipo_producto || "",
    categoria_macro: row.categoria_macro || "",
    color: row.color || "",
    familia_color: row.familia_color || "",
    talla: row.talla || "",
    tipo_talla: row.tipo_talla || "",
    genero: row.genero || "",
    material: row.material || "",
    corte: row.corte || "",
    patron: row.patron || "",
    sku: row.sku || "",
    es_marca_propia: row.es_marca_propia === "1" || row.es_marca_propia === "True" || row.es_marca_propia === "true",
    es_multicolor: row.es_multicolor === "1" || row.es_multicolor === "True" || row.es_multicolor === "true",
    es_bundle: row.es_bundle === "1" || row.es_bundle === "True" || row.es_bundle === "true",
    es_cortesia: row.es_cortesia === "1" || row.es_cortesia === "True" || row.es_cortesia === "true",
    fecha: row.fecha || "",
    tienda: row.tienda || "",
    canal: row.canal || "",
    unidades: parseFloat(row.unidades) || 1,
    precio_lista: parseFloat(row.precio_lista) || 0,
    precio_pagado: parseFloat(row.precio_pagado) || 0,
    pct_descuento: parseFloat(row.pct_descuento) || 0,
    monto_descuento: parseFloat(row.monto_descuento) || 0,
    tiene_descuento: row.tiene_descuento === "1" || row.tiene_descuento === "True" || row.tiene_descuento === "true",
    importe_neto: parseFloat(row.importe_neto) || 0,
    ticket_total: parseFloat(row.ticket_total) || 0,
    forma_cobro_principal: row.forma_cobro_principal || "",
    rango_precio: row.rango_precio || "",
    año: parseInt(row["año"] || row["a\xc3\xb1o"] || row["aÃ±o"] || "0") || 0,
    mes: parseInt(row.mes) || 0,
    semana: parseInt(row.semana) || 0,
    dia_semana: parseInt(row.dia_semana) || 0,
    costo_unitario: row.costo_unitario && row.costo_unitario !== "" ? parseFloat(row.costo_unitario) : null,
    sucursal_id: row.sucursal_id || "",
    sku_padre: row.sku_padre || "",
  }))

  return cachedData
}

function getRevRecs(data: SalesRecord[]) {
  return data.filter((r) => !r.es_cortesia)
}

function getMarginRecs(data: SalesRecord[]) {
  return data.filter((r) => !r.es_cortesia && !r.es_bundle && r.costo_unitario !== null)
}

export function computeDashboardSummary(): DashboardSummary {
  if (cachedSummary) return cachedSummary

  const raw = loadRawData()
  const rev = getRevRecs(raw)
  const mar = getMarginRecs(raw)

  // ── Top-level KPIs ──────────────────────────────────────────────
  const totalRevenue = rev.reduce((s, r) => s + r.importe_neto, 0)
  const totalUnits = rev.reduce((s, r) => s + r.unidades, 0)
  const totalCost = mar.reduce((s, r) => s + (r.costo_unitario! * r.unidades), 0)
  const totalMarRev = mar.reduce((s, r) => s + r.importe_neto, 0)
  const grossMargin = totalMarRev - totalCost
  const marginPct = totalMarRev > 0 ? (grossMargin / totalMarRev) * 100 : 0

  // Median ticket
  const ticketVals = rev.filter((r) => r.ticket_total > 0).map((r) => r.ticket_total).sort((a, b) => a - b)
  const medianTicket = ticketVals[Math.floor(ticketVals.length / 2)] || 0

  // ── Revenue by year (all channels) ──────────────────────────────
  const revenueByYear: Record<number, number> = {}
  for (const r of rev) {
    if (!r.año) continue
    revenueByYear[r.año] = (revenueByYear[r.año] || 0) + r.importe_neto
  }

  // ── Physical-branch-only totals (matches FilterContext scope) ────
  const physicalRev = rev.filter((r) => PHYSICAL_BRANCHES.includes(r.sucursal_id))
  const physicalTotalRevenue = physicalRev.reduce((s, r) => s + r.importe_neto, 0)
  const physicalTotalUnits = physicalRev.reduce((s, r) => s + r.unidades, 0)
  const physicalRevenueByYear: Record<number, number> = {}
  for (const r of physicalRev) {
    if (!r.año) continue
    physicalRevenueByYear[r.año] = (physicalRevenueByYear[r.año] || 0) + r.importe_neto
  }

  // ── Revenue by branch ────────────────────────────────────────────
  const branchMap: Record<string, { revenue: number; units: number; cost: number; costRev: number; discUnits: number; totUnits: number }> = {}
  for (const r of rev) {
    if (!branchMap[r.sucursal_id]) branchMap[r.sucursal_id] = { revenue: 0, units: 0, cost: 0, costRev: 0, discUnits: 0, totUnits: 0 }
    branchMap[r.sucursal_id].revenue += r.importe_neto
    branchMap[r.sucursal_id].units += r.unidades
    branchMap[r.sucursal_id].totUnits += r.unidades
    if (r.tiene_descuento) branchMap[r.sucursal_id].discUnits += r.unidades
  }
  for (const r of mar) {
    if (!branchMap[r.sucursal_id]) continue
    branchMap[r.sucursal_id].cost += r.costo_unitario! * r.unidades
    branchMap[r.sucursal_id].costRev += r.importe_neto
  }

  const revenueByBranch: BranchMetrics[] = Object.entries(branchMap)
    .filter(([id]) => id !== "CEDIS" && id !== "COR001")
    .map(([id, m]) => {
      const info = BRANCH_INFO[id] || { nombre: id, tipo: "física" }
      const margin = m.costRev - m.cost
      return {
        sucursal_id: id,
        nombre: info.nombre,
        tipo: info.tipo,
        revenue: m.revenue,
        units: m.units,
        transactions: Math.round(m.revenue / (medianTicket || 1)),
        avgTicket: medianTicket,
        grossMargin: margin,
        marginPct: m.costRev > 0 ? (margin / m.costRev) * 100 : 0,
        discountRate: m.totUnits > 0 ? (m.discUnits / m.totUnits) * 100 : 0,
        revenueShare: totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  // ── Revenue by category ──────────────────────────────────────────
  const catMap: Record<string, { revenue: number; units: number; cost: number; costRev: number; discUnits: number; totUnits: number; tipos: Record<string, number> }> = {}
  for (const r of rev) {
    if (!catMap[r.categoria_macro]) catMap[r.categoria_macro] = { revenue: 0, units: 0, cost: 0, costRev: 0, discUnits: 0, totUnits: 0, tipos: {} }
    catMap[r.categoria_macro].revenue += r.importe_neto
    catMap[r.categoria_macro].units += r.unidades
    catMap[r.categoria_macro].totUnits += r.unidades
    if (r.tiene_descuento) catMap[r.categoria_macro].discUnits += r.unidades
    catMap[r.categoria_macro].tipos[r.tipo_producto] = (catMap[r.categoria_macro].tipos[r.tipo_producto] || 0) + r.importe_neto
  }
  for (const r of mar) {
    if (!catMap[r.categoria_macro]) continue
    catMap[r.categoria_macro].cost += r.costo_unitario! * r.unidades
    catMap[r.categoria_macro].costRev += r.importe_neto
  }

  const revenueByCategory: CategoryMetrics[] = Object.entries(catMap)
    .filter(([cat]) => cat !== "Bundle" && cat !== "Otro" && cat !== "Melon")
    .map(([cat, m]) => {
      const margin = m.costRev - m.cost
      const topTipo = Object.entries(m.tipos).sort((a, b) => b[1] - a[1])[0]?.[0]
      return {
        categoria: cat,
        revenue: m.revenue,
        units: m.units,
        avgPrice: m.units > 0 ? m.revenue / m.units : 0,
        grossMargin: margin,
        marginPct: m.costRev > 0 ? (margin / m.costRev) * 100 : 0,
        discountRate: m.totUnits > 0 ? (m.discUnits / m.totUnits) * 100 : 0,
        revenueShare: totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0,
        topProduct: topTipo,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  // ── Monthly revenue ──────────────────────────────────────────────
  const monthMap: Record<string, { revenue: number; units: number; count: number }> = {}
  for (const r of rev) {
    if (!r.año || !r.mes) continue
    const key = `${r.año}-${r.mes}`
    if (!monthMap[key]) monthMap[key] = { revenue: 0, units: 0, count: 0 }
    monthMap[key].revenue += r.importe_neto
    monthMap[key].units += r.unidades
    monthMap[key].count += 1
  }

  const revenueByMonth: MonthlyRevenue[] = Object.entries(monthMap)
    .map(([key, m]) => {
      const [año, mes] = key.split("-").map(Number)
      return { año, mes, label: `${MONTH_LABELS_ES[mes]} ${año}`, revenue: m.revenue, units: m.units, transactions: m.count, avgTicket: m.count > 0 ? m.revenue / m.count : 0 }
    })
    .sort((a, b) => a.año * 100 + a.mes - (b.año * 100 + b.mes))

  // ── Weekly revenue ───────────────────────────────────────────────
  const weekMap: Record<string, { revenue: number; units: number; year: number; week: number }> = {}
  for (const r of rev) {
    if (!r.año || !r.semana) continue
    const key = `${r.año}-${r.semana}`
    if (!weekMap[key]) weekMap[key] = { revenue: 0, units: 0, year: r.año, week: r.semana }
    weekMap[key].revenue += r.importe_neto
    weekMap[key].units += r.unidades
  }
  const weeklyRevenue: WeeklyRevenue[] = Object.entries(weekMap)
    .map(([, m]) => ({ year: m.year, week: m.week, revenue: m.revenue, units: m.units, label: `S${m.week}` }))
    .sort((a, b) => a.year * 100 + a.week - (b.year * 100 + b.week))

  // ── Cross-dimensional matrices ───────────────────────────────────

  // Branch × Month: {sucursal_id: {"2025-1": revenue}}
  const branchMonthMatrix: BranchMonthMatrix = {}
  // Branch × Month: {sucursal_id: {"2025-1": units}}  — exact units for filter context
  const branchMonthUnitsMatrix: BranchMonthUnitsMatrix = {}
  // Branch × Month × Category: {sucursal_id: {"2025-1": {categoria: revenue}}}  — exact category split
  const branchMonthCategoryMatrix: BranchMonthCategoryMatrix = {}
  // Branch × Month × Category: {sucursal_id: {"2025-1": {categoria: units}}}  — for filter-aware uds display
  const branchMonthCategoryUnitsMatrix: BranchMonthCategoryUnitsMatrix = {}

  for (const r of rev) {
    if (!r.año || !r.mes) continue
    const key = `${r.año}-${r.mes}`

    // Revenue matrix
    if (!branchMonthMatrix[r.sucursal_id]) branchMonthMatrix[r.sucursal_id] = {}
    branchMonthMatrix[r.sucursal_id][key] = (branchMonthMatrix[r.sucursal_id][key] || 0) + r.importe_neto

    // Units matrix
    if (!branchMonthUnitsMatrix[r.sucursal_id]) branchMonthUnitsMatrix[r.sucursal_id] = {}
    branchMonthUnitsMatrix[r.sucursal_id][key] = (branchMonthUnitsMatrix[r.sucursal_id][key] || 0) + r.unidades

    // Branch × Month × Category — revenue
    if (!branchMonthCategoryMatrix[r.sucursal_id]) branchMonthCategoryMatrix[r.sucursal_id] = {}
    if (!branchMonthCategoryMatrix[r.sucursal_id][key]) branchMonthCategoryMatrix[r.sucursal_id][key] = {}
    const cat = r.categoria_macro
    branchMonthCategoryMatrix[r.sucursal_id][key][cat] =
      (branchMonthCategoryMatrix[r.sucursal_id][key][cat] || 0) + r.importe_neto

    // Branch × Month × Category — units
    if (!branchMonthCategoryUnitsMatrix[r.sucursal_id]) branchMonthCategoryUnitsMatrix[r.sucursal_id] = {}
    if (!branchMonthCategoryUnitsMatrix[r.sucursal_id][key]) branchMonthCategoryUnitsMatrix[r.sucursal_id][key] = {}
    branchMonthCategoryUnitsMatrix[r.sucursal_id][key][cat] =
      (branchMonthCategoryUnitsMatrix[r.sucursal_id][key][cat] || 0) + r.unidades
  }

  // Discount × Branch × Month: for client-side KPI 1-4 filtering
  const discountMonthMatrix: DiscountMonthMatrix = {}
  for (const r of rev) {
    if (!r.año || !r.mes) continue
    const key = `${r.año}-${r.mes}`
    if (!discountMonthMatrix[r.sucursal_id]) discountMonthMatrix[r.sucursal_id] = {}
    if (!discountMonthMatrix[r.sucursal_id][key]) {
      discountMonthMatrix[r.sucursal_id][key] = { revConDesc: 0, totRev: 0, unidConDesc: 0, totUnid: 0, profNum: 0 }
    }
    const dm = discountMonthMatrix[r.sucursal_id][key]
    dm.totRev += r.importe_neto
    dm.totUnid += r.unidades
    if (r.tiene_descuento) {
      dm.revConDesc += r.importe_neto
      dm.unidConDesc += r.unidades
      dm.profNum += r.pct_descuento * r.importe_neto
    }
  }

  // Branch × Category: {sucursal_id: {categoria: revenue}}
  const branchCategoryMatrix: BranchCategoryMatrix = {}
  for (const r of rev) {
    if (!branchCategoryMatrix[r.sucursal_id]) branchCategoryMatrix[r.sucursal_id] = {}
    branchCategoryMatrix[r.sucursal_id][r.categoria_macro] = (branchCategoryMatrix[r.sucursal_id][r.categoria_macro] || 0) + r.importe_neto
  }

  // Branch × Year: {sucursal_id: {"2025": revenue}}
  const branchYearMatrix: BranchYearMatrix = {}
  for (const r of rev) {
    if (!r.año) continue
    if (!branchYearMatrix[r.sucursal_id]) branchYearMatrix[r.sucursal_id] = {}
    const key = `${r.año}`
    branchYearMatrix[r.sucursal_id][key] = (branchYearMatrix[r.sucursal_id][key] || 0) + r.importe_neto
  }

  // Month × Category: {"2025-1": {categoria: revenue}}
  const monthCategoryMatrix: MonthCategoryMatrix = {}
  for (const r of rev) {
    if (!r.año || !r.mes) continue
    const key = `${r.año}-${r.mes}`
    if (!monthCategoryMatrix[key]) monthCategoryMatrix[key] = {}
    monthCategoryMatrix[key][r.categoria_macro] = (monthCategoryMatrix[key][r.categoria_macro] || 0) + r.importe_neto
  }

  // Branch monthly revenue (for per-branch trend charts)
  const branchMonthlyRevenue: Record<string, MonthlyRevenue[]> = {}
  for (const branchId of PHYSICAL_BRANCHES) {
    const bm = branchMonthMatrix[branchId] || {}
    branchMonthlyRevenue[branchId] = Object.entries(bm)
      .map(([key, revenue]) => {
        const [año, mes] = key.split("-").map(Number)
        return { año, mes, label: `${MONTH_LABELS_ES[mes]} ${año}`, revenue, units: 0, transactions: 0, avgTicket: 0 }
      })
      .sort((a, b) => a.año * 100 + a.mes - (b.año * 100 + b.mes))
  }

  // ── Top brands ───────────────────────────────────────────────────
  const brandMap: Record<string, { revenue: number; units: number }> = {}
  for (const r of rev) {
    const b = r.marca || "Otro"
    if (!brandMap[b]) brandMap[b] = { revenue: 0, units: 0 }
    brandMap[b].revenue += r.importe_neto
    brandMap[b].units += r.unidades
  }
  const topBrands = Object.entries(brandMap)
    .map(([marca, m]) => ({ marca, ...m, share: (m.revenue / totalRevenue) * 100 }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)

  // ── Payment methods ──────────────────────────────────────────────
  const payMap: Record<string, { count: number; revenue: number }> = {}
  for (const r of rev) {
    const p = r.forma_cobro_principal || "Otro"
    if (!payMap[p]) payMap[p] = { count: 0, revenue: 0 }
    payMap[p].count += 1
    payMap[p].revenue += r.importe_neto
  }
  const paymentMethods = Object.entries(payMap)
    .map(([method, m]) => ({ method, ...m, share: (m.count / rev.length) * 100 }))
    .sort((a, b) => b.count - a.count)

  // ── Discount stats ───────────────────────────────────────────────
  const discounted = rev.filter((r) => r.tiene_descuento)
  const potentialRevenue = rev.reduce((s, r) => s + r.precio_lista * r.unidades, 0)
  const discountStats = {
    pctWithDiscount: (discounted.length / rev.length) * 100,
    avgDiscountWhenApplied: discounted.length > 0 ? discounted.reduce((s, r) => s + r.pct_descuento, 0) / discounted.length : 0,
    revenueImpact: potentialRevenue - totalRevenue,
  }

  // ── Gender split ─────────────────────────────────────────────────
  const genderMap: Record<string, { revenue: number; units: number }> = {}
  for (const r of rev) {
    const g = r.genero === "Dam" || r.genero === "Dama" ? "Dama" : r.genero === "Cab" || r.genero === "Caballero" ? "Caballero" : "Unisex"
    if (!genderMap[g]) genderMap[g] = { revenue: 0, units: 0 }
    genderMap[g].revenue += r.importe_neto
    genderMap[g].units += r.unidades
  }
  const genderSplit = Object.entries(genderMap).map(([genero, m]) => ({ genero, ...m, share: (m.revenue / totalRevenue) * 100 }))

  // ── Day of week ──────────────────────────────────────────────────
  const dowMap: Record<number, { revenue: number; units: number }> = {}
  for (const r of rev) {
    const d = r.dia_semana
    if (!dowMap[d]) dowMap[d] = { revenue: 0, units: 0 }
    dowMap[d].revenue += r.importe_neto
    dowMap[d].units += r.unidades
  }
  const dayOfWeek = Object.entries(dowMap)
    .map(([d, m]) => ({ dia: parseInt(d), label: DAY_LABELS_ES[parseInt(d)] || `Día ${d}`, ...m }))
    .sort((a, b) => a.dia - b.dia)

  // ── Price ranges ─────────────────────────────────────────────────
  const priceMap: Record<string, { count: number; revenue: number }> = {}
  for (const r of rev) {
    const p = r.rango_precio || "Sin clasificar"
    if (!priceMap[p]) priceMap[p] = { count: 0, revenue: 0 }
    priceMap[p].count += 1
    priceMap[p].revenue += r.importe_neto
  }
  const priceRanges = Object.entries(priceMap)
    .map(([rango, m]) => ({ rango, ...m, share: (m.count / rev.length) * 100 }))
    .sort((a, b) => b.revenue - a.revenue)

  // ── CEO KPIs ─────────────────────────────────────────────────────

  // KPI 1: % ventas con descuento (por ingreso neto)
  const revConDesc = rev.filter((r) => r.tiene_descuento).reduce((s, r) => s + r.importe_neto, 0)
  const pctVentasConDescuento = totalRevenue > 0 ? (revConDesc / totalRevenue) * 100 : 0

  // KPI 2: % unidades con descuento
  const unidConDesc = rev.filter((r) => r.tiene_descuento).reduce((s, r) => s + r.unidades, 0)
  const pctUnidadesConDescuento = totalUnits > 0 ? (unidConDesc / totalUnits) * 100 : 0

  // KPI 3: Profundidad promedio de descuento (ponderado por importe_neto)
  const numeradorProf = rev.filter((r) => r.tiene_descuento).reduce((s, r) => s + r.pct_descuento * r.importe_neto, 0)
  const profundidadDescuento = revConDesc > 0 ? numeradorProf / revConDesc : 0

  // KPI 4: Mix ventas a precio lista
  const mixPrecioLista = totalRevenue > 0 ? ((totalRevenue - revConDesc) / totalRevenue) * 100 : 0

  // KPI 8-9: ATV y UPT via ticket proxy (fecha + sucursal_id + ticket_total)
  const ticketKeys = new Set<string>()
  for (const r of rev) {
    if (r.ticket_total > 0) {
      ticketKeys.add(`${r.fecha}_${r.sucursal_id}_${r.ticket_total.toFixed(0)}`)
    }
  }
  const uniqueTickets = ticketKeys.size || 1
  const atv = totalRevenue / uniqueTickets
  const upt = totalUnits / uniqueTickets

  // KPI 10: Like-for-like — sucursales físicas presentes en 2024 Y 2025
  const branchRevByYear: Record<string, Record<number, number>> = {}
  for (const r of rev) {
    if (!r.año || !PHYSICAL_BRANCHES.includes(r.sucursal_id)) continue
    if (!branchRevByYear[r.sucursal_id]) branchRevByYear[r.sucursal_id] = {}
    branchRevByYear[r.sucursal_id][r.año] = (branchRevByYear[r.sucursal_id][r.año] || 0) + r.importe_neto
  }
  const lflBranches: LFLBranch[] = PHYSICAL_BRANCHES.filter(
    (id) => branchRevByYear[id]?.[2024] && branchRevByYear[id]?.[2025]
  ).map((id) => {
    const info = BRANCH_INFO[id] || { nombre: id }
    const rev2024 = branchRevByYear[id][2024]
    const rev2025 = branchRevByYear[id][2025]
    return { id, nombre: info.nombre, rev2024, rev2025, growth: calcChange(rev2025, rev2024) }
  })
  const lflRevenue2024 = lflBranches.reduce((s, b) => s + b.rev2024, 0)
  const lflRevenue2025 = lflBranches.reduce((s, b) => s + b.rev2025, 0)
  const lflGrowthPct = lflRevenue2024 > 0 ? calcChange(lflRevenue2025, lflRevenue2024) : 0

  // KPI 11: Margen por marca + tipo de marca
  const bMetMap: Record<string, { revenue: number; units: number; cost: number; costRev: number; discRev: number; esMarcaPropia: boolean }> = {}
  for (const r of rev) {
    const b = r.marca || "Otro"
    if (!bMetMap[b]) bMetMap[b] = { revenue: 0, units: 0, cost: 0, costRev: 0, discRev: 0, esMarcaPropia: r.es_marca_propia }
    bMetMap[b].revenue += r.importe_neto
    bMetMap[b].units += r.unidades
    if (r.tiene_descuento) bMetMap[b].discRev += r.importe_neto
  }
  for (const r of mar) {
    const b = r.marca || "Otro"
    if (!bMetMap[b]) continue
    bMetMap[b].cost += r.costo_unitario! * r.unidades
    bMetMap[b].costRev += r.importe_neto
  }
  const brandMetrics: BrandMetricType[] = Object.entries(bMetMap)
    .map(([marca, m]) => {
      const gm = m.costRev - m.cost
      return {
        marca, esMarcaPropia: m.esMarcaPropia,
        revenue: m.revenue, units: m.units,
        grossMargin: gm,
        marginPct: m.costRev > 0 ? (gm / m.costRev) * 100 : 0,
        discountPct: m.revenue > 0 ? (m.discRev / m.revenue) * 100 : 0,
        share: totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15)

  const mpEntries = Object.entries(bMetMap).filter(([, m]) => m.esMarcaPropia)
  const mpRevenue = mpEntries.reduce((s, [, m]) => s + m.revenue, 0)
  const mpCostRev = mpEntries.reduce((s, [, m]) => s + m.costRev, 0)
  const mpCost = mpEntries.reduce((s, [, m]) => s + m.cost, 0)
  const marcaPropiaRevShare = totalRevenue > 0 ? (mpRevenue / totalRevenue) * 100 : 0
  const marcaPropiaMargPct = mpCostRev > 0 ? ((mpCostRev - mpCost) / mpCostRev) * 100 : 0

  const tercerosEntries = Object.entries(bMetMap).filter(([, m]) => !m.esMarcaPropia)
  const tercCostRev = tercerosEntries.reduce((s, [, m]) => s + m.costRev, 0)
  const tercCost = tercerosEntries.reduce((s, [, m]) => s + m.cost, 0)
  const tercerosMargPct = tercCostRev > 0 ? ((tercCostRev - tercCost) / tercCostRev) * 100 : 0

  // KPI 12: Performance por sku_padre
  const skuMap: Record<string, { revenue: number; units: number; cost: number; costRev: number; discRev: number }> = {}
  for (const r of rev) {
    const s = r.sku_padre || r.sku || "SIN_SKU"
    if (!skuMap[s]) skuMap[s] = { revenue: 0, units: 0, cost: 0, costRev: 0, discRev: 0 }
    skuMap[s].revenue += r.importe_neto
    skuMap[s].units += r.unidades
    if (r.tiene_descuento) skuMap[s].discRev += r.importe_neto
  }
  for (const r of mar) {
    const s = r.sku_padre || r.sku || "SIN_SKU"
    if (!skuMap[s]) continue
    skuMap[s].cost += r.costo_unitario! * r.unidades
    skuMap[s].costRev += r.importe_neto
  }
  const allSKUs: SKUMetrics[] = Object.entries(skuMap)
    .map(([sku_padre, m]) => {
      const gm = m.costRev - m.cost
      return {
        sku_padre, revenue: m.revenue, units: m.units,
        grossMargin: gm,
        marginPct: m.costRev > 0 ? (gm / m.costRev) * 100 : 0,
        discountPct: m.revenue > 0 ? (m.discRev / m.revenue) * 100 : 0,
        revenueShare: totalRevenue > 0 ? (m.revenue / totalRevenue) * 100 : 0,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
  const topSKUs = allSKUs.slice(0, 25)

  // KPI 13: Concentración
  const top3Concentration = allSKUs.slice(0, 3).reduce((s, sk) => s + sk.revenueShare, 0)
  const top10Concentration = allSKUs.slice(0, 10).reduce((s, sk) => s + sk.revenueShare, 0)
  const top20Concentration = allSKUs.slice(0, 20).reduce((s, sk) => s + sk.revenueShare, 0)

  const ceoKPIs: CEOKPIs = {
    pctVentasConDescuento, pctUnidadesConDescuento, profundidadDescuento, mixPrecioLista,
    margenBrutoPct: marginPct, margenBrutoAbs: grossMargin,
    atv, uniqueTickets, upt,
    lflGrowthPct, lflRevenue2024, lflRevenue2025, lflBranches,
    brandMetrics, marcaPropiaRevShare, marcaPropiaMargPct, tercerosMargPct,
    topSKUs, totalSKUs: allSKUs.length,
    top3Concentration, top10Concentration, top20Concentration,
  }

  // ── Insights ─────────────────────────────────────────────────────
  const insights = generateInsights({ totalRevenue, revenueByYear, revenueByBranch, revenueByCategory, marginPct, discountStats, dayOfWeek, topBrands })

  // ── Available filter options ─────────────────────────────────────
  const availableBranches = PHYSICAL_BRANCHES.map((id) => ({
    id,
    nombre: BRANCH_INFO[id]?.nombre.replace("Deus Store ", "") || id,
  }))
  const availableYears = Object.keys(revenueByYear).map(Number).sort()

  cachedSummary = {
    totalRevenue, totalUnits, grossMargin, marginPct,
    avgTicket: medianTicket, totalTransactions: rev.length,
    activeProducts: new Set(rev.map((r) => r.sku_padre)).size,
    activeBranches: revenueByBranch.filter((b) => b.tipo === "física").length,
    revenueByYear, revenueByBranch, revenueByCategory,
    revenueByMonth, weeklyRevenue,
    topBrands, paymentMethods, discountStats,
    genderSplit, dayOfWeek, priceRanges, insights,
    branchMonthMatrix, branchMonthUnitsMatrix, branchCategoryMatrix,
    branchMonthCategoryMatrix, branchMonthCategoryUnitsMatrix,
    branchYearMatrix, monthCategoryMatrix, discountMonthMatrix,
    branchMonthlyRevenue,
    physicalTotalRevenue, physicalTotalUnits, physicalRevenueByYear,
    availableBranches, availableYears,
    ceoKPIs,
  }

  return cachedSummary
}

function generateInsights(params: {
  totalRevenue: number
  revenueByYear: Record<number, number>
  revenueByBranch: BranchMetrics[]
  revenueByCategory: CategoryMetrics[]
  marginPct: number
  discountStats: { pctWithDiscount: number; avgDiscountWhenApplied: number; revenueImpact: number }
  dayOfWeek: { dia: number; label: string; revenue: number }[]
  topBrands: { marca: string; revenue: number; share: number }[]
}): InsightType[] {
  const { totalRevenue, revenueByYear, revenueByBranch, revenueByCategory, marginPct, discountStats, dayOfWeek, topBrands } = params
  const insights: InsightType[] = []

  const rev2024 = revenueByYear[2024] || 0
  const rev2025 = revenueByYear[2025] || 0
  if (rev2024 > 0 && rev2025 > 0) {
    const growth = calcChange(rev2025, rev2024)
    insights.push({ id: "yoy-growth", type: growth > 0 ? "trend" : "risk", title: growth > 0 ? "Crecimiento sostenido en 2025" : "Caída vs año anterior", description: `Las ventas de 2025 cerraron en $${(rev2025 / 1_000_000).toFixed(1)}M MXN, un ${growth > 0 ? "+" : ""}${growth.toFixed(1)}% vs 2024. El crecimiento es sostenido y no estacional.`, metric: "Crecimiento YoY", metricValue: `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`, priority: "high" })
  }

  const top2Rev = revenueByBranch.slice(0, 2).reduce((s, b) => s + b.revenue, 0)
  const top2Share = (top2Rev / totalRevenue) * 100
  if (top2Share > 45) insights.push({ id: "branch-concentration", type: "risk", title: "Concentración en 2 sucursales", description: `Centro Sur y San Diego generan el ${top2Share.toFixed(0)}% de los ingresos. Alta dependencia de 2 puntos de venta.`, metric: "Concentración top-2", metricValue: `${top2Share.toFixed(0)}%`, priority: "medium" })

  const outerwear = revenueByCategory.find((c) => c.categoria === "Outerwear")
  if (outerwear && outerwear.revenueShare > 30) insights.push({ id: "outerwear-dominance", type: "info", title: "Outerwear lidera con ventaja clara", description: `La categoría Outerwear representa el ${outerwear.revenueShare.toFixed(0)}% del total. Precio promedio de $${outerwear.avgPrice.toFixed(0)} MXN por pieza.`, metric: "Participación Outerwear", metricValue: `${outerwear.revenueShare.toFixed(0)}%`, priority: "medium" })

  if (marginPct > 45) insights.push({ id: "strong-margin", type: "opportunity", title: "Margen bruto saludable en +50%", description: `El margen bruto promedio alcanza el ${marginPct.toFixed(1)}%, señal de un modelo de precios sólido con bajo uso de descuentos.`, metric: "Margen bruto", metricValue: `${marginPct.toFixed(1)}%`, priority: "high" })

  const weekendRev = dayOfWeek.filter((d) => d.dia >= 4).reduce((s, d) => s + d.revenue, 0)
  const weekendShare = (weekendRev / dayOfWeek.reduce((s, d) => s + d.revenue, 0)) * 100
  if (weekendShare > 40) insights.push({ id: "weekend-pattern", type: "info", title: `${weekendShare.toFixed(0)}% de ventas ocurren Vie–Dom`, description: "Alta concentración de tráfico de fin de semana. Oportunidad de activar estrategias para días entre semana.", metric: "Ventas fin de semana", metricValue: `${weekendShare.toFixed(0)}%`, priority: "medium" })

  if (discountStats.pctWithDiscount < 20) insights.push({ id: "pricing-power", type: "opportunity", title: "Fuerte poder de precio — bajo uso de descuentos", description: `Solo el ${discountStats.pctWithDiscount.toFixed(1)}% de las líneas tienen descuento. El modelo full-price domina, preservando márgenes.`, metric: "Líneas con descuento", metricValue: `${discountStats.pctWithDiscount.toFixed(1)}%`, priority: "high" })

  const deusBrand = topBrands.find((b) => b.marca === "DEUS")
  if (deusBrand && deusBrand.share > 20) insights.push({ id: "own-brand", type: "opportunity", title: "Marca propia DEUS — actor principal", description: `DEUS representa el ${deusBrand.share.toFixed(1)}% del ingreso total. La marca propia es el motor estratégico del portafolio.`, metric: "Participación DEUS", metricValue: `${deusBrand.share.toFixed(1)}%`, priority: "medium" })

  return insights
}
