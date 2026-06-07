export interface SalesRecord {
  articulo: string
  marca: string
  marca_en_canonico: string
  tipo_producto: string
  categoria_macro: string
  color: string
  familia_color: string
  talla: string
  tipo_talla: string
  genero: string
  material: string
  corte: string
  patron: string
  sku: string
  es_marca_propia: boolean
  es_multicolor: boolean
  es_bundle: boolean
  es_cortesia: boolean
  fecha: string
  tienda: string
  canal: string
  unidades: number
  precio_lista: number
  precio_pagado: number
  pct_descuento: number
  monto_descuento: number
  tiene_descuento: boolean
  importe_neto: number
  ticket_total: number
  forma_cobro_principal: string
  rango_precio: string
  año: number
  mes: number
  semana: number
  dia_semana: number
  costo_unitario: number | null
  sucursal_id: string
  sku_padre: string
}

export interface BranchInfo {
  sucursal_id: string
  nombre: string
  tipo: 'física' | 'online' | 'almacén'
}

export interface KPIData {
  value: number
  previousValue?: number
  change?: number
  changeType?: 'increase' | 'decrease' | 'neutral'
}

export interface BranchMetrics {
  sucursal_id: string
  nombre: string
  tipo: string
  revenue: number
  units: number
  transactions: number
  avgTicket: number
  grossMargin: number
  marginPct: number
  discountRate: number
  revenueShare: number
}

export interface CategoryMetrics {
  categoria: string
  revenue: number
  units: number
  avgPrice: number
  grossMargin: number
  marginPct: number
  discountRate: number
  revenueShare: number
  topProduct?: string
}

export interface MonthlyRevenue {
  año: number
  mes: number
  label: string
  revenue: number
  units: number
  transactions: number
  avgTicket: number
}

export interface WeeklyRevenue {
  year: number
  week: number
  revenue: number
  units: number
  label: string
}

export interface InsightType {
  id: string
  type: 'opportunity' | 'risk' | 'trend' | 'anomaly' | 'info'
  title: string
  description: string
  metric?: string
  metricValue?: string
  priority: 'high' | 'medium' | 'low'
}

// Cross-dimensional data: {sucursal_id: {"2025-01": revenue, ...}}
export type BranchMonthMatrix = Record<string, Record<string, number>>
// {sucursal_id: {"2025-01": units}}  — exact units per branch×month
export type BranchMonthUnitsMatrix = Record<string, Record<string, number>>
// {sucursal_id: {categoria: revenue}}
export type BranchCategoryMatrix = Record<string, Record<string, number>>
// {sucursal_id: {year: revenue}}
export type BranchYearMatrix = Record<string, Record<string, number>>
// {"2025-01": {categoria: revenue}}
export type MonthCategoryMatrix = Record<string, Record<string, number>>
// {sucursal_id: {"2025-1": {categoria: revenue}}}  — exact 3-D for category filter
export type BranchMonthCategoryMatrix = Record<string, Record<string, Record<string, number>>>
// {sucursal_id: {"2025-1": {categoria: units}}}
export type BranchMonthCategoryUnitsMatrix = Record<string, Record<string, Record<string, number>>>
// ── Producto distribution matrices (physical branches only) ──────────────────
// {sucursal_id: {"2025-1": {familia_color: {rev, units}}}}
export type BranchMonthColorFamilyMatrix = Record<string, Record<string, Record<string, { rev: number; units: number }>>>
// {sucursal_id: {"2025-1": {color: {rev, units}}}}
export type BranchMonthColorMatrix = Record<string, Record<string, Record<string, { rev: number; units: number }>>>
// {sucursal_id: {"2025-1": {tipo_talla: {talla: {rev, units}}}}}
export type BranchMonthSizeMatrix = Record<string, Record<string, Record<string, Record<string, { rev: number; units: number }>>>>
// {sucursal_id: {"2025-1": {categoria: {tipo_producto: {rev, units}}}}}
export type BranchMonthProductTypeMatrix = Record<string, Record<string, Record<string, Record<string, { rev: number; units: number }>>>>

// {sucursal_id: {"2025-1": {sku_padre: {revenue, units, unidConDesc, totUnid, grossMargin, importe_neto_mar}}}}
// Physical branches only, top-200 SKUs by physical-branch revenue
export type BranchMonthSKUMatrix = Record<string, Record<string, Record<string, {
  revenue: number; units: number; unidConDesc: number; totUnid: number
  grossMargin: number; importe_neto_mar: number
}>>>

// {sucursal_id: {"2025-1": {grossMargin, importe_neto}}}
export type BranchMonthMarginMatrix = Record<string, Record<string, { grossMargin: number; importe_neto: number }>>
// {sucursal_id: {"2025-1": {categoria: {grossMargin, importe_neto}}}}
export type BranchMonthCategoryMarginMatrix = Record<string, Record<string, Record<string, { grossMargin: number; importe_neto: number }>>>
// {sucursal_id: {"2025-1": {categoria: {revConDesc, totRev, unidConDesc, totUnid}}}}
export type BranchMonthCategoryDiscountMatrix = Record<string, Record<string, Record<string, { revConDesc: number; totRev: number; unidConDesc: number; totUnid: number }>>>
// {sucursal_id: {"2025-1": {rango: {count, revenue}}}}
export type BranchMonthPriceRangeMatrix = Record<string, Record<string, Record<string, { count: number; revenue: number }>>>
// {sucursal_id: {"2025-1": {marca: {revenue, units}}}}
export type BranchMonthBrandMatrix = Record<string, Record<string, Record<string, { revenue: number; units: number }>>>
// {sucursal_id: {"2025-1": {forma_cobro: {count, revenue}}}}
export type BranchMonthPaymentMatrix = Record<string, Record<string, Record<string, { count: number; revenue: number }>>>
// {sucursal_id: {"2025-1": {genero: {revenue, units}}}}
export type BranchMonthGenderMatrix = Record<string, Record<string, Record<string, { revenue: number; units: number }>>>
// {sucursal_id: {"2025-1": {"0".."6": {revenue, units}}}}
export type BranchMonthDayOfWeekMatrix = Record<string, Record<string, Record<string, { revenue: number; units: number }>>>
// {sucursal_id: {"2025-1": unique ticket count}} — for filtered ATV/UPT
export type BranchMonthTicketCountMatrix = Record<string, Record<string, number>>

// {sucursal_id: {"2025-1": {discount KPI numerators}}}
export type DiscountMonthMatrix = Record<string, Record<string, {
  revConDesc: number
  totRev: number
  unidConDesc: number
  totUnid: number
  profNum: number  // SUM(pct_descuento × importe_neto) for discounted rows
}>>

// ── CEO KPI types ─────────────────────────────────────────────────────────────
export interface BrandMetrics {
  marca: string
  esMarcaPropia: boolean
  revenue: number
  units: number
  grossMargin: number
  marginPct: number
  discountPct: number
  share: number
}

export interface SKUMetrics {
  sku_padre: string
  revenue: number
  units: number
  grossMargin: number
  marginPct: number
  discountPct: number
  revenueShare: number
}

export interface LFLBranch {
  id: string
  nombre: string
  rev2024: number
  rev2025: number
  growth: number
}

export interface CEOKPIs {
  // KPI 1 — % ventas con descuento (por ingreso)
  pctVentasConDescuento: number
  // KPI 2 — % unidades con descuento
  pctUnidadesConDescuento: number
  // KPI 3 — Profundidad promedio de descuento (ponderado por ingreso)
  profundidadDescuento: number
  // KPI 4 — Mix ventas a precio lista
  mixPrecioLista: number
  // KPI 5 — Margen bruto
  margenBrutoPct: number
  margenBrutoAbs: number
  // KPI 8 — Ticket promedio ATV
  atv: number
  uniqueTickets: number
  // KPI 9 — Unidades por ticket UPT
  upt: number
  // KPI 10 — Like-for-like (sucursales en ambos años)
  lflGrowthPct: number
  lflRevenue2024: number
  lflRevenue2025: number
  lflBranches: LFLBranch[]
  // KPI 11 — Margen por marca / tipo de marca
  brandMetrics: BrandMetrics[]
  marcaPropiaRevShare: number
  marcaPropiaMargPct: number
  tercerosMargPct: number
  // KPI 12 — Performance por sku_padre (top 25)
  topSKUs: SKUMetrics[]
  totalSKUs: number
  // KPI 13 — Concentración top productos
  top3Concentration: number
  top10Concentration: number
  top20Concentration: number
}

export interface FilterState {
  selectedBranches: string[]   // empty = all physical branches
  selectedYears: number[]      // empty = all years
  selectedMonths: number[]     // 1-12, empty = all months
}

export interface DashboardSummary {
  totalRevenue: number
  totalUnits: number
  grossMargin: number
  marginPct: number
  avgTicket: number
  totalTransactions: number
  activeProducts: number
  activeBranches: number
  revenueByYear: Record<number, number>
  revenueByBranch: BranchMetrics[]
  revenueByCategory: CategoryMetrics[]
  revenueByMonth: MonthlyRevenue[]
  weeklyRevenue: WeeklyRevenue[]
  topBrands: { marca: string; revenue: number; units: number; share: number }[]
  paymentMethods: { method: string; count: number; revenue: number; share: number }[]
  discountStats: {
    pctWithDiscount: number
    avgDiscountWhenApplied: number
    revenueImpact: number
  }
  genderSplit: { genero: string; revenue: number; units: number; share: number }[]
  dayOfWeek: { dia: number; label: string; revenue: number; units: number }[]
  priceRanges: { rango: string; count: number; revenue: number; share: number }[]
  insights: InsightType[]
  // Cross-dimensional matrices for client-side filtering
  branchMonthMatrix: BranchMonthMatrix
  branchMonthUnitsMatrix: BranchMonthUnitsMatrix
  branchCategoryMatrix: BranchCategoryMatrix
  branchMonthCategoryMatrix: BranchMonthCategoryMatrix
  branchMonthCategoryUnitsMatrix: BranchMonthCategoryUnitsMatrix
  branchYearMatrix: BranchYearMatrix
  monthCategoryMatrix: MonthCategoryMatrix
  discountMonthMatrix: DiscountMonthMatrix
  branchMonthMarginMatrix: BranchMonthMarginMatrix
  branchMonthCategoryMarginMatrix: BranchMonthCategoryMarginMatrix
  branchMonthCategoryDiscountMatrix: BranchMonthCategoryDiscountMatrix
  branchMonthPriceRangeMatrix: BranchMonthPriceRangeMatrix
  branchMonthBrandMatrix: BranchMonthBrandMatrix
  branchMonthPaymentMatrix: BranchMonthPaymentMatrix
  branchMonthGenderMatrix: BranchMonthGenderMatrix
  branchMonthDayOfWeekMatrix: BranchMonthDayOfWeekMatrix
  branchMonthTicketCountMatrix: BranchMonthTicketCountMatrix
  // SKU matrix — physical branches, top-200 SKUs (for filterable KPI 12/13)
  branchMonthSKUMatrix: BranchMonthSKUMatrix
  // sku_padre → nombre de artículo (primer articulo visto por sku_padre)
  skuNameMap: Record<string, string>
  // Producto distribution matrices (physical branches, filter-compatible)
  branchMonthColorFamilyMatrix: BranchMonthColorFamilyMatrix
  branchMonthColorMatrix: BranchMonthColorMatrix
  branchMonthSizeMatrix: BranchMonthSizeMatrix
  branchMonthProductTypeMatrix: BranchMonthProductTypeMatrix
  colorFamilyMap: Record<string, string>  // color → familia_color
  // Monthly data per branch for drill-down
  branchMonthlyRevenue: Record<string, MonthlyRevenue[]>
  // Physical-branch-only totals (same scope as FilterContext's filteredRevenue)
  physicalTotalRevenue: number
  physicalTotalUnits: number
  physicalRevenueByYear: Record<number, number>
  // Available filter options
  availableBranches: { id: string; nombre: string }[]
  availableYears: number[]
  // CEO KPI scorecard
  ceoKPIs: CEOKPIs
}
