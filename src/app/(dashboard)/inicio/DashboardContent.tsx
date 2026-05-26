"use client"

import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DollarSign, ShoppingBag, TrendingUp, Store, Package, Percent, ArrowRight } from "lucide-react"
import { KPICard, KPIGrid } from "@/components/cards/KPICard"
import { InsightPanel } from "@/components/cards/InsightCard"
import { RevenueAreaChart, DayOfWeekChart } from "@/components/charts/RevenueChart"
import { BranchBarChart, CategoryPieChart } from "@/components/charts/BranchChart"
import { SectionHeader } from "@/components/layout/PageHeader"
import { useFilter } from "@/contexts/FilterContext"
import { formatCurrency, formatNumber, formatPercentAbs, calcChange, CHART_COLORS } from "@/lib/utils"
import type { DashboardSummary } from "@/lib/types"
import Link from "next/link"

const MONTH_ABBR = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

export function DashboardContent({ data }: { data: DashboardSummary }) {
  const {
    isFiltered, filter,
    filteredRevenue, filteredUnits, filteredMonthlyRevenue,
    filteredBranchRevenue, filteredCategoryRevenue, yoyChange,
  } = useFilter()

  // Derive years to show in chart (last 2 of selection, or last 2 available)
  const chartYears = filter.selectedYears.length > 0
    ? [...filter.selectedYears].sort().slice(-2)
    : data.availableYears.slice(-2)

  const latestAvailYear = data.availableYears[data.availableYears.length - 1] ?? 2025
  const prevAvailYear = data.availableYears[data.availableYears.length - 2] ?? 2024
  const yoyLabel = filter.selectedYears.length === 1
    ? `vs ${filter.selectedYears[0] - 1}`
    : `vs ${chartYears[0] ?? prevAvailYear}`

  // ── Evolution bars: respects branch + month filters across ALL years ──────
  // (year filter only dims bars, not used to exclude them from this calc)
  const evolutionYearRevenue = useMemo<Record<number, number>>(() => {
    const activeMonths = filter.selectedMonths
    const activeBranches = filter.selectedBranches.length > 0
      ? filter.selectedBranches
      : data.availableBranches.map((b) => b.id)

    // No filter: use static precomputed totals — no recalculation needed
    if (activeMonths.length === 0 && filter.selectedBranches.length === 0) {
      return data.physicalRevenueByYear
    }

    // Any branch or month filter: recompute from branchMonthMatrix
    const result: Record<number, number> = {}
    for (const branchId of activeBranches) {
      const bm = data.branchMonthMatrix[branchId] || {}
      for (const [key, rev] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        result[year] = (result[year] || 0) + rev
      }
    }
    return result
  }, [filter.selectedMonths, filter.selectedBranches, data])

  // Subtitle for the evolution card
  const evolutionSubtitle = useMemo(() => {
    if (filter.selectedMonths.length > 0) {
      const labels = filter.selectedMonths.map((m) => MONTH_ABBR[m]).join(", ")
      return `Meses: ${labels} · comparativo entre años`
    }
    if (filter.selectedBranches.length > 0) return "Sucursales seleccionadas · histórico anual"
    return "Crecimiento histórico de Deus Store"
  }, [filter.selectedMonths, filter.selectedBranches])

  return (
    <div className="space-y-6 pb-8 p-6">
      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#0B0F19] to-[#1a1f35] p-6 text-white"
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5">
              {isFiltered ? "Vista filtrada" : "Plataforma de Inteligencia"}
            </p>
            <h2 className="text-2xl font-bold leading-tight">
              {isFiltered
                ? `${filter.selectedBranches.length > 0 ? filter.selectedBranches.length === 1 ? data.availableBranches.find(b => b.id === filter.selectedBranches[0])?.nombre : `${filter.selectedBranches.length} sucursales` : "Todas las sucursales"} · ${filter.selectedYears.length > 0 ? filter.selectedYears.join(", ") : "Todos los años"}`
                : "Deus Store · 2023–2026"
              }
            </h2>
            <p className="text-white/60 text-sm mt-1.5">
              {formatNumber(data.totalTransactions, { compact: false })} transacciones · {data.activeBranches} sucursales · {formatNumber(data.activeProducts)} SKUs
            </p>
          </div>
          <div className="flex-shrink-0 text-right hidden md:block">
            <p className="text-white/40 text-xs uppercase tracking-wide mb-1">
              {isFiltered ? "Ingreso filtrado" : "Ingreso acumulado"}
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={filteredRevenue}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-3xl font-bold text-white tabular-nums"
              >
                {formatCurrency(filteredRevenue, { compact: true })}
              </motion.p>
            </AnimatePresence>
            <p className="text-xs text-white/40 mt-0.5">MXN</p>
          </div>
        </div>
      </motion.div>

      {/* KPI Grid — filter-aware */}
      <KPIGrid columns={4}>
        <KPICard
          title="Ingreso total"
          value={formatCurrency(filteredRevenue, { compact: true })}
          numericValue={filteredRevenue}
          formatter={(n) => formatCurrency(n, { compact: true })}
          change={yoyChange ?? undefined}
          changeLabel={yoyLabel}
          icon={DollarSign}
          iconColor="text-indigo-600"
          accentColor="bg-indigo-50"
          delay={0.05}
        />
        <KPICard
          title="Unidades vendidas"
          value={formatNumber(filteredUnits, { compact: true })}
          numericValue={filteredUnits}
          formatter={(n) => formatNumber(n, { compact: true })}
          subtitle="Líneas de venta"
          icon={ShoppingBag}
          iconColor="text-violet-600"
          accentColor="bg-violet-50"
          delay={0.10}
        />
        <KPICard
          title="Margen bruto"
          value={formatPercentAbs(data.marginPct)}
          subtitle={`${formatCurrency(data.grossMargin, { compact: true })} generados`}
          icon={TrendingUp}
          iconColor="text-emerald-600"
          accentColor="bg-emerald-50"
          delay={0.15}
        />
        <KPICard
          title="Ticket mediano"
          value={formatCurrency(data.avgTicket)}
          subtitle="Valor por transacción"
          icon={Percent}
          iconColor="text-amber-600"
          accentColor="bg-amber-50"
          delay={0.20}
        />
      </KPIGrid>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Sucursales", value: `${data.activeBranches}`, sub: "puntos físicos activos", icon: Store, color: "text-sky-600" },
          { label: "SKUs únicos", value: formatNumber(data.activeProducts), sub: "artículos en catálogo", icon: Package, color: "text-slate-600" },
          (() => {
            const evoLatest = evolutionYearRevenue[latestAvailYear] || 0
            const evoPrev   = evolutionYearRevenue[prevAvailYear] || 0
            const chg = calcChange(evoLatest, evoPrev)
            const hasMF = filter.selectedMonths.length > 0
            return {
              label: `Crecimiento ${prevAvailYear}→${latestAvailYear}`,
              value: `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`,
              sub: hasMF ? `Meses: ${filter.selectedMonths.map(m => MONTH_ABBR[m]).join(", ")}` : "interanual",
              icon: TrendingUp,
              color: chg >= 0 ? "text-emerald-600" : "text-red-500",
            }
          })(),
          { label: "Con descuento", value: formatPercentAbs(data.discountStats.pctWithDiscount), sub: "de las líneas", icon: Percent, color: "text-amber-600" },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.25 + i * 0.05 }} className="bg-white rounded-xl card-shadow p-4 group hover:card-shadow-hover transition-all duration-200">
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{item.label}</span>
            </div>
            <p className={`text-xl font-bold ${item.color} leading-none tabular-nums`}>{item.value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Revenue trend + Day of week */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }} className="lg:col-span-2 bg-white rounded-xl card-shadow p-5">
          <SectionHeader
            title="Tendencia de ingresos"
            subtitle={`Mensual · ${chartYears.join(" vs ")}`}
            action={
              <div className="flex items-center gap-3 text-[11px] font-medium">
                {chartYears.map((y, i) => (
                  <span key={y} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: i === 0 ? "#818CF8" : "#4F46E5" }} />
                    <span className="text-slate-500">{y}</span>
                  </span>
                ))}
              </div>
            }
          />
          <div className="h-52">
            <RevenueAreaChart data={filteredMonthlyRevenue} years={chartYears} />
          </div>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            <span className="font-semibold text-slate-600">Pico de diciembre</span> — concentra 2.6× el volumen mensual promedio, patrón consistente en todos los años.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader title="Ventas por día" subtitle="Distribución semanal acumulada" />
          <div className="h-52">
            <DayOfWeekChart data={data.dayOfWeek} />
          </div>
          <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
            <span className="font-semibold text-slate-600">Vie–Dom</span> concentran más del 53% del ingreso semanal.
          </p>
        </motion.div>
      </div>

      {/* Branch + Category + Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader title="Rendimiento de sucursales" subtitle={isFiltered ? "Selección filtrada" : "Total histórico"} action={
            <Link href="/sucursales" className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 group">
              Detalle <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          } />
          <div className="h-52">
            <BranchBarChart data={filteredBranchRevenue.map(b => ({
              sucursal_id: b.id, nombre: b.nombre, tipo: "física",
              revenue: b.revenue, units: 0, transactions: 0, avgTicket: 0,
              grossMargin: 0, marginPct: 0, discountRate: 0, revenueShare: b.revenueShare,
            }))} />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader title="Mix de categorías" subtitle={isFiltered ? "Selección filtrada" : "Participación histórica"} action={
            <Link href="/productos" className="text-[11px] text-indigo-600 hover:text-indigo-700 font-semibold flex items-center gap-1 group">
              Catálogo <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          } />
          <div className="h-52">
            <CategoryPieChart data={filteredCategoryRevenue} />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white rounded-xl card-shadow p-5 overflow-y-auto max-h-[380px] scrollbar-thin">
          <InsightPanel insights={data.insights} />
        </motion.div>
      </div>

      {/* Brands + Payment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader title="Top marcas" subtitle="Participación en ingresos" />
          <div className="space-y-3 mt-2">
            {data.topBrands.slice(0, 6).map((brand, i) => (
              <div key={brand.marca} className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-700">{brand.marca}</span>
                    <span className="text-xs font-bold text-slate-900 ml-2">{formatCurrency(brand.revenue, { compact: true })}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: CHART_COLORS[i] || "#CBD5E1" }}
                      initial={{ width: 0 }}
                      animate={{ width: `${brand.share}%` }}
                      transition={{ duration: 0.7, delay: 0.6 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 w-10 text-right">{brand.share.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="bg-white rounded-xl card-shadow p-5 space-y-5">
          <div>
            <SectionHeader title="Forma de pago" subtitle="Composición de transacciones" />
            <div className="space-y-2.5">
              {data.paymentMethods.slice(0, 4).map((p) => (
                <div key={p.method} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 w-28 truncate font-medium">{p.method}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div className="h-full bg-indigo-400 rounded-full" initial={{ width: 0 }} animate={{ width: `${p.share}%` }} transition={{ duration: 0.7, delay: 0.65, ease: [0.16, 1, 0.3, 1] }} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 w-8 text-right">{p.share.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <SectionHeader title="Género" subtitle="Participación en ingresos" />
            <div className="flex gap-3">
              {data.genderSplit.map((g, i) => (
                <div key={g.genero} className="flex-1 rounded-lg p-3" style={{ background: ["#EEF2FF", "#F5F3FF", "#F0F9FF"][i] }}>
                  <p className="text-lg font-bold tabular-nums" style={{ color: ["#4F46E5", "#7C3AED", "#0EA5E9"][i] }}>{g.share.toFixed(0)}%</p>
                  <p className="text-[11px] text-slate-600 font-medium mt-0.5">{g.genero}</p>
                  <p className="text-[10px] text-slate-400">{formatCurrency(g.revenue, { compact: true })}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Year bars */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-white rounded-xl card-shadow p-5">
        <SectionHeader title="Evolución anual" subtitle={evolutionSubtitle} />
        <div className="flex items-end gap-4 mt-4">
          {Object.entries(evolutionYearRevenue).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([year, revenue], i, arr) => {
            const maxRev = Math.max(...arr.map(([, v]) => v))
            const heightPct = (revenue / maxRev) * 100
            const prevRev = i > 0 ? arr[i - 1][1] : 0
            const chg = prevRev > 0 ? calcChange(revenue, prevRev) : null
            const isSelected = filter.selectedYears.length === 0 || filter.selectedYears.includes(parseInt(year))
            const isLatest = parseInt(year) === latestAvailYear
            const isPartial = parseInt(year) >= new Date().getFullYear()
            return (
              <div key={year} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex items-end justify-center w-full" style={{ height: "80px" }}>
                  <motion.div
                    className={`w-full max-w-16 rounded-t-lg transition-opacity duration-300 ${isPartial ? "border-t-2 border-dashed border-indigo-300" : ""}`}
                    style={{ background: isLatest ? "linear-gradient(to top, #4F46E5, #818CF8)" : "linear-gradient(to top, #CBD5E1, #E2E8F0)", opacity: isSelected ? 1 : 0.3 }}
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.7, delay: 0.6 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <div className={`text-center transition-opacity duration-300 ${isSelected ? "opacity-100" : "opacity-40"}`}>
                  <p className="text-sm font-bold text-slate-800 tabular-nums">{formatCurrency(revenue, { compact: true })}</p>
                  <p className="text-xs text-slate-500 font-medium">{year}{isPartial && <span className="ml-0.5 text-[9px] text-indigo-400 font-semibold">parcial</span>}</p>
                  {chg !== null && <p className={`text-[10px] font-semibold mt-0.5 ${chg >= 0 ? "text-emerald-600" : "text-red-500"}`}>{chg >= 0 ? "+" : ""}{chg.toFixed(1)}%</p>}
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
