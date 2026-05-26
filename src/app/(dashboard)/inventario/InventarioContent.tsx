"use client"

import { useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { BarChart3, AlertTriangle, CheckCircle, Clock, Filter } from "lucide-react"
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader"
import { InsightCard } from "@/components/cards/InsightCard"
import { useFilter } from "@/contexts/FilterContext"
import { formatCurrency, formatPercentAbs, formatNumber, CHART_COLORS } from "@/lib/utils"
import type { DashboardSummary } from "@/lib/types"

interface InventarioContentProps {
  data: DashboardSummary
}

export function InventarioContent({ data }: InventarioContentProps) {
  const { isFiltered, filter, filteredCategoryRevenue } = useFilter()

  // Exact filter-aware units per category (branch × month × category matrix)
  const filteredCategoryUnits = useMemo<Record<string, number>>(() => {
    if (!isFiltered) return {}
    const activeBranches = filter.selectedBranches.length > 0
      ? filter.selectedBranches
      : data.availableBranches.map((b) => b.id)
    const activeYears = filter.selectedYears.length > 0 ? filter.selectedYears : data.availableYears
    const activeMonths = filter.selectedMonths
    const result: Record<string, number> = {}
    for (const branchId of activeBranches) {
      const bmc = data.branchMonthCategoryUnitsMatrix[branchId] || {}
      for (const [key, catMap] of Object.entries(bmc)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [cat, units] of Object.entries(catMap)) {
          result[cat] = (result[cat] || 0) + units
        }
      }
    }
    return result
  }, [filter, data, isFiltered])

  // Merge filtered revenue/share + exact units with static margin metrics
  const categories = isFiltered
    ? filteredCategoryRevenue.map((fc) => {
        const staticCat = data.revenueByCategory.find((c) => c.categoria === fc.categoria)
        return {
          categoria: fc.categoria,
          revenue: fc.revenue,
          revenueShare: fc.revenueShare,
          units: filteredCategoryUnits[fc.categoria] ?? 0,
          marginPct: staticCat?.marginPct || 0,
          grossMargin: staticCat?.grossMargin || 0,
        }
      })
    : data.revenueByCategory.map((c) => ({
        categoria: c.categoria,
        revenue: c.revenue,
        revenueShare: c.revenueShare,
        units: c.units,
        marginPct: c.marginPct,
        grossMargin: c.grossMargin,
      }))

  const top3CatShare = categories.slice(0, 3).reduce((s, c) => s + c.revenueShare, 0)
  const longtailCats = categories.filter((c) => c.revenueShare < 5)

  const healthSignals = [
    {
      label: "Categorías en zona verde",
      value: categories.filter((c) => c.marginPct > 50).length,
      total: categories.length,
      status: "healthy",
      description: "Margen bruto >50%",
    },
    {
      label: "Categorías en zona amarilla",
      value: categories.filter((c) => c.marginPct >= 40 && c.marginPct <= 50).length,
      total: categories.length,
      status: "caution",
      description: "Margen entre 40–50%",
    },
    {
      label: "Categorías en zona roja",
      value: categories.filter((c) => c.marginPct < 40).length,
      total: categories.length,
      status: "risk",
      description: "Margen bruto <40%",
    },
  ]

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        icon={BarChart3}
        title="Salud del Inventario"
        subtitle="Eficiencia del portafolio, rotación y alertas de stock lento"
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
                Participación en ingresos filtrada por{" "}
                {filter.selectedBranches.length > 0 && (
                  <strong>{filter.selectedBranches.length} sucursal{filter.selectedBranches.length > 1 ? "es" : ""}</strong>
                )}
                {filter.selectedBranches.length > 0 && filter.selectedYears.length > 0 && " · "}
                {filter.selectedYears.length > 0 && <strong>años {filter.selectedYears.join(", ")}</strong>}.
                {" "}Márgenes reflejan histórico total del portafolio.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Health signals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {healthSignals.map((signal, i) => (
          <motion.div
            key={signal.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-white rounded-xl card-shadow p-5 flex items-start gap-4"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              signal.status === "healthy" ? "bg-emerald-50" : signal.status === "caution" ? "bg-amber-50" : "bg-red-50"
            }`}>
              {signal.status === "healthy" ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : signal.status === "caution" ? (
                <Clock className="w-5 h-5 text-amber-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-500" />
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1">{signal.label}</p>
              <p className={`text-2xl font-bold ${
                signal.status === "healthy" ? "text-emerald-600" : signal.status === "caution" ? "text-amber-600" : "text-red-500"
              }`}>
                {signal.value}/{signal.total}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{signal.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Category margin matrix */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-xl card-shadow p-5">
        <SectionHeader
          title="Matriz de eficiencia por categoría"
          subtitle={isFiltered ? "Participación filtrada · margen histórico" : "Margen bruto vs participación en ingresos"}
        />
        <div className="mt-4 space-y-3">
          {categories.map((cat, i) => {
            const status = cat.marginPct > 50 ? "healthy" : cat.marginPct >= 40 ? "caution" : "risk"
            return (
              <motion.div
                key={cat.categoria}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 w-28 flex-shrink-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    status === "healthy" ? "bg-emerald-500" : status === "caution" ? "bg-amber-500" : "bg-red-500"
                  }`} />
                  <span className="text-xs font-medium text-slate-700 truncate">{cat.categoria}</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-12 flex-shrink-0">Margen</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          status === "healthy" ? "bg-emerald-500" : status === "caution" ? "bg-amber-400" : "bg-red-400"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(cat.marginPct, 100)}%` }}
                        transition={{ duration: 0.6, delay: 0.4 + i * 0.04 }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-10 text-right ${
                      status === "healthy" ? "text-emerald-600" : status === "caution" ? "text-amber-600" : "text-red-500"
                    }`}>
                      {formatPercentAbs(cat.marginPct)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-12 flex-shrink-0">Partic.</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-indigo-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${cat.revenueShare}%` }}
                        transition={{ duration: 0.6, delay: 0.45 + i * 0.04 }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 w-10 text-right">{formatPercentAbs(cat.revenueShare)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 hidden md:block">
                  <p className="text-xs font-bold text-slate-900">{formatCurrency(cat.revenue, { compact: true })}</p>
                  <p className="text-[10px] text-slate-400">{formatNumber(cat.units)} uds</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Aging inventory note */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-amber-800 mb-1">Nota sobre análisis de aging inventory</h3>
            <p className="text-xs text-amber-700 leading-relaxed">
              El análisis de inventario en aging requiere cruzar las ventas con el inventario actual disponible, que no está incluido en este dataset. Con los datos de ventas, se puede identificar el tiempo entre última venta y fecha de corte como señal proxy de stock lento. Regla del negocio: productos sin venta en 60+ días son candidatos a inventario en riesgo.
            </p>
            <p className="text-xs text-amber-600 font-medium mt-2">
              Próximo paso: integrar inventario actual (conteo físico) para análisis completo de dead stock.
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightCard
          insight={{
            id: "margin-efficiency",
            type: "opportunity",
            title: "Alta eficiencia de margen en categorías top",
            description: `Las categorías con mayor participación en ingresos mantienen márgenes saludables. Outerwear combina alto volumen con margen sólido, lo que la convierte en el pilar del portafolio.`,
            metricValue: `${categories.filter((c) => c.marginPct > 50).length} categorías >50%`,
            priority: "high",
          }}
        />
        <InsightCard
          insight={{
            id: "longtail",
            type: "info",
            title: `${longtailCats.length} categorías con participación menor al 5%`,
            description: `Hay ${longtailCats.length} categorías con menos del 5% de participación en ingresos${isFiltered ? " filtrados" : ""}. Evaluar si representan nichos estratégicos o si generan complejidad operativa sin retorno proporcional.`,
            metricValue: `${longtailCats.length} categorías`,
            priority: "medium",
          }}
        />
      </div>
    </div>
  )
}
