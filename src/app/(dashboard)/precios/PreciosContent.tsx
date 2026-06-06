"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Tag, Filter } from "lucide-react"
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader"
import { InsightCard } from "@/components/cards/InsightCard"
import { useFilter } from "@/contexts/FilterContext"
import { formatCurrency, formatPercentAbs, formatNumber, CHART_COLORS } from "@/lib/utils"
import type { DashboardSummary } from "@/lib/types"

interface PreciosContentProps {
  data: DashboardSummary
}

export function PreciosContent({ data }: PreciosContentProps) {
  const {
    isFiltered, filter, filteredRevenue,
    filteredDiscountKPIs, filteredPriceRanges,
    filteredPaymentMethods, filteredCategoryDiscount,
  } = useFilter()

  // ── Active discount values: filtered or global ─────────────────────────────
  const disc = isFiltered
    ? {
        pctWithDiscount: filteredDiscountKPIs.pctVentasConDescuento,
        avgDiscount: filteredDiscountKPIs.profundidadDescuento,
        fullPrice: filteredDiscountKPIs.mixPrecioLista,
      }
    : {
        pctWithDiscount: data.discountStats.pctWithDiscount,
        avgDiscount: data.discountStats.avgDiscountWhenApplied,
        fullPrice: 100 - data.discountStats.pctWithDiscount,
      }

  // ── Scaled lost revenue (approximation — price_lista matrix not available) ─
  const lostRevenue = data.discountStats.revenueImpact
  const scaledLostRevenue = isFiltered && data.physicalTotalRevenue > 0
    ? (lostRevenue / data.physicalTotalRevenue) * filteredRevenue
    : lostRevenue

  // ── Price segments: filtered or global ─────────────────────────────────────
  const displayPriceRanges = isFiltered ? filteredPriceRanges : data.priceRanges

  // ── Payment methods: filtered or global ────────────────────────────────────
  const displayPaymentMethods = isFiltered ? filteredPaymentMethods : data.paymentMethods

  // ── Category discount: filtered or global ──────────────────────────────────
  const displayCategoryDiscount = data.revenueByCategory.slice(0, 7)
    .map((cat) => ({
      categoria: cat.categoria,
      discountRate: isFiltered && filteredCategoryDiscount[cat.categoria] !== undefined
        ? filteredCategoryDiscount[cat.categoria]
        : cat.discountRate,
    }))
    .sort((a, b) => b.discountRate - a.discountRate)

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        icon={Tag}
        title="Comportamiento de Precios y Descuentos"
        subtitle="Análisis de poder de precio, descuentos y segmentación"
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
                Filtro activo —{" "}
                {filter.selectedBranches.length > 0 && (
                  <strong>{filter.selectedBranches.length} sucursal{filter.selectedBranches.length > 1 ? "es" : ""}</strong>
                )}
                {filter.selectedBranches.length > 0 && filter.selectedYears.length > 0 && " · "}
                {filter.selectedYears.length > 0 && <strong>años {filter.selectedYears.join(", ")}</strong>}.
                {" "}Todas las métricas reflejan el período seleccionado.
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Con descuento", value: formatPercentAbs(disc.pctWithDiscount), sub: "de las líneas de venta", color: "text-amber-600" },
          { label: "Descuento promedio", value: formatPercentAbs(disc.avgDiscount), sub: isFiltered ? "promedio ponderado filtrado" : "cuando se aplica", color: "text-red-500" },
          { label: "Ingreso sacrificado", value: formatCurrency(scaledLostRevenue, { compact: true }), sub: isFiltered ? "estimado filtrado" : "vs precio lista total", color: "text-slate-600" },
          { label: "Ventas full-price", value: formatPercentAbs(disc.fullPrice), sub: "al precio de etiqueta", color: "text-emerald-600" },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-white rounded-xl card-shadow p-4">
            <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium mb-2">{item.label}</p>
            <p className={`text-xl font-bold ${item.color} leading-none`}>{item.value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{item.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Price segment analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader
            title="Segmentos de precio"
            subtitle={isFiltered ? "Distribución filtrada por rango de precio" : "Distribución de ventas por rango de precio"}
          />
          <div className="mt-4 space-y-4">
            {displayPriceRanges.map((p, i) => (
              <div key={p.rango}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i] }} />
                    <span className="text-sm font-semibold text-slate-700">{p.rango}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">{formatNumber(p.count)} líneas</span>
                    <span className="font-bold text-slate-900">{formatCurrency(p.revenue, { compact: true })}</span>
                  </div>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: CHART_COLORS[i] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${p.share}%` }}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.08 }}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 text-right">{p.share.toFixed(1)}% del mix</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Discount by category */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-xl card-shadow p-5">
          <SectionHeader
            title="Descuento por categoría"
            subtitle={isFiltered ? "% unidades con descuento — filtrado" : "% de líneas con descuento aplicado"}
          />
          <div className="mt-4 space-y-3">
            {displayCategoryDiscount.map((cat, i) => (
              <div key={cat.categoria} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-600 w-24 truncate">{cat.categoria}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: cat.discountRate > 20 ? "#EF4444" : cat.discountRate > 10 ? "#D97706" : "#4F46E5" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(cat.discountRate * 4, 100)}%` }}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.05 }}
                  />
                </div>
                <span className={`text-xs font-bold w-12 text-right ${cat.discountRate > 20 ? "text-red-500" : cat.discountRate > 10 ? "text-amber-600" : "text-slate-600"}`}>
                  {formatPercentAbs(cat.discountRate)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Payment method */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-white rounded-xl card-shadow p-5">
        <SectionHeader
          title="Formas de pago"
          subtitle={isFiltered ? "Composición filtrada por método de cobro" : "Composición de transacciones por método de cobro"}
        />
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
          {displayPaymentMethods.map((p, i) => (
            <motion.div
              key={p.method}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className="p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-slate-700">{p.method}</span>
                <span className="text-[10px] font-bold text-slate-400">{p.share.toFixed(1)}%</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{formatNumber(p.count)}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">transacciones</p>
              <p className="text-xs font-semibold text-indigo-600 mt-2">{formatCurrency(p.revenue, { compact: true })}</p>
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: CHART_COLORS[i] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${p.share}%` }}
                  transition={{ duration: 0.6, delay: 0.5 + i * 0.05 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightCard
          insight={{
            id: "full-price-power",
            type: "opportunity",
            title: "Poder de precio sólido — modelo full-price",
            description: `El ${disc.fullPrice.toFixed(1)}% de las ventas se realizan al precio de etiqueta, sin descuento${isFiltered ? " en el período filtrado" : ""}. Esto indica alta aceptación del precio por parte del consumidor y preserva el margen bruto.`,
            metricValue: `${disc.fullPrice.toFixed(1)}% sin desc.`,
            priority: "high",
          }}
        />
        <InsightCard
          insight={{
            id: "efectivo-dominant",
            type: "info",
            title: "Efectivo — método de pago dominante",
            description: `El ${displayPaymentMethods[0]?.share.toFixed(0)}% de las transacciones${isFiltered ? " filtradas" : ""} se realizan en efectivo. Esto tiene implicaciones en flujo de caja diario y gestión de caja por sucursal.`,
            metricValue: `${displayPaymentMethods[0]?.share.toFixed(0)}% efectivo`,
            priority: "medium",
          }}
        />
      </div>
    </div>
  )
}
