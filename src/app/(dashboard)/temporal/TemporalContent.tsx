"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TrendingUp, ChevronDown, X, Calendar, BarChart2 } from "lucide-react"
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader"
import { InsightCard } from "@/components/cards/InsightCard"
import { RevenueAreaChart, DayOfWeekChart } from "@/components/charts/RevenueChart"
import { useFilter } from "@/contexts/FilterContext"
import {
  formatCurrency, formatPercentAbs, MONTH_LABELS_ES, MONTH_FULL_ES,
  CHART_COLORS, calcChange, DAY_LABELS_ES,
} from "@/lib/utils"
import type { DashboardSummary } from "@/lib/types"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LineChart, Line, ReferenceLine,
} from "recharts"

interface TemporalContentProps {
  data: DashboardSummary
}

export function TemporalContent({ data }: TemporalContentProps) {
  const { filteredMonthlyRevenue, filter, filteredDayOfWeek } = useFilter()
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number } | null>(null)
  const latestYear = data.availableYears[data.availableYears.length - 1] ?? 2025
  const [activeYear, setActiveYear] = useState<number>(latestYear)

  const chartYears = filter.selectedYears.length > 0
    ? [...filter.selectedYears].sort()
    : data.availableYears.slice(-3)

  // Seasonality index vs monthly average — uses GLOBAL data, always fixed
  const globalMonthsActiveYear = data.revenueByMonth.filter(m => m.año === activeYear)
  const globalAvg = globalMonthsActiveYear.length > 0
    ? globalMonthsActiveYear.reduce((s, m) => s + m.revenue, 0) / globalMonthsActiveYear.length
    : 1

  const seasonalityData = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const found = globalMonthsActiveYear.find(x => x.mes === mes)
    return { mes, label: MONTH_LABELS_ES[mes], index: found ? found.revenue / globalAvg : null, revenue: found?.revenue || 0 }
  })

  // "Pico diciembre" — fixed, global
  const decemberIdx = seasonalityData.find(m => m.mes === 12)?.index || 1

  // "Ventas Vie-Dom" — filtered (uses filteredDayOfWeek from context)
  const filteredWeekendRev = filteredDayOfWeek.filter(d => d.dia >= 4).reduce((s, d) => s + d.revenue, 0)
  const filteredTotalDow = filteredDayOfWeek.reduce((s, d) => s + d.revenue, 0)
  const weekendShare = filteredTotalDow > 0 ? (filteredWeekendRev / filteredTotalDow) * 100 : 0

  // Weekly data for selected year
  const weeklyData = useMemo(() => {
    return data.weeklyRevenue.filter(w => w.year === activeYear).slice(0, 52)
  }, [data.weeklyRevenue, activeYear])

  // Drill-down: month detail
  const monthDetail = useMemo(() => {
    if (!selectedMonth) return null
    const { year, month } = selectedMonth
    const key = `${year}-${month}`

    // Categories for this month
    const catData = Object.entries(data.monthCategoryMatrix[key] || {})
      .filter(([cat]) => cat !== "Bundle" && cat !== "Otro" && cat !== "Melon")
      .map(([cat, rev]) => ({ cat, rev }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 6)

    // Revenue this month vs last year same month
    const prevKey = `${year - 1}-${month}`
    const prevMonthRev = filteredMonthlyRevenue.find(m => m.año === year - 1 && m.mes === month)?.revenue || 0
    const thisMonthRev = filteredMonthlyRevenue.find(m => m.año === year && m.mes === month)?.revenue || 0
    const momChange = prevMonthRev > 0 ? calcChange(thisMonthRev, prevMonthRev) : null

    // DoW for this month (from full data)
    const dowData = data.dayOfWeek.map(d => ({ ...d })) // approximate with global

    // Average monthly revenue for this year (for seasonal index)
    const yearMonths = data.revenueByMonth.filter(m => m.año === year && m.revenue > 0)
    const avgMonthly = yearMonths.length > 0
      ? yearMonths.reduce((s, m) => s + m.revenue, 0) / yearMonths.length
      : 0

    return { catData, thisMonthRev, prevMonthRev, momChange, year, month, avgMonthly }
  }, [selectedMonth, data, filteredMonthlyRevenue])

  return (
    <div className="space-y-6 pb-8">
      <PageHeader icon={TrendingUp} title="Patrones Temporales" subtitle="Estacionalidad, drill-down y comportamiento en el tiempo" />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pico diciembre", value: `${decemberIdx.toFixed(1)}×`, sub: "vs promedio mensual", color: "text-indigo-600" },
          { label: "Ventas Vie–Dom", value: `${weekendShare.toFixed(0)}%`, sub: "del total semanal", color: "text-violet-600" },
          (() => {
            const bestYear = data.availableYears.reduce((best, y) => (data.physicalRevenueByYear[y] || 0) > (data.physicalRevenueByYear[best] || 0) ? y : best, data.availableYears[0])
            return { label: "Mejor año", value: `${bestYear}`, sub: formatCurrency(data.physicalRevenueByYear[bestYear] || 0, { compact: true }), color: "text-emerald-600" }
          })(),
          (() => {
            const sortedYears = [...data.availableYears].sort()
            const ly = sortedYears[sortedYears.length - 1]
            const py = sortedYears[sortedYears.length - 2]
            // Find the last month with data in the latest year (comparable period)
            const lyMonths = data.revenueByMonth.filter(m => m.año === ly && m.revenue > 0).map(m => m.mes)
            const maxMonth = lyMonths.length > 0 ? Math.max(...lyMonths) : 12
            // Sum only comparable months in both years
            const lyRev = data.revenueByMonth.filter(m => m.año === ly && m.mes <= maxMonth).reduce((s, m) => s + m.revenue, 0)
            const pyRev = data.revenueByMonth.filter(m => m.año === py && m.mes <= maxMonth).reduce((s, m) => s + m.revenue, 0)
            const chg = pyRev > 0 ? calcChange(lyRev, pyRev) : 0
            const monthLabel = MONTH_LABELS_ES[maxMonth] || `M${maxMonth}`
            return { label: `Crecimiento ${py}→${ly}`, value: `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%`, sub: `Ene–${monthLabel} (período comparable)`, color: chg >= 0 ? "text-emerald-600" : "text-red-500" }
          })(),
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-white rounded-xl card-shadow p-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-2">{item.label}</p>
            <p className={`text-xl font-bold ${item.color} leading-none tabular-nums`}>{item.value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Year selector + full trend */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl card-shadow p-5">
        <SectionHeader
          title="Tendencia mensual de ingresos"
          subtitle="Comparativo multi-año — haz clic en un mes para ver detalle"
          action={
            <div className="flex items-center gap-2">
              {chartYears.map((y, i) => (
                <span key={y} className="flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i] }} />
                  <span className="text-slate-500 font-medium">{y}</span>
                </span>
              ))}
            </div>
          }
        />
        <div className="h-64">
          <RevenueAreaChart data={filteredMonthlyRevenue} years={chartYears} onMonthClick={(year, month) => setSelectedMonth({ year, month })} />
        </div>
        <p className="text-[11px] text-slate-400 mt-3 italic">Haz clic en cualquier punto del gráfico para explorar el detalle de ese mes.</p>
      </motion.div>

      {/* Month drill-down panel */}
      <AnimatePresence>
        {selectedMonth && monthDetail && (
          <motion.div
            key="drilldown"
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="bg-indigo-950 rounded-xl p-5 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold">
                      {MONTH_FULL_ES[monthDetail.month]} {monthDetail.year}
                    </h3>
                    <p className="text-indigo-300/70 text-xs">Detalle del mes seleccionado</p>
                  </div>
                </div>
                <button onClick={() => setSelectedMonth(null)} className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-white/70" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-indigo-300/70 text-[10px] uppercase tracking-wide mb-1">Ingreso del mes</p>
                  <p className="text-xl font-bold tabular-nums">{formatCurrency(monthDetail.thisMonthRev, { compact: true })}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-indigo-300/70 text-[10px] uppercase tracking-wide mb-1">vs año anterior</p>
                  <p className={`text-xl font-bold tabular-nums ${monthDetail.momChange !== null ? monthDetail.momChange >= 0 ? "text-emerald-400" : "text-red-400" : "text-white/50"}`}>
                    {monthDetail.momChange !== null ? `${monthDetail.momChange >= 0 ? "+" : ""}${monthDetail.momChange.toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-indigo-300/70 text-[10px] uppercase tracking-wide mb-1">Índice estacional</p>
                  <p className="text-xl font-bold tabular-nums">
                    {monthDetail.avgMonthly > 0 ? (monthDetail.thisMonthRev / monthDetail.avgMonthly).toFixed(2) : "—"}×
                  </p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-indigo-300/70 text-[10px] uppercase tracking-wide mb-1">Año previo</p>
                  <p className="text-xl font-bold text-white/70 tabular-nums">{monthDetail.prevMonthRev > 0 ? formatCurrency(monthDetail.prevMonthRev, { compact: true }) : "—"}</p>
                </div>
              </div>

              <div>
                <p className="text-indigo-300/70 text-[10px] uppercase tracking-wide mb-2">Categorías top — {MONTH_LABELS_ES[monthDetail.month]} {monthDetail.year}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {monthDetail.catData.map((c, i) => (
                    <div key={c.cat} className="bg-white/10 rounded-lg p-2.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i] }} />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{c.cat}</p>
                        <p className="text-[10px] text-indigo-300/70 tabular-nums">{formatCurrency(c.rev, { compact: true })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Weekly sparkline + Seasonality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly revenue chart */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader
            title="Ingresos semanales"
            subtitle={`Semana a semana · ${activeYear}`}
            action={
              <div className="flex gap-1">
                {data.availableYears.map(y => (
                  <button key={y} onClick={() => setActiveYear(y)} className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition-colors ${activeYear === y ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-600"}`}>
                    {y}
                  </button>
                ))}
              </div>
            }
          />
          <div className="h-48 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94A3B8" }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={v => formatCurrency(v, { compact: true })} width={48} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), "Semana"]} contentStyle={{ borderRadius: "10px", border: "1px solid #E2E8F0", fontSize: "12px" }} />
                <Bar dataKey="revenue" radius={[3, 3, 0, 0]} maxBarSize={12}>
                  {weeklyData.map((_, i) => (
                    <Cell key={i} fill={i >= weeklyData.length - 4 ? "#4F46E5" : "#C7D2FE"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Seasonality index */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader
            title="Índice de estacionalidad"
            subtitle={`Relación vs promedio mensual · ${activeYear}`}
          />
          <div className="mt-3 space-y-1.5">
            {seasonalityData.map((m, i) => {
              const idx = m.index
              const isAbove = idx !== null && idx > 1
              return (
                <motion.div
                  key={m.mes}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.025 }}
                  className={`flex items-center gap-3 rounded-lg px-2 py-1 cursor-pointer transition-colors ${selectedMonth?.month === m.mes ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                  onClick={() => m.revenue > 0 && setSelectedMonth({ year: activeYear, month: m.mes })}
                >
                  <span className="text-xs font-medium text-slate-500 w-8 flex-shrink-0">{m.label}</span>
                  <div className="flex-1 h-5 bg-slate-50 rounded relative overflow-hidden">
                    {idx !== null && (
                      <motion.div
                        className="h-full rounded"
                        style={{ width: `${Math.min(idx / 3, 1) * 100}%`, background: isAbove ? `rgba(79,70,229,${0.15 + Math.min((idx - 1) / 2, 1) * 0.7})` : "rgba(100,116,139,0.12)" }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(idx / 3, 1) * 100}%` }}
                        transition={{ duration: 0.5, delay: 0.5 + i * 0.025 }}
                      />
                    )}
                    {idx !== null && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-600">{idx.toFixed(2)}×</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 w-14 text-right flex-shrink-0 tabular-nums">
                    {m.revenue > 0 ? formatCurrency(m.revenue, { compact: true }) : "—"}
                  </span>
                  {m.revenue > 0 && <ChevronDown className="w-3 h-3 text-slate-300 flex-shrink-0" />}
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>

      {/* DoW + YoY table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader title="Distribución por día de semana" subtitle={filter.selectedBranches.length > 0 || filter.selectedYears.length > 0 || filter.selectedMonths.length > 0 ? "Selección filtrada" : "Ingresos acumulados históricos"} />
          <div className="h-52 mt-2">
            <DayOfWeekChart data={filteredDayOfWeek} />
          </div>
          <div className="mt-3 flex gap-3">
            <div className="flex-1 p-3 rounded-lg bg-indigo-50">
              <p className="text-xs font-semibold text-indigo-700">Fin de semana</p>
              <p className="text-lg font-bold text-indigo-900 mt-0.5 tabular-nums">{weekendShare.toFixed(0)}%</p>
              <p className="text-[10px] text-indigo-600/70">Vie · Sáb · Dom</p>
            </div>
            <div className="flex-1 p-3 rounded-lg bg-slate-50">
              <p className="text-xs font-semibold text-slate-600">Entre semana</p>
              <p className="text-lg font-bold text-slate-700 mt-0.5 tabular-nums">{(100 - weekendShare).toFixed(0)}%</p>
              <p className="text-[10px] text-slate-400">Lun · Mar · Mié · Jue</p>
            </div>
          </div>
        </motion.div>

        {/* YoY comparison table */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader title="Comparativo año a año" subtitle="Ingresos mensuales por ejercicio" />
          <div className="mt-2 overflow-x-auto">
            {(() => {
              const tableYears = data.availableYears.slice(-3)
              const lastY = tableYears[tableYears.length - 1]
              const prevY = tableYears[tableYears.length - 2]
              return (
                <table className="w-full text-xs min-w-[320px]">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-1.5 px-1 text-slate-400 font-medium">Mes</th>
                      {tableYears.map((y, yi) => (
                        <th key={y} className={`text-right py-1.5 px-1 font-medium ${yi === tableYears.length - 1 ? "text-slate-700" : "text-slate-400"}`}>
                          {y}{y >= new Date().getFullYear() && <span className="ml-0.5 text-[9px] text-indigo-400">*</span>}
                        </th>
                      ))}
                      <th className="text-right py-1.5 px-1 text-slate-400 font-medium">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(mes => {
                      // Fixed: uses global data.revenueByMonth, not filtered
                      const revByYear = tableYears.map(y => data.revenueByMonth.find(m => m.año === y && m.mes === mes)?.revenue || 0)
                      const lastRev = revByYear[revByYear.length - 1]
                      const prevRev = revByYear[revByYear.length - 2] ?? 0
                      // If latest year has no data for this month → pending, show friendly indicator
                      const isPending = lastRev === 0
                      const chg = (!isPending && prevRev > 0) ? calcChange(lastRev, prevRev) : null
                      return (
                        <tr key={mes} onClick={() => lastRev > 0 && setSelectedMonth({ year: lastY, month: mes })} className={`border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer transition-colors ${selectedMonth?.month === mes ? "bg-indigo-50/50" : ""}`}>
                          <td className="py-1.5 px-1 font-medium text-slate-700">{MONTH_LABELS_ES[mes]}</td>
                          {revByYear.map((rev, yi) => (
                            <td key={tableYears[yi]} className={`py-1.5 px-1 text-right tabular-nums ${yi === revByYear.length - 1 ? "font-bold text-slate-900" : "text-slate-400"}`}>
                              {rev > 0 ? formatCurrency(rev, { compact: true }) : <span className="text-slate-200">—</span>}
                            </td>
                          ))}
                          <td className={`py-1.5 px-1 text-right font-semibold tabular-nums ${chg === null ? "text-slate-200" : chg >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {isPending
                              ? <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-medium">pendiente</span>
                              : chg !== null ? `${chg >= 0 ? "+" : ""}${chg.toFixed(1)}%` : "—"
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )
            })()}
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightCard insight={{ id: "december-peak", type: "info", title: "Diciembre — pico estacional consistente", description: `El mes de diciembre presenta un índice de ${decemberIdx.toFixed(2)}× respecto al promedio mensual. La estrategia de inventario debe anticipar esta demanda con 6–8 semanas de anticipación.`, metricValue: `${decemberIdx.toFixed(1)}×`, priority: "high" }} />
        <InsightCard insight={{ id: "weekend-opp", type: "opportunity", title: "Activar días entre semana — oportunidad latente", description: `El ${(100 - weekendShare).toFixed(0)}% de las ventas ocurre de lunes a jueves. Activaciones midweek (eventos, campañas) podrían capturar demanda no atendida.`, metricValue: `${(100 - weekendShare).toFixed(0)}% entre semana`, priority: "medium" }} />
      </div>
    </div>
  )
}
