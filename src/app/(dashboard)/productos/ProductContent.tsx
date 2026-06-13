"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Package, Filter, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader"
import { InsightCard } from "@/components/cards/InsightCard"
import { CategoryPieChart } from "@/components/charts/BranchChart"
import { useFilter } from "@/contexts/FilterContext"
import { formatCurrency, formatNumber, formatPercentAbs, CHART_COLORS } from "@/lib/utils"
import type { DashboardSummary } from "@/lib/types"

// ── Types ────────────────────────────────────────────────────────────────────
type Metric = "revenue" | "units"

// ── Constants ────────────────────────────────────────────────────────────────
// Canonical alphabetic size order for Mexican fashion retail
const ALPHA_ORDER = [
  "XXS", "XS", "XCH", "CH", "S", "M", "L", "XL",
  "2XL", "XXL", "3XL", "XXXL", "4XL",
  "Único", "Única", "UNICO", "UNICA", "Talla Única",
]

// Approximate CSS colors per color family name fragment
const FAMILY_HUE: Record<string, string> = {
  negro:    "#18181b",
  blanco:   "#e2e8f0",
  azul:     "#3B82F6",
  marino:   "#1E3A8A",
  rojo:     "#EF4444",
  verde:    "#22C55E",
  café:     "#92400E",
  cafe:     "#92400E",
  gris:     "#6B7280",
  beige:    "#C9AA7C",
  crema:    "#EDE0C4",
  rosa:     "#EC4899",
  morado:   "#8B5CF6",
  naranja:  "#F97316",
  amarillo: "#EAB308",
  dorado:   "#D97706",
  plateado: "#9CA3AF",
  multi:    "#10B981",
}

function familyDotColor(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, color] of Object.entries(FAMILY_HUE)) {
    if (lower.includes(key)) return color
  }
  return "#CBD5E1"
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function sortAlpha(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const ai = ALPHA_ORDER.findIndex(x => x.toLowerCase() === a.toLowerCase())
    const bi = ALPHA_ORDER.findIndex(x => x.toLowerCase() === b.toLowerCase())
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

function sortNumeric(sizes: string[]) {
  return [...sizes].sort((a, b) => {
    const an = parseFloat(a), bn = parseFloat(b)
    if (isNaN(an) && isNaN(bn)) return a.localeCompare(b)
    if (isNaN(an)) return 1
    if (isNaN(bn)) return -1
    return an - bn
  })
}

// ── Sub-components ───────────────────────────────────────────────────────────
function MetricToggle({ metric, setMetric }: { metric: Metric; setMetric: (m: Metric) => void }) {
  return (
    <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5">
      {(["revenue", "units"] as Metric[]).map((m) => (
        <button
          key={m}
          onClick={() => setMetric(m)}
          className={`px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 ${
            metric === m
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          {m === "revenue" ? "Ingresos" : "Unidades"}
        </button>
      ))}
    </div>
  )
}

function HBar({
  label, value, maxValue, total, metric, color, index = 0,
}: {
  label: string
  value: number
  maxValue: number
  /** Sum of the full group — used to compute the % label */
  total: number
  metric: Metric
  color: string
  index?: number
}) {
  const barPct   = maxValue > 0 ? (value / maxValue) * 100 : 0
  const sharePct = total   > 0 ? (value / total)   * 100 : 0
  const fmt = metric === "revenue"
    ? formatCurrency(value, { compact: true })
    : formatNumber(value, { compact: true })

  return (
    <div className="flex items-center gap-2 group py-0.5">
      <span
        className="text-[11px] text-slate-600 text-right truncate flex-shrink-0"
        style={{ width: 80 }}
        title={label}
      >
        {label}
      </span>
      <div className="flex-1 h-4 bg-slate-50 rounded overflow-hidden">
        <motion.div
          className="h-full rounded"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.5, delay: index * 0.025, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      {/* Value + share percentage */}
      <span className="text-right tabular-nums flex-shrink-0 leading-none" style={{ width: 86 }}>
        <span className="text-[11px] font-bold text-slate-800">{fmt}</span>
        <span className="text-[10px] text-slate-400 ml-1">{sharePct.toFixed(0)}%</span>
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface ProductContentProps {
  data: DashboardSummary
}

export function ProductContent({ data }: ProductContentProps) {
  const { isFiltered, filter, filteredCategoryRevenue, filteredTopBrands, filteredPriceRanges } = useFilter()

  // ── UI state ──────────────────────────────────────────────────────────────
  const [metric, setMetric] = useState<Metric>("revenue")
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [trendFilter, setTrendFilter] = useState<"all" | "up" | "down">("all")

  // ── Active filter params (reused across memos) ────────────────────────────
  const activeBranches = useMemo(
    () => filter.selectedBranches.length > 0
      ? filter.selectedBranches
      : data.availableBranches.map((b) => b.id),
    [filter.selectedBranches, data.availableBranches],
  )
  const activeYears = useMemo(
    () => filter.selectedYears.length > 0 ? filter.selectedYears : data.availableYears,
    [filter.selectedYears, data.availableYears],
  )
  const activeMonths = filter.selectedMonths

  // ── Generic 3-D matrix aggregator (branch × month → dim → {rev,units}) ───
  function agg3D(
    matrix: Record<string, Record<string, Record<string, { rev: number; units: number }>>>,
  ): Record<string, { rev: number; units: number }> {
    const result: Record<string, { rev: number; units: number }> = {}
    for (const bid of activeBranches) {
      for (const [key, dimMap] of Object.entries(matrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        for (const [dim, v] of Object.entries(dimMap)) {
          if (!result[dim]) result[dim] = { rev: 0, units: 0 }
          result[dim].rev += v.rev
          result[dim].units += v.units
        }
      }
    }
    return result
  }

  // ── Color family (filter-aware) ──────────────────────────────────────────
  const colorFamilyData = useMemo(
    () => agg3D(data.branchMonthColorFamilyMatrix),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, data],
  )

  // ── Individual colors (filter-aware) ────────────────────────────────────
  const colorData = useMemo(
    () => agg3D(data.branchMonthColorMatrix),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, data],
  )

  // ── Sizes (filter-aware, 4-D) ────────────────────────────────────────────
  const sizeData = useMemo(() => {
    const result: Record<string, Record<string, { rev: number; units: number }>> = {}
    for (const bid of activeBranches) {
      for (const [key, tipMap] of Object.entries(data.branchMonthSizeMatrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        for (const [tip, tallaMap] of Object.entries(tipMap)) {
          if (!result[tip]) result[tip] = {}
          for (const [talla, v] of Object.entries(tallaMap)) {
            if (!result[tip][talla]) result[tip][talla] = { rev: 0, units: 0 }
            result[tip][talla].rev += v.rev
            result[tip][talla].units += v.units
          }
        }
      }
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, data])

  // ── Product types per category (filter-aware, 4-D) ───────────────────────
  const productTypeData = useMemo(() => {
    const result: Record<string, Record<string, { rev: number; units: number }>> = {}
    for (const bid of activeBranches) {
      for (const [key, catMap] of Object.entries(data.branchMonthProductTypeMatrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        for (const [cat, typeMap] of Object.entries(catMap)) {
          if (!result[cat]) result[cat] = {}
          for (const [tipo, v] of Object.entries(typeMap)) {
            if (!result[cat][tipo]) result[cat][tipo] = { rev: 0, units: 0 }
            result[cat][tipo].rev += v.rev
            result[cat][tipo].units += v.units
          }
        }
      }
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, data])

  // ── Derived display lists ────────────────────────────────────────────────
  const gv = (v: { rev: number; units: number }) => metric === "revenue" ? v.rev : v.units

  const sortedFamilies = useMemo(
    () => Object.entries(colorFamilyData)
      .map(([f, v]) => ({ family: f, ...v }))
      .sort((a, b) => gv(b) - gv(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colorFamilyData, metric],
  )
  const maxFamily     = sortedFamilies[0] ? gv(sortedFamilies[0]) : 1
  const totalFamilies = sortedFamilies.reduce((s, f) => s + gv(f), 0)

  const familyColors = useMemo(() => {
    if (!expandedFamily) return []
    return Object.entries(colorData)
      .filter(([c]) => (data.colorFamilyMap[c] || "") === expandedFamily)
      .map(([c, v]) => ({ color: c, ...v }))
      .sort((a, b) => gv(b) - gv(a))
      .slice(0, 14)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorData, expandedFamily, data.colorFamilyMap, metric])

  // Total for color drilldown = pre-computed family total (more accurate than summing top-14)
  const expandedFamilyTotal = expandedFamily
    ? gv(colorFamilyData[expandedFamily] || { rev: 0, units: 0 })
    : 0

  // Sizes: separate alphabetic and numeric groups
  const alphaSizes = useMemo(() => {
    const alphaKey = Object.keys(sizeData).find((k) => k.toLowerCase().startsWith("alfa")) || ""
    const entries = Object.entries(sizeData[alphaKey] || {})
      .map(([talla, v]) => ({ talla, ...v }))
    const sorted = sortAlpha(entries.map((e) => e.talla))
    return sorted.map((t) => entries.find((e) => e.talla === t)!).filter(Boolean)
  }, [sizeData])

  const numericSizes = useMemo(() => {
    const numKey = Object.keys(sizeData).find((k) => k.toLowerCase().startsWith("num")) || ""
    const entries = Object.entries(sizeData[numKey] || {})
      .map(([talla, v]) => ({ talla, ...v }))
    const sorted = sortNumeric(entries.map((e) => e.talla))
    return sorted.map((t) => entries.find((e) => e.talla === t)!).filter(Boolean)
  }, [sizeData])

  const maxAlpha    = Math.max(...alphaSizes.map(gv),   1)
  const maxNumeric  = Math.max(...numericSizes.map(gv), 1)
  const totalAlpha   = alphaSizes.reduce((s, x) => s + gv(x), 0)
  const totalNumeric = numericSizes.reduce((s, x) => s + gv(x), 0)

  // Product type chart
  const availableCategories = useMemo(
    () => Object.keys(productTypeData)
      .filter((c) => c !== "Bundle" && c !== "Otro" && c !== "Melon")
      .sort((a, b) =>
        (Object.values(productTypeData[b] || {}).reduce((s, v) => s + v.rev, 0)) -
        (Object.values(productTypeData[a] || {}).reduce((s, v) => s + v.rev, 0)),
      ),
    [productTypeData],
  )
  const effectiveCategory = (selectedCategory && productTypeData[selectedCategory])
    ? selectedCategory
    : availableCategories[0] || ""

  const categoryTypes = useMemo(() => {
    if (!effectiveCategory) return []
    return Object.entries(productTypeData[effectiveCategory] || {})
      .map(([tipo, v]) => ({ tipo, ...v }))
      .sort((a, b) => gv(b) - gv(a))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productTypeData, effectiveCategory, metric])
  const maxType   = categoryTypes[0] ? gv(categoryTypes[0]) : 1
  const totalTypes = categoryTypes.reduce((s, x) => s + gv(x), 0)

  // ── Filtered category metrics (units, margin, discount) ─────────────────
  const filteredCategoryMetrics = useMemo(() => {
    const result: Record<string, { units: number; grossMargin: number; importe_neto: number; revConDesc: number; unidConDesc: number; totUnid: number }> = {}
    const emptyRow = () => ({ units: 0, grossMargin: 0, importe_neto: 0, revConDesc: 0, unidConDesc: 0, totUnid: 0 })
    for (const bid of activeBranches) {
      // Units from branchMonthCategoryUnitsMatrix
      for (const [key, catMap] of Object.entries(data.branchMonthCategoryUnitsMatrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        for (const [cat, units] of Object.entries(catMap)) {
          if (!result[cat]) result[cat] = emptyRow()
          result[cat].units += units
        }
      }
      // Margin from branchMonthCategoryMarginMatrix
      for (const [key, catMap] of Object.entries(data.branchMonthCategoryMarginMatrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        for (const [cat, val] of Object.entries(catMap)) {
          if (!result[cat]) result[cat] = emptyRow()
          result[cat].grossMargin += val.grossMargin
          result[cat].importe_neto += val.importe_neto
        }
      }
      // Discount from branchMonthCategoryDiscountMatrix
      for (const [key, catMap] of Object.entries(data.branchMonthCategoryDiscountMatrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        for (const [cat, val] of Object.entries(catMap)) {
          if (!result[cat]) result[cat] = emptyRow()
          result[cat].revConDesc += val.revConDesc
          result[cat].unidConDesc += val.unidConDesc
          result[cat].totUnid += val.totUnid
        }
      }
    }
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, data])

  // ── Trending WoW (last 2 available months, filter-aware branches) ────────
  const { trendingRows, latestLabel, prevLabel } = useMemo(() => {
    const allKeys = new Set<string>()
    for (const bData of Object.values(data.branchMonthSKUMatrix)) {
      for (const k of Object.keys(bData)) allKeys.add(k)
    }
    const sorted = [...allKeys].sort((a, b) => {
      const [ay, am] = a.split("-").map(Number)
      const [by, bm] = b.split("-").map(Number)
      return ay !== by ? ay - by : am - bm
    })
    const latestKey = sorted[sorted.length - 1]
    const prevKey = sorted[sorted.length - 2]

    const MONTHS_ES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]
    const fmtKey = (k: string) => {
      const [y, m] = k.split("-").map(Number)
      return `${MONTHS_ES[m - 1]} ${y}`
    }

    const thisMo: Record<string, number> = {}
    const prevMo: Record<string, number> = {}
    for (const [branch, monthMap] of Object.entries(data.branchMonthSKUMatrix)) {
      if (!activeBranches.includes(branch)) continue
      for (const [sku, v] of Object.entries(monthMap[latestKey] ?? {})) {
        thisMo[sku] = (thisMo[sku] ?? 0) + v.units
      }
      for (const [sku, v] of Object.entries(monthMap[prevKey] ?? {})) {
        prevMo[sku] = (prevMo[sku] ?? 0) + v.units
      }
    }

    const rows = Object.entries(thisMo)
      .map(([sku, units]) => {
        const prev = prevMo[sku] ?? 0
        const change = units - prev
        const pctChange = prev > 0 ? change / prev : units > 0 ? 1 : 0
        const trend: "up" | "down" | "stable" =
          change > Math.max(prev * 0.1, 1) ? "up" : change < -Math.max(prev * 0.1, 1) ? "down" : "stable"
        return { sku, units, prev, change, pctChange, trend, name: data.skuNameMap[sku] ?? sku }
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 30)

    return { trendingRows: rows, latestLabel: latestKey ? fmtKey(latestKey) : "—", prevLabel: prevKey ? fmtKey(prevKey) : "—" }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeBranches])

  const visibleTrending = useMemo(
    () => trendingRows.filter((r) => trendFilter === "all" || r.trend === trendFilter).slice(0, 20),
    [trendingRows, trendFilter],
  )

  // ── SKU × Sucursal heatmap (top 15 SKUs, filter-aware) ────────────────────
  const skuBranchHeatmap = useMemo(() => {
    const skuTotals: Record<string, number> = {}
    const grid: Record<string, Record<string, number>> = {}
    for (const [branch, monthMap] of Object.entries(data.branchMonthSKUMatrix)) {
      if (!activeBranches.includes(branch)) continue
      for (const [key, skuMap] of Object.entries(monthMap)) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        for (const [sku, v] of Object.entries(skuMap)) {
          skuTotals[sku] = (skuTotals[sku] ?? 0) + v.units
          if (!grid[sku]) grid[sku] = {}
          grid[sku][branch] = (grid[sku][branch] ?? 0) + v.units
        }
      }
    }
    const topSKUs = Object.entries(skuTotals).sort(([, a], [, b]) => b - a).slice(0, 15).map(([s]) => s)
    const allVals = topSKUs.flatMap((s) => activeBranches.map((b) => grid[s]?.[b] ?? 0)).filter((v) => v > 0)
    allVals.sort((a, b) => a - b)
    const q1 = allVals[Math.floor(allVals.length * 0.25)] ?? 0
    const q2 = allVals[Math.floor(allVals.length * 0.5)] ?? 0
    const q3 = allVals[Math.floor(allVals.length * 0.75)] ?? 0
    return { topSKUs, grid, q1, q2, q3 }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeBranches, activeYears, activeMonths, filter])

  // ── Existing category display ────────────────────────────────────────────
  const displayCategories = isFiltered
    ? filteredCategoryRevenue.map((fc) => {
        const fm = filteredCategoryMetrics[fc.categoria]
        const s = data.revenueByCategory.find((c) => c.categoria === fc.categoria)
        return {
          categoria: fc.categoria,
          revenue: fc.revenue,
          revenueShare: fc.revenueShare,
          units: fm?.units ?? s?.units ?? 0,
          avgPrice: fm && fm.units > 0 ? fc.revenue / fm.units : s?.avgPrice ?? 0,
          grossMargin: fm?.grossMargin ?? s?.grossMargin ?? 0,
          marginPct: fm && fm.importe_neto > 0 ? (fm.grossMargin / fm.importe_neto) * 100 : s?.marginPct ?? 0,
          discountRate: fm && fm.totUnid > 0 ? (fm.unidConDesc / fm.totUnid) * 100 : s?.discountRate ?? 0,
        }
      })
    : data.revenueByCategory

  const topCat = displayCategories[0]

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        icon={Package}
        title="Inteligencia de Catálogo"
        subtitle="Categorías, tallas, colores y tipo de producto"
      />

      {/* Filter banner */}
      <AnimatePresence>
        {isFiltered && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 bg-indigo-50 border border-indigo-200/60 rounded-xl text-xs text-indigo-700">
              <Filter className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                Distribuciones filtradas por{" "}
                {filter.selectedBranches.length > 0 && (
                  <strong>{filter.selectedBranches.length} sucursal{filter.selectedBranches.length > 1 ? "es" : ""}</strong>
                )}
                {filter.selectedBranches.length > 0 && (filter.selectedYears.length > 0 || filter.selectedMonths.length > 0) && " · "}
                {filter.selectedYears.length > 0 && <strong>años {filter.selectedYears.join(", ")}</strong>}
                {filter.selectedYears.length > 0 && filter.selectedMonths.length > 0 && " · "}
                {filter.selectedMonths.length > 0 && <strong>meses seleccionados</strong>}.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Trending WoW ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-xl card-shadow overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SectionHeader
              title={`Trending esta semana · ${latestLabel} vs ${prevLabel}`}
              subtitle="Top 20 SKUs por velocidad de ventas — comparación mes a mes"
            />
            <div className="flex gap-1">
              {(["all", "up", "down"] as const).map((f) => {
                const Icon = f === "up" ? TrendingUp : f === "down" ? TrendingDown : Minus
                const label = f === "up" ? "Subiendo" : f === "down" ? "Bajando" : "Todos"
                const color = f === "up" ? "text-emerald-600" : f === "down" ? "text-red-500" : "text-slate-600"
                return (
                  <button
                    key={f}
                    onClick={() => setTrendFilter(f)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                      trendFilter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className={`w-3 h-3 ${trendFilter === f ? "text-white" : color}`} />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left py-2.5 pl-5 pr-2 text-[10px] font-semibold text-slate-400 uppercase w-8">#</th>
                <th className="text-left py-2.5 px-2 text-[10px] font-semibold text-slate-400 uppercase">SKU / Nombre</th>
                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-400 uppercase">{latestLabel}</th>
                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-400 uppercase">{prevLabel}</th>
                <th className="text-right py-2.5 px-3 text-[10px] font-semibold text-slate-400 uppercase">Cambio</th>
                <th className="text-center py-2.5 px-4 text-[10px] font-semibold text-slate-400 uppercase">Tendencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visibleTrending.map((r, i) => (
                <tr key={r.sku} className="hover:bg-slate-50/70 transition-colors">
                  <td className="pl-5 pr-2 py-2.5 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                  <td className="px-2 py-2.5">
                    <p className="font-medium text-slate-800 truncate max-w-[220px]">{r.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{r.sku}</p>
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900 tabular-nums">{formatNumber(r.units)}</td>
                  <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{formatNumber(r.prev)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className={`font-semibold ${r.change > 0 ? "text-emerald-600" : r.change < 0 ? "text-red-500" : "text-slate-400"}`}>
                      {r.change > 0 ? "+" : ""}{formatNumber(r.change)}
                    </span>
                    <span className={`text-[10px] ml-1 ${r.change > 0 ? "text-emerald-500" : r.change < 0 ? "text-red-400" : "text-slate-400"}`}>
                      {r.pctChange > 0 ? "+" : ""}{(r.pctChange * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {r.trend === "up" && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"><TrendingUp className="w-3 h-3" />subiendo</span>}
                    {r.trend === "down" && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full"><TrendingDown className="w-3 h-3" />bajando</span>}
                    {r.trend === "stable" && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"><Minus className="w-3 h-3" />estable</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleTrending.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-400">Sin datos para el filtro actual</p>
          )}
        </div>
      </motion.div>

      {/* ── Category table + Pie ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl card-shadow p-5">
          <SectionHeader
            title="Rendimiento por categoría"
            subtitle={isFiltered ? "Todas las métricas filtradas" : "Ingresos, margen y descuento"}
          />
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-2 text-slate-400 font-medium">Categoría</th>
                  <th className="text-right py-2 px-2 text-slate-400 font-medium">Ingreso</th>
                  <th className="text-right py-2 px-2 text-slate-400 font-medium">Part.</th>
                  <th className="text-right py-2 px-2 text-slate-400 font-medium">Margen</th>
                  <th className="text-right py-2 px-2 text-slate-400 font-medium">P. Prom.</th>
                  <th className="text-right py-2 px-2 text-slate-400 font-medium">Desc.</th>
                </tr>
              </thead>
              <tbody>
                {displayCategories.map((cat, i) => (
                  <motion.tr
                    key={cat.categoria}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.3 }}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                        <span className="font-semibold text-slate-800">{cat.categoria}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-900">{formatCurrency(cat.revenue, { compact: true })}</td>
                    <td className="py-2.5 px-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${cat.revenueShare}%`, background: CHART_COLORS[i] }} />
                        </div>
                        <span className="text-slate-600 font-semibold w-8">{cat.revenueShare.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className={`py-2.5 px-2 text-right font-semibold ${cat.marginPct > 50 ? "text-emerald-600" : cat.marginPct > 40 ? "text-amber-600" : "text-red-500"}`}>
                      {formatPercentAbs(cat.marginPct)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-600">{formatCurrency(cat.avgPrice)}</td>
                    <td className="py-2.5 px-2 text-right text-slate-500">{formatPercentAbs(cat.discountRate)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl card-shadow p-5">
          <SectionHeader
            title="Distribución visual"
            subtitle={isFiltered ? "Mix filtrado por categoría" : "Mix de categorías por ingreso"}
          />
          <div className="h-64">
            <CategoryPieChart data={displayCategories} />
          </div>
        </div>
      </div>

      {/* ── Metric toggle header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-700">Distribuciones de ventas</p>
          <p className="text-xs text-slate-400 mt-0.5">Tallas · Color · Tipo de producto · Compatibles con filtros</p>
        </div>
        <MetricToggle metric={metric} setMetric={setMetric} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TALLAS
          ════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Alphabetic sizes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl card-shadow p-5"
        >
          <SectionHeader
            title="Tallas alfabéticas"
            subtitle={`XS → XXL · ${alphaSizes.length} tallas`}
          />
          <div className="mt-3 space-y-0.5">
            {alphaSizes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Sin datos para el filtro actual</p>
            ) : (
              alphaSizes.map((s, i) => (
                <HBar
                  key={s.talla}
                  label={s.talla}
                  value={gv(s)}
                  maxValue={maxAlpha}
                  total={totalAlpha}
                  metric={metric}
                  color="#6366F1"
                  index={i}
                />
              ))
            )}
          </div>
        </motion.div>

        {/* Numeric sizes */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl card-shadow p-5"
        >
          <SectionHeader
            title="Tallas numéricas"
            subtitle={`Tallas de cintura / número · ${numericSizes.length} tallas`}
          />
          <div className="mt-3 space-y-0.5">
            {numericSizes.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Sin datos para el filtro actual</p>
            ) : (
              numericSizes.map((s, i) => (
                <HBar
                  key={s.talla}
                  label={s.talla}
                  value={gv(s)}
                  maxValue={maxNumeric}
                  total={totalNumeric}
                  metric={metric}
                  color="#8B5CF6"
                  index={i}
                />
              ))
            )}
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          COLOR POR FAMILIA (drilldown)
          ════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl card-shadow p-5"
      >
        <SectionHeader
          title="Color por familia"
          subtitle="Haz clic en una familia para ver los colores individuales"
        />

        <div className="mt-3 space-y-px">
          {sortedFamilies.map((fam, i) => {
            const isExpanded = expandedFamily === fam.family
            const dot = familyDotColor(fam.family)

            return (
              <div key={fam.family}>
                {/* Family row */}
                <button
                  onClick={() => setExpandedFamily(isExpanded ? null : fam.family)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  {/* Color dot */}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-black/10"
                    style={{ backgroundColor: dot }}
                  />
                  {/* Name */}
                  <span className="text-[11px] font-semibold text-slate-700 flex-shrink-0" style={{ width: 76 }}>
                    {fam.family}
                  </span>
                  {/* Bar */}
                  <div className="flex-1 h-4 bg-slate-50 rounded overflow-hidden">
                    <motion.div
                      className="h-full rounded"
                      style={{ backgroundColor: dot === "#e2e8f0" ? "#94a3b8" : dot }}
                      initial={{ width: 0 }}
                      animate={{ width: `${maxFamily > 0 ? (gv(fam) / maxFamily) * 100 : 0}%` }}
                      transition={{ duration: 0.5, delay: i * 0.03, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  {/* Metric value + % of total families */}
                  <span className="tabular-nums text-right flex-shrink-0 leading-none" style={{ width: 86 }}>
                    <span className="text-[11px] font-bold text-slate-800">
                      {metric === "revenue"
                        ? formatCurrency(fam.rev, { compact: true })
                        : formatNumber(fam.units, { compact: true })}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-1">
                      {totalFamilies > 0 ? ((gv(fam) / totalFamilies) * 100).toFixed(0) : 0}%
                    </span>
                  </span>
                  {/* Expand icon */}
                  <span className={`text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-0" : ""}`}>
                    {isExpanded
                      ? <ChevronDown className="w-3.5 h-3.5" />
                      : <ChevronRight className="w-3.5 h-3.5" />
                    }
                  </span>
                </button>

                {/* Drilldown — individual colors */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="pl-5 pr-2 py-1.5 space-y-0.5 border-l-2 ml-3 mb-1" style={{ borderColor: dot }}>
                        {familyColors.length === 0 ? (
                          <p className="text-[11px] text-slate-400 py-1">Sin datos individuales</p>
                        ) : (
                          familyColors.map((c, ci) => {
                            const maxC       = gv(familyColors[0])
                            const colorShare = expandedFamilyTotal > 0
                              ? ((gv(c) / expandedFamilyTotal) * 100).toFixed(0)
                              : "0"
                            return (
                              <div key={c.color} className="flex items-center gap-2">
                                <span
                                  className="text-[11px] text-slate-500 text-right flex-shrink-0 truncate"
                                  style={{ width: 68 }}
                                  title={c.color}
                                >
                                  {c.color}
                                </span>
                                <div className="flex-1 h-3 bg-slate-50 rounded overflow-hidden">
                                  <motion.div
                                    className="h-full rounded opacity-70"
                                    style={{ backgroundColor: dot }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${maxC > 0 ? (gv(c) / maxC) * 100 : 0}%` }}
                                    transition={{ duration: 0.4, delay: ci * 0.02, ease: [0.16, 1, 0.3, 1] }}
                                  />
                                </div>
                                {/* value + % of family */}
                                <span className="tabular-nums text-right flex-shrink-0 leading-none" style={{ width: 72 }}>
                                  <span className="text-[11px] font-semibold text-slate-700">
                                    {metric === "revenue"
                                      ? formatCurrency(c.rev, { compact: true })
                                      : formatNumber(c.units, { compact: true })}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-1">{colorShare}%</span>
                                </span>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </motion.div>

      {/* ══════════════════════════════════════════════════════════════════════
          TIPO DE PRODUCTO POR CATEGORÍA
          ════════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white rounded-xl card-shadow p-5"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <SectionHeader
            title="Tipo de producto por categoría"
            subtitle={`Mostrando: ${effectiveCategory || "—"}`}
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-150 ${
                cat === effectiveCategory
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Type bars */}
        <AnimatePresence mode="wait">
          <motion.div
            key={effectiveCategory + metric}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="space-y-0.5"
          >
            {categoryTypes.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Sin datos para el filtro actual</p>
            ) : (
              categoryTypes.map((t, i) => (
                <HBar
                  key={t.tipo}
                  label={t.tipo}
                  value={gv(t)}
                  maxValue={maxType}
                  total={totalTypes}
                  metric={metric}
                  color={CHART_COLORS[i % CHART_COLORS.length]}
                  index={i}
                />
              ))
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* ── SKU × Sucursal heatmap ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl card-shadow overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100">
          <SectionHeader
            title="Concentración SKU × Sucursal"
            subtitle="Top 15 SKUs · unidades vendidas por punto de venta — identifica gaps de distribución"
          />
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[10px] text-slate-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 inline-block border border-slate-200" />sin ventas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-100 inline-block" />Q1</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-300 inline-block" />Q2</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-500 inline-block" />Q3</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-700 inline-block" />Q4</span>
          </div>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="text-left text-[10px] font-semibold text-slate-400 px-2 py-1 max-w-[180px]">SKU</th>
                {activeBranches.map((b) => (
                  <th key={b} className="text-center text-[10px] font-semibold text-slate-500 px-1 py-1 w-14">{b}</th>
                ))}
                <th className="text-right text-[10px] font-semibold text-slate-400 px-2 py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {skuBranchHeatmap.topSKUs.map((sku) => {
                const total = activeBranches.reduce((s, b) => s + (skuBranchHeatmap.grid[sku]?.[b] ?? 0), 0)
                return (
                  <tr key={sku}>
                    <td className="text-[11px] text-slate-600 px-2 py-1 max-w-[180px]">
                      <p className="truncate font-medium">{data.skuNameMap[sku] ?? sku}</p>
                      <p className="text-[9px] text-slate-400">{sku}</p>
                    </td>
                    {activeBranches.map((b) => {
                      const v = skuBranchHeatmap.grid[sku]?.[b] ?? 0
                      const cls =
                        v === 0 ? "bg-slate-100 text-slate-300" :
                        v <= skuBranchHeatmap.q1 ? "bg-indigo-100 text-indigo-600" :
                        v <= skuBranchHeatmap.q2 ? "bg-indigo-300 text-indigo-900" :
                        v <= skuBranchHeatmap.q3 ? "bg-indigo-500 text-white" :
                        "bg-indigo-700 text-white"
                      return (
                        <td key={b} className="text-center py-1 px-0.5">
                          <span className={`inline-block w-12 text-[11px] font-semibold rounded py-1 tabular-nums ${cls}`}>
                            {v > 0 ? formatNumber(v, { compact: true }) : "—"}
                          </span>
                        </td>
                      )
                    })}
                    <td className="text-right text-[11px] font-bold text-slate-700 px-2 tabular-nums">{formatNumber(total, { compact: true })}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ── Brands performance (existing) ────────────────────────────────── */}
      <div className="bg-white rounded-xl card-shadow p-5">
        <SectionHeader title="Desempeño de marcas" subtitle={isFiltered ? "Selección filtrada" : "Portafolio completo ordenado por ingresos"} />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          {filteredTopBrands.map((brand, i) => (
            <motion.div
              key={brand.marca}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{brand.marca}</span>
                {i === 0 && (
                  <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">TOP</span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-900">{formatCurrency(brand.revenue, { compact: true })}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <div className="h-1 flex-1 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${brand.share}%`, background: CHART_COLORS[i] }} />
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{brand.share.toFixed(1)}%</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Price tier + Insights (existing) ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader title="Segmentación por precio" subtitle={isFiltered ? "Selección filtrada" : "Distribución de líneas por rango de precio"} />
          <div className="space-y-3 mt-3">
            {filteredPriceRanges.map((p, i) => (
              <motion.div
                key={p.rango}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.3 }}
                className="flex items-center gap-3"
              >
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                <span className="text-xs text-slate-600 font-medium flex-1 truncate">{p.rango}</span>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: CHART_COLORS[i] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.share}%` }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.07 }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-500 w-10 text-right">{p.share.toFixed(1)}%</span>
                <span className="text-[10px] text-slate-400 w-16 text-right hidden md:block">
                  {formatCurrency(p.revenue, { compact: true })}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <InsightCard
            insight={{
              id: "outerwear-lead",
              type: "trend",
              title: "Outerwear domina el portafolio",
              description: `La categoría Outerwear genera el ${topCat?.revenueShare.toFixed(0)}% del ingreso${isFiltered ? " filtrado" : " total"}, liderada por Chamarras. Precio promedio de $${topCat?.avgPrice.toFixed(0)} MXN. La estrategia de compra debe alinearse con esta concentración.`,
              metricValue: `${topCat?.revenueShare.toFixed(0)}%`,
              priority: "high",
            }}
          />
          <InsightCard
            insight={{
              id: "brand-mix",
              type: "opportunity",
              title: "DEUS — motor de la marca propia",
              description: `La marca DEUS lidera el portafolio con ${(data.topBrands[0]?.share || 0).toFixed(1)}% de participación. Fortalecer el canal de marca propia tiene impacto directo en el margen operativo.`,
              metricValue: `${(data.topBrands[0]?.share || 0).toFixed(1)}%`,
              priority: "high",
            }}
          />
        </div>
      </div>
    </div>
  )
}
