"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Package, Filter, ChevronDown, ChevronRight } from "lucide-react"
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
