"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Package, Filter } from "lucide-react"
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader"
import { InsightCard } from "@/components/cards/InsightCard"
import { CategoryPieChart } from "@/components/charts/BranchChart"
import { useFilter } from "@/contexts/FilterContext"
import { formatCurrency, formatPercentAbs, CHART_COLORS } from "@/lib/utils"
import type { DashboardSummary } from "@/lib/types"

interface ProductContentProps {
  data: DashboardSummary
}

export function ProductContent({ data }: ProductContentProps) {
  const { isFiltered, filter, filteredCategoryRevenue } = useFilter()

  // Merge filtered revenue + share with static margin/discount/price metrics
  const displayCategories = isFiltered
    ? filteredCategoryRevenue.map((fc) => {
        const staticCat = data.revenueByCategory.find((c) => c.categoria === fc.categoria)
        return {
          categoria: fc.categoria,
          revenue: fc.revenue,
          revenueShare: fc.revenueShare,
          units: staticCat?.units || 0,
          avgPrice: staticCat?.avgPrice || 0,
          grossMargin: staticCat?.grossMargin || 0,
          marginPct: staticCat?.marginPct || 0,
          discountRate: staticCat?.discountRate || 0,
        }
      })
    : data.revenueByCategory

  const topCat = displayCategories[0]

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        icon={Package}
        title="Inteligencia de Catálogo"
        subtitle="Rendimiento por categoría, marca y segmento de precio"
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
                Ingresos y participación filtrados por{" "}
                {filter.selectedBranches.length > 0 && (
                  <strong>{filter.selectedBranches.length} sucursal{filter.selectedBranches.length > 1 ? "es" : ""}</strong>
                )}
                {filter.selectedBranches.length > 0 && filter.selectedYears.length > 0 && " · "}
                {filter.selectedYears.length > 0 && <strong>años {filter.selectedYears.join(", ")}</strong>}.
                {" "}Margen y precio promedio reflejan histórico total.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category table */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl card-shadow p-5">
          <SectionHeader
            title="Rendimiento por categoría"
            subtitle={isFiltered ? "Ingresos filtrados · margen histórico" : "Ingresos, margen y descuento"}
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
                    <td className="py-2.5 px-2 text-right font-bold text-slate-900">
                      {formatCurrency(cat.revenue, { compact: true })}
                    </td>
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
                    <td className="py-2.5 px-2 text-right text-slate-600">
                      {formatCurrency(cat.avgPrice)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-slate-500">
                      {formatPercentAbs(cat.discountRate)}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie chart */}
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

      {/* Brands performance */}
      <div className="bg-white rounded-xl card-shadow p-5">
        <SectionHeader title="Desempeño de marcas" subtitle="Portafolio completo ordenado por ingresos" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
          {data.topBrands.map((brand, i) => (
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

      {/* Price tier breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader title="Segmentación por precio" subtitle="Distribución de líneas por rango de precio" />
          <div className="space-y-3 mt-3">
            {data.priceRanges.map((p, i) => (
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
