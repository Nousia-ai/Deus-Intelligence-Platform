"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Store, Filter } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { SectionHeader } from "@/components/layout/PageHeader"
import { InsightCard } from "@/components/cards/InsightCard"
import { BranchBarChart } from "@/components/charts/BranchChart"
import { useFilter } from "@/contexts/FilterContext"
import {
  formatCurrency,
  formatPercentAbs,
  CHART_COLORS,
} from "@/lib/utils"
import type { DashboardSummary, BranchMetrics } from "@/lib/types"

interface BranchContentProps {
  data: DashboardSummary
}

const RANK_LABELS = ["#1", "#2", "#3", "#4", "#5", "#6"]

export function BranchContent({ data }: BranchContentProps) {
  const { isFiltered, filter, filteredBranchRevenue, filteredRevenue } = useFilter()

  // Build display branches: merge filtered revenue with static metrics
  const physicalBranches = data.revenueByBranch.filter((b) => b.tipo === "física")

  const displayBranches: BranchMetrics[] = isFiltered
    ? filteredBranchRevenue
        .filter((fb) => physicalBranches.some((pb) => pb.sucursal_id === fb.id))
        .map((fb) => {
          const staticB = physicalBranches.find((pb) => pb.sucursal_id === fb.id)!
          return {
            ...staticB,
            revenue: fb.revenue,
            revenueShare: fb.revenueShare,
          }
        })
        .filter((b) => b.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
    : physicalBranches.sort((a, b) => b.revenue - a.revenue)

  const totalRev = isFiltered ? filteredRevenue : data.physicalTotalRevenue
  const leader = displayBranches[0]
  const laggard = displayBranches[displayBranches.length - 1]
  const gapPct = leader && laggard ? ((leader.revenue - laggard.revenue) / leader.revenue) * 100 : 0
  const avgMargin = displayBranches.length > 0 ? displayBranches.reduce((s, b) => s + b.marginPct, 0) / displayBranches.length : 0
  const avgDiscount = displayBranches.length > 0 ? displayBranches.reduce((s, b) => s + b.discountRate, 0) / displayBranches.length : 0

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        icon={Store}
        title="Inteligencia de Sucursales"
        subtitle="Análisis de rendimiento por punto de venta físico"
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
                Mostrando ingresos para{" "}
                <strong>
                  {filter.selectedBranches.length > 0
                    ? `${filter.selectedBranches.length} sucursal${filter.selectedBranches.length > 1 ? "es" : ""}`
                    : "todas las sucursales"}
                </strong>
                {filter.selectedYears.length > 0 && (
                  <> · años <strong>{filter.selectedYears.join(", ")}</strong></>
                )}
                . Margen y descuento reflejan datos históricos totales.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Sucursal líder", value: leader?.nombre.replace("Deus Store ", "") || "—", sub: formatCurrency(leader?.revenue || 0, { compact: true }), color: "text-indigo-600" },
          { label: "Margen promedio", value: formatPercentAbs(avgMargin), sub: "bruto sobre ventas", color: "text-emerald-600" },
          { label: "Brecha top vs bottom", value: `${gapPct.toFixed(0)}%`, sub: "diferencia de ingresos", color: "text-amber-600" },
          { label: "Descuento promedio", value: formatPercentAbs(avgDiscount), sub: "líneas con descuento", color: "text-slate-600" },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
            className="bg-white rounded-xl card-shadow p-4"
          >
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-2">{item.label}</p>
            <p className={`text-xl font-bold ${item.color} leading-none`}>{item.value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Chart + Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.45 }}
          className="bg-white rounded-xl card-shadow p-5"
        >
          <SectionHeader
            title="Ingresos por sucursal"
            subtitle={isFiltered ? "Selección filtrada" : "Total histórico acumulado"}
          />
          <div className="h-64">
            <BranchBarChart data={displayBranches} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          className="bg-white rounded-xl card-shadow p-5"
        >
          <SectionHeader title="Ranking de rendimiento" subtitle="Posición y métricas clave" />
          <div className="space-y-2 mt-1">
            {displayBranches.map((branch, i) => (
              <motion.div
                key={branch.sucursal_id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.3 }}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <span
                  className="text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white"
                  style={{ background: CHART_COLORS[i] || "#CBD5E1" }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">
                    {branch.nombre.replace("Deus Store ", "")}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-slate-400">
                      Margen: <span className="font-semibold text-slate-600">{formatPercentAbs(branch.marginPct)}</span>
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Desc: <span className="font-semibold text-slate-600">{formatPercentAbs(branch.discountRate)}</span>
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(branch.revenue, { compact: true })}</p>
                  <p className="text-[10px] text-slate-400">{branch.revenueShare.toFixed(1)}% total</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Revenue share bars */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.45 }}
        className="bg-white rounded-xl card-shadow p-5"
      >
        <SectionHeader
          title="Participación en el total"
          subtitle={`Contribución al ${isFiltered ? "ingreso filtrado" : "ingreso histórico"}`}
        />
        <div className="mt-4 space-y-3">
          {displayBranches.map((branch, i) => (
            <div key={branch.sucursal_id} className="flex items-center gap-4">
              <span className="text-xs font-medium text-slate-600 w-28 truncate flex-shrink-0">
                {branch.nombre.replace("Deus Store ", "")}
              </span>
              <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: CHART_COLORS[i] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${branch.revenueShare}%` }}
                  transition={{ duration: 0.7, delay: 0.5 + i * 0.07, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700 w-12 text-right flex-shrink-0">
                {branch.revenueShare.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-400 w-16 text-right flex-shrink-0 hidden md:block">
                {formatCurrency(branch.revenue, { compact: true })}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightCard
          insight={{
            id: "branch-leader",
            type: "trend",
            title: `${leader?.nombre.replace("Deus Store ", "")} — sucursal dominante`,
            description: `Genera ${leader?.revenueShare.toFixed(1)}% del total ${isFiltered ? "filtrado" : ""}. Mantiene el margen más alto del grupo, posicionándose como el benchmark de rentabilidad del portafolio.`,
            metricValue: formatCurrency(leader?.revenue || 0, { compact: true }),
            priority: "high",
          }}
        />
        <InsightCard
          insight={{
            id: "branch-gap",
            type: gapPct > 60 ? "risk" : "info",
            title: "Brecha entre mejor y peor desempeño",
            description: `Existe una diferencia del ${gapPct.toFixed(0)}% entre la sucursal líder y la de menor rendimiento. ${gapPct > 60 ? "Una brecha de esta magnitud sugiere revisar la estrategia operativa de las sucursales rezagadas." : "Distribución relativamente equilibrada."}`,
            metricValue: `${gapPct.toFixed(0)}% brecha`,
            priority: gapPct > 60 ? "high" : "medium",
          }}
        />
      </div>
    </div>
  )
}
