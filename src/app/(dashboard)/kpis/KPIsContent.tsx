"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import {
  Target, TrendingUp, TrendingDown,
  Tag, BarChart3, Store,
  Repeat2, Award, Box,
  CheckCircle2, AlertCircle, XCircle,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react"
import { AnimatePresence } from "framer-motion"
import { Filter } from "lucide-react"
import { SectionHeader } from "@/components/layout/PageHeader"
import { useFilter } from "@/contexts/FilterContext"
import { formatCurrency, formatPercentAbs, formatNumber, CHART_COLORS, calcChange } from "@/lib/utils"
import type { DashboardSummary } from "@/lib/types"

interface KPIsContentProps {
  data: DashboardSummary
}

// ── Status helpers ─────────────────────────────────────────────────────────────
type Status = "green" | "amber" | "red"

function getDiscountStatus(pct: number): Status {
  return pct < 20 ? "green" : pct < 35 ? "amber" : "red"
}
function getDepthStatus(pct: number): Status {
  return pct < 15 ? "green" : pct < 25 ? "amber" : "red"
}
function getFullPriceStatus(pct: number): Status {
  return pct > 75 ? "green" : pct > 60 ? "amber" : "red"
}
function getMarginStatus(pct: number): Status {
  return pct > 50 ? "green" : pct > 40 ? "amber" : "red"
}
function getGrowthStatus(pct: number): Status {
  return pct > 5 ? "green" : pct >= 0 ? "amber" : "red"
}
function getUPTStatus(upt: number): Status {
  return upt > 1.8 ? "green" : upt > 1.3 ? "amber" : "red"
}
function getConcentrationStatus(pct: number): Status {
  return pct < 15 ? "green" : pct < 25 ? "amber" : "red"
}

function StatusDot({ status }: { status: Status }) {
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
      status === "green" ? "bg-emerald-400" : status === "amber" ? "bg-amber-400" : "bg-red-400"
    }`} />
  )
}

function StatusBadge({ status, label }: { status: Status; label: string }) {
  const classes = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
    amber: "bg-amber-50 text-amber-700 border-amber-200/60",
    red: "bg-red-50 text-red-600 border-red-200/60",
  }
  const icons = {
    green: <CheckCircle2 className="w-3 h-3" />,
    amber: <AlertCircle className="w-3 h-3" />,
    red: <XCircle className="w-3 h-3" />,
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${classes[status]}`}>
      {icons[status]} {label}
    </span>
  )
}

function MetricCard({
  kpiNum, label, objetivo, value, sub, status, statusLabel, delay = 0, accent = false,
}: {
  kpiNum: string; label: string; objetivo: string; value: string; sub?: string
  status: Status; statusLabel: string; delay?: number; accent?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`relative bg-white rounded-xl card-shadow p-5 group hover:shadow-md transition-shadow ${accent ? "border border-indigo-100" : ""}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">KPI {kpiNum}</span>
        <StatusBadge status={status} label={statusLabel} />
      </div>
      <p className="text-xs font-semibold text-slate-500 mb-1 leading-tight">{label}</p>
      <p className={`text-2xl font-bold leading-none mb-1 ${
        status === "green" ? "text-emerald-700" : status === "amber" ? "text-amber-700" : "text-red-600"
      }`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
      <p className="text-[10px] text-slate-300 mt-3 leading-tight italic border-t border-slate-50 pt-2">Obj: {objetivo}</p>
    </motion.div>
  )
}

function SectionStrip({ icon: Icon, kpis, title, color = "indigo" }: {
  icon: React.ElementType; kpis: string; title: string
  color?: "indigo" | "emerald" | "amber" | "blue" | "purple" | "rose"
}) {
  const colorMap = {
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  }
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${colorMap[color]}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-[10px] font-mono font-bold opacity-60 flex-shrink-0">KPI {kpis}</span>
        <span className="text-sm font-semibold">{title}</span>
      </div>
    </div>
  )
}

export function KPIsContent({ data }: KPIsContentProps) {
  const k = data.ceoKPIs
  const {
    isFiltered, filter,
    filteredRevenue, filteredUnits,
    filteredBranchRevenue, filteredDiscountKPIs,
    filteredMarginPct, filteredGrossMargin,
    filteredATV, filteredUPT, filteredTicketCount,
    filteredBranchMetrics,
    filteredTopSKUs, filteredConcentration,
  } = useFilter()

  // ── Filter scope helpers ─────────────────────────────────────────────────────
  const activeYears = useMemo(
    () => filter.selectedYears.length > 0 ? filter.selectedYears : data.availableYears,
    [filter.selectedYears, data.availableYears],
  )
  const activeMonths = filter.selectedMonths
  const activeBranches = useMemo(
    () => filter.selectedBranches.length > 0 ? filter.selectedBranches : data.availableBranches.map((b) => b.id),
    [filter.selectedBranches, data.availableBranches],
  )

  // ── SKU row expansion ────────────────────────────────────────────────────────
  const [expandedSKU, setExpandedSKU] = useState<string | null>(null)

  // ── Discount KPIs (filtered or global) ──────────────────────────────────────
  const disc = isFiltered ? filteredDiscountKPIs : {
    pctVentasConDescuento: k.pctVentasConDescuento,
    pctUnidadesConDescuento: k.pctUnidadesConDescuento,
    profundidadDescuento: k.profundidadDescuento,
    mixPrecioLista: k.mixPrecioLista,
  }

  // ── Display values: filtered or global ──────────────────────────────────────
  const displayRevenue   = isFiltered ? filteredRevenue  : data.physicalTotalRevenue
  const displayUnits     = isFiltered ? filteredUnits    : data.physicalTotalUnits
  const displayMarginPct = isFiltered ? filteredMarginPct : k.margenBrutoPct
  const displayMarginAbs = isFiltered ? filteredGrossMargin : k.margenBrutoAbs
  const displayATV       = isFiltered ? filteredATV  : k.atv
  const displayUPT       = isFiltered ? filteredUPT  : k.upt
  const displayTickets   = isFiltered ? filteredTicketCount : k.uniqueTickets

  // ── Physical branches ────────────────────────────────────────────────────────
  const physicalBranches = data.revenueByBranch.filter((b) => b.tipo === "física")

  // ── Branch display list (revenue filtered, metrics from FilterContext) ──────
  const displayBranches = isFiltered
    ? filteredBranchRevenue
        .filter((fb) => physicalBranches.some((pb) => pb.sucursal_id === fb.id))
        .map((fb) => {
          const staticB = physicalBranches.find((pb) => pb.sucursal_id === fb.id)!
          return { ...staticB, revenue: fb.revenue, revenueShare: fb.revenueShare }
        })
        .filter((b) => b.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
    : physicalBranches.sort((a, b) => b.revenue - a.revenue)

  // ── KPI 10 LFL — dynamic: computes comparable period from branchMonthMatrix ─
  const lflData = useMemo(() => {
    const sortedAvailYears = [...data.availableYears].sort()

    // Determine years to compare
    let yearA: number, yearB: number
    if (filter.selectedYears.length >= 2) {
      const sy = [...filter.selectedYears].sort()
      yearA = sy[sy.length - 2]; yearB = sy[sy.length - 1]
    } else if (filter.selectedYears.length === 1) {
      yearB = filter.selectedYears[0]; yearA = yearB - 1
    } else {
      // Default: two most recent years (e.g. 2025 vs 2026)
      yearB = sortedAvailYears[sortedAvailYears.length - 1] ?? 2026
      yearA = sortedAvailYears[sortedAvailYears.length - 2] ?? yearB - 1
    }

    // Branches in scope for this comparison
    const lflBranchIds = filter.selectedBranches.length > 0
      ? filter.selectedBranches.filter((id) => physicalBranches.some((b) => b.sucursal_id === id))
      : physicalBranches.map((b) => b.sucursal_id)

    // Find comparable months: months with data in BOTH years across the active branches
    const monthsInA = new Set<number>()
    const monthsInB = new Set<number>()
    for (const bid of lflBranchIds) {
      for (const [key, rev] of Object.entries(data.branchMonthMatrix[bid] || {})) {
        if (rev <= 0) continue
        const [y, m] = key.split("-").map(Number)
        if (y === yearA) monthsInA.add(m)
        if (y === yearB) monthsInB.add(m)
      }
    }
    let comparableMonths = [...monthsInA].filter((m) => monthsInB.has(m)).sort((a, b) => a - b)

    // Apply month filter: intersect with selected months (if any)
    if (activeMonths.length > 0) {
      const filtered = activeMonths.filter((m) => monthsInA.has(m) && monthsInB.has(m))
      comparableMonths = filtered.length > 0 ? filtered.sort((a, b) => a - b) : activeMonths.sort((a, b) => a - b)
    }

    const useMonths = comparableMonths.length > 0 ? comparableMonths : [...monthsInA].sort((a, b) => a - b)

    // Compute per-branch revenues for the comparable period
    const branches = lflBranchIds
      .map((bid) => {
        const bm = data.branchMonthMatrix[bid] || {}
        let revA = 0, revB = 0
        for (const m of useMonths) {
          revA += bm[`${yearA}-${m}`] || 0
          revB += bm[`${yearB}-${m}`] || 0
        }
        const branchInfo = physicalBranches.find((b) => b.sucursal_id === bid)
        return { id: bid, nombre: branchInfo?.nombre || bid, revA, revB, growth: revA > 0 ? calcChange(revB, revA) : 0, hasBoth: revA > 0 && revB > 0 }
      })
      .filter((b) => b.hasBoth)
      .sort((a, b) => b.revB - a.revB)

    const totalA = branches.reduce((s, b) => s + b.revA, 0)
    const totalB = branches.reduce((s, b) => s + b.revB, 0)
    const growth = totalA > 0 ? calcChange(totalB, totalA) : 0

    return { yearA, yearB, comparableMonths: useMonths, branches, totalA, totalB, growth }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter.selectedYears, filter.selectedBranches, activeMonths, physicalBranches])

  // ── KPI 11 Brands — filtered revenue/share, global margin/discount ──────────
  const filteredBrandMetrics = useMemo(() => {
    if (!isFiltered) return k.brandMetrics
    const brandRevMap: Record<string, number> = {}
    for (const bid of activeBranches) {
      const bm = data.branchMonthBrandMatrix[bid] || {}
      for (const [key, brandMap] of Object.entries(bm)) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        for (const [marca, vals] of Object.entries(brandMap)) {
          brandRevMap[marca] = (brandRevMap[marca] || 0) + vals.revenue
        }
      }
    }
    const total = Object.values(brandRevMap).reduce((s, v) => s + v, 0)
    return Object.entries(brandRevMap)
      .map(([marca, revenue]) => {
        const g = k.brandMetrics.find((b) => b.marca === marca)
        return {
          marca, revenue,
          share: total > 0 ? (revenue / total) * 100 : 0,
          units: g?.units ?? 0,
          grossMargin: g?.grossMargin ?? 0,
          marginPct: g?.marginPct ?? 0,
          discountPct: g?.discountPct ?? 0,
          esMarcaPropia: g?.esMarcaPropia ?? false,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFiltered, data, activeYears, activeMonths, activeBranches, k.brandMetrics])

  // Marca propia vs terceros revenue share — from filtered brand metrics
  const filteredMPRevenue = filteredBrandMetrics.filter((b) => b.esMarcaPropia).reduce((s, b) => s + b.revenue, 0)
  const filteredBrandTotal = filteredBrandMetrics.reduce((s, b) => s + b.revenue, 0)
  const displayMarcaPropiaRevShare = filteredBrandTotal > 0
    ? (filteredMPRevenue / filteredBrandTotal) * 100
    : k.marcaPropiaRevShare

  // ── Health score (uses filtered values where available) ──────────────────────
  const statuses = [
    getDiscountStatus(disc.pctVentasConDescuento),
    getDiscountStatus(disc.pctUnidadesConDescuento),
    getDepthStatus(disc.profundidadDescuento),
    getFullPriceStatus(disc.mixPrecioLista),
    getMarginStatus(displayMarginPct),
    getGrowthStatus(lflData.growth),
    getUPTStatus(displayUPT),
    getConcentrationStatus(isFiltered ? filteredConcentration.top10 : k.top10Concentration),
  ]
  const greens = statuses.filter((s) => s === "green").length
  const ambers = statuses.filter((s) => s === "amber").length
  const healthScore = Math.round(((greens * 1 + ambers * 0.5) / statuses.length) * 100)

  // Filter label for header
  const filterLabel = [
    filter.selectedBranches.length > 0 && `${filter.selectedBranches.length} sucursal${filter.selectedBranches.length > 1 ? "es" : ""}`,
    filter.selectedYears.length > 0 && `${filter.selectedYears.sort().join(", ")}`,
    filter.selectedMonths.length > 0 && `${filter.selectedMonths.length} mes${filter.selectedMonths.length > 1 ? "es" : ""}`,
  ].filter(Boolean).join(" · ")

  return (
    <div className="space-y-7 pb-10 p-6">

      {/* ── Hero scorecard header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0B0F19] to-[#111827] p-6 text-white"
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
        <div className="relative flex flex-wrap items-end gap-6 justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-indigo-400" />
              <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">
                {isFiltered ? `Vista filtrada · ${filterLabel}` : "Scorecard del CEO"}
              </p>
            </div>
            <h2 className="text-2xl font-bold">13 KPIs estratégicos</h2>
            <p className="text-white/50 text-sm mt-1">
              {isFiltered
                ? `${formatCurrency(displayRevenue, { compact: true })} ingreso · ${formatNumber(displayTickets)} tickets`
                : `Fórmulas exactas · Datos Apr 2023 – May 2026 · ${formatNumber(data.totalTransactions)} transacciones`}
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-4xl font-bold tabular-nums ${healthScore >= 70 ? "text-emerald-400" : healthScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                {healthScore}
              </div>
              <p className="text-white/40 text-[10px] uppercase tracking-wide mt-0.5">Score</p>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-white/70 text-xs">{greens} KPIs en objetivo</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-white/70 text-xs">{ambers} KPIs en observación</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                <span className="text-white/70 text-xs">{statuses.length - greens - ambers} KPIs por debajo</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Filter banner ── */}
      <AnimatePresence>
        {isFiltered && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700"
          >
            <Filter className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs font-semibold">Vista filtrada · {filterLabel}</span>
            <span className="ml-auto text-[11px] text-indigo-400">
              KPIs 01–11 reflejan el período seleccionado · KPIs 12–13 son datos globales
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION 1: Descuentos & Precio (KPIs 1–4) ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}>
        <SectionStrip icon={Tag} kpis="01–04" title="Descuentos & Poder de Precio" color="indigo" />
      </motion.div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          kpiNum="01" delay={0.1}
          label="% Ventas con descuento"
          objetivo="Reducir ventas vía markdown"
          value={formatPercentAbs(disc.pctVentasConDescuento)}
          sub={`${formatCurrency(displayRevenue * disc.pctVentasConDescuento / 100, { compact: true })} en ingreso con desc.`}
          status={getDiscountStatus(disc.pctVentasConDescuento)}
          statusLabel={getDiscountStatus(disc.pctVentasConDescuento) === "green" ? "En objetivo" : getDiscountStatus(disc.pctVentasConDescuento) === "amber" ? "Observar" : "Atención"}
        />
        <MetricCard
          kpiNum="02" delay={0.13}
          label="% Unidades con descuento"
          objetivo="Reducir dependencia de descuentos"
          value={formatPercentAbs(disc.pctUnidadesConDescuento)}
          sub={`${formatNumber(displayUnits * disc.pctUnidadesConDescuento / 100, { compact: true })} uds en descuento`}
          status={getDiscountStatus(disc.pctUnidadesConDescuento)}
          statusLabel={getDiscountStatus(disc.pctUnidadesConDescuento) === "green" ? "En objetivo" : "Observar"}
        />
        <MetricCard
          kpiNum="03" delay={0.16}
          label="Profundidad promedio de descuento"
          objetivo="Controlar agresividad del markdown"
          value={formatPercentAbs(disc.profundidadDescuento)}
          sub="Promedio ponderado por ingreso"
          status={getDepthStatus(disc.profundidadDescuento)}
          statusLabel={getDepthStatus(disc.profundidadDescuento) === "green" ? "Controlado" : "Revisar"}
        />
        <MetricCard
          kpiNum="04" delay={0.19} accent
          label="Mix ventas a precio lista"
          objetivo="Maximizar full-price sell"
          value={formatPercentAbs(disc.mixPrecioLista)}
          sub={`${formatCurrency(displayRevenue * disc.mixPrecioLista / 100, { compact: true })} full-price`}
          status={getFullPriceStatus(disc.mixPrecioLista)}
          statusLabel={getFullPriceStatus(disc.mixPrecioLista) === "green" ? "Excelente" : "Mejorar"}
        />
      </div>

      {/* ── SECTION 2: Rentabilidad (KPI 5 + 7) ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        <SectionStrip icon={BarChart3} kpis="05 · 07" title="Rentabilidad — Margen Bruto" color="emerald" />
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Big margin card (KPI 05) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl card-shadow p-5 flex flex-col justify-between"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">KPI 05</span>
              <p className="text-xs font-semibold text-slate-500 mt-2">Margen bruto %</p>
            </div>
            <StatusBadge status={getMarginStatus(displayMarginPct)} label={getMarginStatus(displayMarginPct) === "green" ? "Saludable" : "Revisar"} />
          </div>
          <div>
            <p className={`text-5xl font-bold tabular-nums ${getMarginStatus(displayMarginPct) === "green" ? "text-emerald-600" : "text-amber-600"}`}>
              {displayMarginPct.toFixed(1)}%
            </p>
            <p className="text-sm text-slate-500 mt-2">
              <span className="font-bold text-slate-800">{formatCurrency(displayMarginAbs, { compact: true })}</span> margen absoluto
            </p>
            <p className="text-[10px] text-slate-300 mt-3 italic border-t border-slate-50 pt-2">
              (Ventas – Costo) / Ventas · excluye es_cortesia · solo es_bundle=false con costo
            </p>
          </div>
        </motion.div>

        {/* Margin by branch (KPI 07) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lg:col-span-2 bg-white rounded-xl card-shadow p-5"
        >
          <SectionHeader
            title="Margen bruto por sucursal"
            subtitle={`KPI 07 — Rentabilidad por punto de venta${isFiltered ? " · filtrado" : ""}`}
          />
          <div className="mt-3 space-y-2.5">
            {(isFiltered && filter.selectedBranches.length > 0 ? displayBranches : physicalBranches).map((b, i) => {
              const margin = filteredBranchMetrics[b.sucursal_id]?.marginPct ?? b.marginPct
              const gm = filteredBranchMetrics[b.sucursal_id]?.grossMargin ?? b.grossMargin
              return (
                <div key={b.sucursal_id} className="flex items-center gap-3">
                  <StatusDot status={getMarginStatus(margin)} />
                  <span className="text-xs font-medium text-slate-600 w-28 truncate flex-shrink-0">
                    {b.nombre.replace("Deus Store ", "")}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${getMarginStatus(margin) === "green" ? "bg-emerald-400" : "bg-amber-400"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(margin, 100)}%` }}
                      transition={{ duration: 0.7, delay: 0.3 + i * 0.07 }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-12 text-right flex-shrink-0">
                    {formatPercentAbs(margin)}
                  </span>
                  <span className="text-xs text-slate-400 w-18 text-right flex-shrink-0 hidden md:block">
                    {formatCurrency(gm, { compact: true })}
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* ── SECTION 3: Ventas por Sucursal + ATV + UPT (KPIs 6, 8, 9) ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}>
        <SectionStrip icon={Store} kpis="06 · 08 · 09" title="Productividad por Tienda — Ventas, ATV & UPT" color="blue" />
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ATV + UPT */}
        <div className="space-y-4">
          <MetricCard
            kpiNum="08" delay={0.28}
            label="Ticket promedio (ATV)"
            objetivo="Medir valor medio por compra"
            value={formatCurrency(displayATV)}
            sub={`${formatNumber(displayTickets, { compact: true })} tickets${isFiltered ? " filtrados" : " únicos identificados"}`}
            status="green"
            statusLabel="Referencia"
          />
          <MetricCard
            kpiNum="09" delay={0.31}
            label="Unidades por ticket (UPT)"
            objetivo="Capacidad de cross-sell y bundles"
            value={displayUPT.toFixed(2)}
            sub="uds promedio por transacción"
            status={getUPTStatus(displayUPT)}
            statusLabel={getUPTStatus(displayUPT) === "green" ? "Saludable" : getUPTStatus(displayUPT) === "amber" ? "Mejorar" : "Crítico"}
          />
        </div>

        {/* Branch revenue table (KPI 06) */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-white rounded-xl card-shadow p-5"
        >
          <SectionHeader
            title="Ventas netas por sucursal"
            subtitle={`KPI 06 — SUM(importe_neto) por sucursal_id${isFiltered ? " · filtrado" : ""}`}
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-1.5 px-2 text-slate-400 font-medium">Sucursal</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Ventas netas</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Part.</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Unidades</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium hidden md:table-cell">% Desc.</th>
                </tr>
              </thead>
              <tbody>
                {displayBranches.map((b, i) => {
                  const bm = filteredBranchMetrics[b.sucursal_id]
                  return (
                    <motion.tr
                      key={b.sucursal_id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + i * 0.05 }}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                          <span className="font-semibold text-slate-800">{b.nombre.replace("Deus Store ", "")}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                        {formatCurrency(b.revenue, { compact: true })}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="h-1.5 w-10 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${b.revenueShare}%`, background: CHART_COLORS[i] }} />
                          </div>
                          <span className="font-semibold text-slate-600 w-8">{b.revenueShare.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-600">
                        {formatNumber(bm?.units ?? b.units, { compact: true })}
                      </td>
                      <td className="py-2.5 px-2 text-right hidden md:table-cell">
                        <span className={`font-semibold ${(bm?.discountRate ?? b.discountRate) > 25 ? "text-red-500" : (bm?.discountRate ?? b.discountRate) > 15 ? "text-amber-600" : "text-emerald-600"}`}>
                          {formatPercentAbs(bm?.discountRate ?? b.discountRate)}
                        </span>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* ── SECTION 4: Like-for-Like (KPI 10) ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <SectionStrip icon={Repeat2} kpis="10" title="Like-for-Like — Crecimiento Comparable" color="amber" />
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LFL summary card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-white rounded-xl card-shadow p-5"
        >
          <div className="flex items-start justify-between mb-4">
            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">KPI 10</span>
            <StatusBadge
              status={getGrowthStatus(lflData.growth)}
              label={getGrowthStatus(lflData.growth) === "green" ? "Crecimiento" : lflData.growth >= 0 ? "Estable" : "Declive"}
            />
          </div>
          <p className="text-xs font-semibold text-slate-500 mb-1">
            Crecimiento LFL — {lflData.yearA} vs {lflData.yearB}
          </p>
          <div className="flex items-baseline gap-2">
            <p className={`text-4xl font-bold tabular-nums ${lflData.growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {lflData.growth >= 0 ? "+" : ""}{lflData.growth.toFixed(1)}%
            </p>
            {lflData.growth >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-500" /> : <ArrowDownRight className="w-5 h-5 text-red-500" />}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-50 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">{lflData.yearA} ({lflData.branches.length} tiendas)</span>
              <span className="font-semibold text-slate-700">{formatCurrency(lflData.totalA, { compact: true })}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">{lflData.yearB} ({lflData.branches.length} tiendas)</span>
              <span className="font-bold text-slate-900">{formatCurrency(lflData.totalB, { compact: true })}</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-300 mt-3 italic border-t border-slate-50 pt-2">
            {lflData.comparableMonths.length} mes{lflData.comparableMonths.length !== 1 ? "es" : ""} equiparables · solo tiendas con datos en ambos años
          </p>
        </motion.div>

        {/* LFL by branch table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="lg:col-span-2 bg-white rounded-xl card-shadow p-5"
        >
          <SectionHeader
            title="LFL por sucursal"
            subtitle={`${lflData.yearA} vs ${lflData.yearB} · ${lflData.comparableMonths.length} meses equiparables · tiendas con datos en ambos años`}
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-1.5 px-2 text-slate-400 font-medium">Sucursal</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">{lflData.yearA}</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">{lflData.yearB}</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Variación</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-medium w-24">Barra</th>
                </tr>
              </thead>
              <tbody>
                {lflData.branches.map((b, i) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.42 + i * 0.05 }}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <StatusDot status={getGrowthStatus(b.growth)} />
                        <span className="font-semibold text-slate-800">{b.nombre.replace("Deus Store ", "")}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-500">{formatCurrency(b.revA, { compact: true })}</td>
                    <td className="py-2.5 px-2 text-right font-bold text-slate-900">{formatCurrency(b.revB, { compact: true })}</td>
                    <td className={`py-2.5 px-2 text-right font-bold ${b.growth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      <span className="flex items-center justify-end gap-0.5">
                        {b.growth >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {b.growth >= 0 ? "+" : ""}{b.growth.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-2">
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${b.growth >= 5 ? "bg-emerald-400" : b.growth >= 0 ? "bg-amber-400" : "bg-red-400"}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(Math.abs(b.growth) * 2, 100)}%` }}
                          transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                        />
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {lflData.branches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-xs text-slate-400 italic">
                      Sin tiendas con datos en ambos años para el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* ── SECTION 5: Marcas (KPI 11) ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <SectionStrip icon={Award} kpis="11" title="Margen por Marca y Tipo de Marca" color="purple" />
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Marca propia vs terceros */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
            className="bg-white rounded-xl card-shadow p-4"
          >
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-3">Marca propia</p>
            <p className="text-2xl font-bold text-indigo-600">{formatPercentAbs(k.marcaPropiaMargPct)}</p>
            <p className="text-xs text-slate-500 mt-1">margen bruto (global)</p>
            <div className="mt-2 pt-2 border-t border-slate-50">
              <p className="text-xs text-slate-400">{displayMarcaPropiaRevShare.toFixed(1)}% del ingreso{isFiltered ? " filtrado" : " total"}</p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white rounded-xl card-shadow p-4"
          >
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-3">Marcas terceros</p>
            <p className="text-2xl font-bold text-slate-700">{formatPercentAbs(k.tercerosMargPct)}</p>
            <p className="text-xs text-slate-500 mt-1">margen bruto (global)</p>
            <div className="mt-2 pt-2 border-t border-slate-50">
              <p className="text-xs text-slate-400">{(100 - displayMarcaPropiaRevShare).toFixed(1)}% del ingreso{isFiltered ? " filtrado" : " total"}</p>
            </div>
          </motion.div>
        </div>

        {/* Brand margin table */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44 }}
          className="lg:col-span-3 bg-white rounded-xl card-shadow p-5"
        >
          <SectionHeader
            title="Margen y descuento por marca (top 10)"
            subtitle={isFiltered ? "Ingresos filtrados · margen/desc histórico global" : "Ordenado por ingreso · agrupado por marca_en_canonico"}
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-1.5 px-2 text-slate-400 font-medium">Marca</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Ingreso</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Part.</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Margen %</th>
                  <th className="text-right py-1.5 px-2 text-slate-400 font-medium">% Desc.</th>
                  <th className="text-left py-1.5 px-2 text-slate-400 font-medium hidden md:table-cell">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {filteredBrandMetrics.map((b, i) => (
                  <motion.tr
                    key={b.marca}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.48 + i * 0.04 }}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                        <span className="font-semibold text-slate-800 font-mono text-[11px]">{b.marca}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-bold text-slate-900">{formatCurrency(b.revenue, { compact: true })}</td>
                    <td className="py-2 px-2 text-right text-slate-500">{b.share.toFixed(1)}%</td>
                    <td className={`py-2 px-2 text-right font-bold ${getMarginStatus(b.marginPct) === "green" ? "text-emerald-600" : getMarginStatus(b.marginPct) === "amber" ? "text-amber-600" : "text-red-500"}`}>
                      {formatPercentAbs(b.marginPct)}
                    </td>
                    <td className={`py-2 px-2 text-right ${b.discountPct > 25 ? "text-red-500 font-bold" : "text-slate-500"}`}>
                      {formatPercentAbs(b.discountPct)}
                    </td>
                    <td className="py-2 px-2 hidden md:table-cell">
                      {b.esMarcaPropia ? (
                        <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-semibold">PROPIA</span>
                      ) : (
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">3ro</span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* ── SECTION 6: SKU Performance + Concentración (KPIs 12–13) ── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <SectionStrip icon={Box} kpis="12–13" title="Performance por SKU y Concentración del Surtido" color="rose" />
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Concentration cards */}
        {(() => {
          const c3  = isFiltered ? filteredConcentration.top3  : k.top3Concentration
          const c10 = isFiltered ? filteredConcentration.top10 : k.top10Concentration
          const c20 = isFiltered ? filteredConcentration.top20 : k.top20Concentration
          return (
            <div className="space-y-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.52 }} className="bg-white rounded-xl card-shadow p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">KPI 13</span>
                  <StatusBadge status={getConcentrationStatus(c3)} label="Top 3" />
                </div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-2">Concentración top 3</p>
                <p className="text-3xl font-bold text-slate-900">{c3.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-400 mt-1">del ingreso{isFiltered ? " filtrado" : " total"}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="bg-white rounded-xl card-shadow p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">KPI 13</span>
                  <StatusBadge status={getConcentrationStatus(c10 / 3)} label="Top 10" />
                </div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-2">Concentración top 10</p>
                <p className="text-3xl font-bold text-slate-900">{c10.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-400 mt-1">del ingreso{isFiltered ? " filtrado" : " total"}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.57 }} className="bg-white rounded-xl card-shadow p-4">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-2">Concentración top 20</p>
                <p className="text-3xl font-bold text-slate-700">{c20.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-400 mt-1">{formatNumber(k.totalSKUs)} SKUs padre totales</p>
              </motion.div>
            </div>
          )
        })()}

        {/* Top SKU table (KPI 12) */}
        {(() => {
          const displaySKUs = isFiltered ? filteredTopSKUs : k.topSKUs
          return (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.53 }}
          className="lg:col-span-3 bg-white rounded-xl card-shadow p-5 overflow-x-auto"
        >
          <SectionHeader
            title="Top 25 SKUs padre"
            subtitle={isFiltered ? "KPI 12 — período filtrado · top-200 SKUs rastreados · sucursales físicas" : "KPI 12 — SUM(importe_neto), margen y % descuento por estilo"}
          />
          <table className="w-full text-xs mt-3">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-1.5 px-2 text-slate-400 font-medium">#</th>
                <th className="text-left py-1.5 px-2 text-slate-400 font-medium">SKU Padre</th>
                <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Ingreso</th>
                <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Uds</th>
                <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Part.</th>
                <th className="text-right py-1.5 px-2 text-slate-400 font-medium">Margen</th>
                <th className="text-right py-1.5 px-2 text-slate-400 font-medium hidden lg:table-cell">% Desc.</th>
              </tr>
            </thead>
            <tbody>
              {displaySKUs.map((sku, i) => {
                const isExpanded = expandedSKU === sku.sku_padre
                const articuloName = data.skuNameMap[sku.sku_padre]
                return (
                  <AnimatePresence key={sku.sku_padre} mode="wait">
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.55 + i * 0.025 }}
                      onClick={() => setExpandedSKU(isExpanded ? null : sku.sku_padre)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors select-none ${isExpanded ? "bg-indigo-50/60" : "hover:bg-slate-50"}`}
                    >
                      <td className="py-1.5 px-2 text-slate-400 font-mono">{i + 1}</td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-slate-800 text-[11px]">{sku.sku_padre}</span>
                          {articuloName && (
                            <span className={`text-[10px] transition-colors ${isExpanded ? "text-indigo-500" : "text-slate-300 group-hover:text-slate-400"}`}>▾</span>
                          )}
                        </div>
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-slate-900">{formatCurrency(sku.revenue, { compact: true })}</td>
                      <td className="py-1.5 px-2 text-right text-slate-500">{formatNumber(sku.units, { compact: true })}</td>
                      <td className="py-1.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <div className="h-1.5 w-8 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min(sku.revenueShare * 10, 100)}%` }} />
                          </div>
                          <span className="text-slate-600">{sku.revenueShare.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className={`py-1.5 px-2 text-right font-semibold ${sku.marginPct > 0 ? (getMarginStatus(sku.marginPct) === "green" ? "text-emerald-600" : "text-amber-600") : "text-slate-400"}`}>
                        {sku.marginPct > 0 ? formatPercentAbs(sku.marginPct) : "—"}
                      </td>
                      <td className={`py-1.5 px-2 text-right hidden lg:table-cell ${sku.discountPct > 25 ? "text-red-500 font-bold" : "text-slate-400"}`}>
                        {sku.discountPct > 0 ? formatPercentAbs(sku.discountPct) : "0%"}
                      </td>
                    </motion.tr>
                    {isExpanded && articuloName && (
                      <motion.tr
                        key={`${sku.sku_padre}-detail`}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <td colSpan={7} className="px-4 py-2 bg-indigo-50 border-b border-indigo-100">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-medium text-indigo-400 uppercase tracking-wide flex-shrink-0">Artículo</span>
                            <span className="text-xs font-semibold text-indigo-800">{articuloName}</span>
                          </div>
                        </td>
                      </motion.tr>
                    )}
                  </AnimatePresence>
                )
              })}
            </tbody>
          </table>
        </motion.div>
          )
        })()}
      </div>

    </div>
  )
}
