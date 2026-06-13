"use client"

import { useState, useMemo } from "react"
import { motion } from "framer-motion"
import {
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  ArrowRight,
  Package,
} from "lucide-react"
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader"
import { useFilter } from "@/contexts/FilterContext"
import { formatCurrency, formatPercentAbs, formatNumber } from "@/lib/utils"
import type {
  DashboardSummary,
  InventoryKPI,
  AlertSummary,
  AlertLevel,
  TransferCandidate,
  WeeksOfSupplyRow,
} from "@/lib/types"

interface InventarioContentProps {
  data: DashboardSummary
  alertSummary: AlertSummary[]
  alerts: InventoryKPI[]
  stockouts: InventoryKPI[]
  transfers: TransferCandidate[]
  weeksOfSupply: WeeksOfSupplyRow[]
  replenishment: InventoryKPI[]
}

const NIVEL_CONFIG = {
  ROJA: {
    label: "Liquidar",
    sublabel: "91+ días sin rotar",
    bg: "bg-red-50",
    border: "border-red-100",
    text: "text-red-600",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    ring: "ring-red-300",
  },
  NARANJA: {
    label: "Markdown",
    sublabel: "61-90 días · sell-through <50%",
    bg: "bg-orange-50",
    border: "border-orange-100",
    text: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-400",
    ring: "ring-orange-300",
  },
  AMARILLA: {
    label: "Evaluar",
    sublabel: "31-60 días · sell-through <30%",
    bg: "bg-amber-50",
    border: "border-amber-100",
    text: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
    ring: "ring-amber-300",
  },
} as const

const SUCURSAL_SHORT: Record<string, string> = {
  "16S": "16S",
  atlx: "Atlx",
  czsr: "CzSr",
  chol: "Chol",
  cs: "C.Sur",
  sd: "S.Dgo",
}

function AlertBadge({ nivel }: { nivel: AlertLevel }) {
  const cfg = NIVEL_CONFIG[nivel]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {nivel}
    </span>
  )
}

function WosCell({ wos }: { wos: number | undefined }) {
  if (wos == null)
    return <td className="px-2 py-2 text-center text-[10px] text-slate-300">—</td>
  const cls =
    wos < 4
      ? "bg-emerald-100 text-emerald-700"
      : wos < 8
      ? "bg-amber-100 text-amber-700"
      : wos < 12
      ? "bg-orange-100 text-orange-700"
      : "bg-red-100 text-red-700"
  return (
    <td className="px-2 py-2 text-center">
      <span
        className={`inline-block min-w-[32px] text-[11px] font-semibold rounded px-1.5 py-0.5 tabular-nums ${cls}`}
      >
        {wos.toFixed(1)}
      </span>
    </td>
  )
}

export function InventarioContent({
  data,
  alertSummary,
  alerts,
  stockouts,
  transfers,
  weeksOfSupply,
  replenishment,
}: InventarioContentProps) {
  const { isFiltered, filter, filteredCategoryRevenue } = useFilter()
  const [activeSucursal, setActiveSucursal] = useState("")
  const [activeNivel, setActiveNivel] = useState<AlertLevel | "">("")
  const [query, setQuery] = useState("")

  const sucursales = useMemo(
    () => [...new Set(alerts.map((a) => a.sucursal_key))].sort(),
    [alerts]
  )

  const filteredAlerts = useMemo(() => {
    let rows = alerts
    if (activeSucursal) rows = rows.filter((r) => r.sucursal_key === activeSucursal)
    if (activeNivel) rows = rows.filter((r) => r.nivel_alerta === activeNivel)
    if (query) {
      const q = query.toLowerCase()
      rows = rows.filter(
        (r) =>
          (r.descripcion ?? "").toLowerCase().includes(q) ||
          (r.sku_padre ?? "").includes(q) ||
          (r.marca ?? "").toLowerCase().includes(q)
      )
    }
    return rows.slice(0, 100)
  }, [alerts, activeSucursal, activeNivel, query])

  // ── existing category logic (unchanged) ──────────────────────────────────────
  const filteredCategoryUnits = useMemo<Record<string, number>>(() => {
    if (!isFiltered) return {}
    const activeBranches =
      filter.selectedBranches.length > 0
        ? filter.selectedBranches
        : data.availableBranches.map((b) => b.id)
    const activeYears =
      filter.selectedYears.length > 0 ? filter.selectedYears : data.availableYears
    const result: Record<string, number> = {}
    for (const branchId of activeBranches) {
      const bmc = data.branchMonthCategoryUnitsMatrix[branchId] || {}
      for (const [key, catMap] of Object.entries(bmc)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (filter.selectedMonths.length > 0 && !filter.selectedMonths.includes(month)) continue
        for (const [cat, units] of Object.entries(catMap)) {
          result[cat] = (result[cat] || 0) + units
        }
      }
    }
    return result
  }, [filter, data, isFiltered])

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

  const hasInventoryData = alerts.length > 0 || stockouts.length > 0

  const { heatmapSucursales, heatmapTipos, heatmapData } = useMemo(() => {
    const heatmapSucursales = [...new Set(weeksOfSupply.map((r) => r.sucursal_key))].sort()
    const heatmapTipos = [...new Set(weeksOfSupply.map((r) => r.tipo_producto))].sort()
    const heatmapData: Record<string, Record<string, WeeksOfSupplyRow>> = {}
    for (const row of weeksOfSupply) {
      if (!heatmapData[row.sucursal_key]) heatmapData[row.sucursal_key] = {}
      heatmapData[row.sucursal_key][row.tipo_producto] = row
    }
    return { heatmapSucursales, heatmapTipos, heatmapData }
  }, [weeksOfSupply])

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        icon={BarChart3}
        title="Salud del Inventario"
        subtitle="Alertas de aging, slow movers y quiebres de stock"
      />

      {/* ── Alert summary cards ──────────────────────────────────────────────── */}
      {hasInventoryData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["ROJA", "NARANJA", "AMARILLA"] as AlertLevel[]).map((nivel, i) => {
            const summary = alertSummary.find((s) => s.nivel === nivel)
            const cfg = NIVEL_CONFIG[nivel]
            const active = activeNivel === nivel
            return (
              <motion.button
                key={nivel}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => setActiveNivel(active ? "" : nivel)}
                className={`text-left p-5 rounded-xl border transition-all duration-150 ${cfg.bg} ${cfg.border} ${
                  active ? `ring-2 ring-offset-1 ${cfg.ring}` : "hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-bold uppercase tracking-widest opacity-60 ${cfg.text}`}>
                    {nivel}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                </div>
                <p className={`text-3xl font-bold ${cfg.text}`}>
                  {summary?.skus ?? 0}
                  <span className={`text-sm font-normal ml-1.5 opacity-60 ${cfg.text}`}>SKUs</span>
                </p>
                <p className={`text-sm font-semibold mt-1 ${cfg.text}`}>
                  {formatCurrency(summary?.valor_en_riesgo ?? 0, { compact: true })} en costo
                </p>
                <p className={`text-[11px] mt-2 opacity-55 ${cfg.text}`}>{cfg.sublabel}</p>
                {summary && summary.sucursales.length > 0 && (
                  <p className={`text-[10px] font-medium mt-1 opacity-70 ${cfg.text}`}>
                    {summary.sucursales.join(", ")}
                  </p>
                )}
              </motion.button>
            )
          })}
        </div>
      )}

      {/* ── Slow movers table ────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="bg-white rounded-xl card-shadow overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100">
            <SectionHeader
              title="Inventario en riesgo · Slow movers"
              subtitle={`${alerts.length} SKUs con alerta activa${activeNivel ? ` · mostrando ${activeNivel}` : ""}`}
            />
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <div className="flex flex-wrap gap-1">
                {["", ...sucursales].map((suc) => (
                  <button
                    key={suc || "all"}
                    onClick={() => setActiveSucursal(suc)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-100 ${
                      activeSucursal === suc
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {suc ? (SUCURSAL_SHORT[suc] ?? suc) : "Todas"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar descripción, SKU, marca..."
                  className="text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-400 w-44"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {["Descripción", "Suc", "Días s/venta", "Sell-through", "WoS", "Valor costo", "Alerta"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide ${
                          h === "Descripción" ? "text-left px-5" : h === "Alerta" ? "text-center px-4" : "text-right px-3"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredAlerts.map((row, i) => (
                  <tr
                    key={`${row.codigo}-${row.sucursal_key}`}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 truncate max-w-[200px]">
                        {row.descripcion ?? "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {row.sku_padre}
                        {row.talla ? ` · ${row.talla}` : ""}
                        {row.bucket_aging ? ` · ${row.bucket_aging}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {row.sucursal_key}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={`font-semibold tabular-nums ${
                          (row.dias_sin_venta ?? 0) > 90
                            ? "text-red-600"
                            : (row.dias_sin_venta ?? 0) > 60
                            ? "text-orange-500"
                            : "text-amber-600"
                        }`}
                      >
                        {row.dias_sin_venta ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span
                        className={
                          (row.sell_through ?? 1) < 0.3
                            ? "text-red-500 font-medium"
                            : (row.sell_through ?? 1) < 0.5
                            ? "text-orange-500 font-medium"
                            : "text-slate-600"
                        }
                      >
                        {row.sell_through != null
                          ? formatPercentAbs(row.sell_through * 100)
                          : "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700 tabular-nums">
                      {row.weeks_of_supply != null ? row.weeks_of_supply.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700 tabular-nums">
                      {row.valor_inv_costo != null
                        ? formatCurrency(row.valor_inv_costo, { compact: true })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.nivel_alerta && <AlertBadge nivel={row.nivel_alerta} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredAlerts.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">Sin SKUs con los filtros actuales</p>
              </div>
            )}
            {filteredAlerts.length === 100 && alerts.length > 100 && (
              <p className="px-5 py-3 text-xs text-slate-400 text-center bg-slate-50 border-t border-slate-100">
                Mostrando 100 de {alerts.length} · Usa filtros para refinar
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Stockouts ────────────────────────────────────────────────────────── */}
      {stockouts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="bg-white rounded-xl card-shadow overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100">
            <SectionHeader
              title="Quiebres de stock"
              subtitle={`${stockouts.length} SKUs con stock agotado y ventas previas · ordenados por velocidad`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {["Descripción", "Suc", "Uds vendidas", "Vel. semanal", "Sell-through"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide ${
                          h === "Descripción" ? "text-left px-5" : "text-right px-3"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stockouts.slice(0, 50).map((row) => (
                  <tr
                    key={`${row.codigo}-${row.sucursal_key}`}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 truncate max-w-[220px]">
                        {row.descripcion ?? "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {row.sku_padre}
                        {row.talla ? ` · ${row.talla}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                        {row.sucursal_key}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums">
                      {formatNumber(row.unidades_vendidas ?? 0)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span className="font-semibold text-indigo-600">
                        {row.velocidad_semanal != null
                          ? row.velocidad_semanal.toFixed(1)
                          : "—"}
                      </span>
                      <span className="text-slate-400 ml-0.5">/sem</span>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-emerald-600 tabular-nums">
                      {row.sell_through != null
                        ? formatPercentAbs(row.sell_through * 100)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {stockouts.length > 50 && (
              <p className="px-5 py-3 text-xs text-slate-400 text-center bg-slate-50 border-t border-slate-100">
                Mostrando 50 de {stockouts.length} quiebres
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Fallback when no inventory data ──────────────────────────────────── */}
      {!hasInventoryData && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50/60 border border-amber-200/60 rounded-xl p-5"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-amber-800 mb-1">
                Datos de inventario no disponibles
              </h3>
              <p className="text-xs text-amber-700 leading-relaxed">
                La tabla inventory_kpis está vacía o Supabase no está configurado. Ejecuta
                seed_supabase.py para cargar los datos del kardex.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Transferencias recomendadas ──────────────────────────────────────── */}
      {transfers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
          className="bg-white rounded-xl card-shadow overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100">
            <SectionHeader
              title="Transferencias recomendadas"
              subtitle={`${transfers.length} pares DONANTE → RECEPTORA · redistribuir sin compra`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {["Descripción / SKU", "De (donante)", "Stock", "A (receptora)", "Transferir"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide ${
                          h === "Descripción / SKU" ? "text-left px-5" : "text-right px-3"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transfers.slice(0, 50).map((t, i) => (
                  <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-slate-800 truncate max-w-[200px]">
                        {t.descripcion ?? "—"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {t.sku_padre}
                        {t.marca ? ` · ${t.marca}` : ""}
                        {t.tipo_producto ? ` · ${t.tipo_producto}` : ""}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                        {t.donante_key}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums">
                      {t.donante_stock}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-[10px] font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {t.receptora_key}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-bold text-emerald-600 tabular-nums">
                        {t.unidades_a_transferir}
                      </span>
                      <span className="text-slate-400 ml-0.5">uds</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transfers.length > 50 && (
              <p className="px-5 py-3 text-xs text-slate-400 text-center bg-slate-50 border-t border-slate-100">
                Mostrando 50 de {transfers.length} transferencias
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Heatmap Weeks of Supply ───────────────────────────────────────────── */}
      {weeksOfSupply.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl card-shadow overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100">
            <SectionHeader
              title="Semanas de supply · Sucursal × Categoría"
              subtitle="Semanas de inventario disponible por punto de venta y tipo de producto"
            />
            <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-emerald-100 inline-block" />
                &lt;4 sem · flujo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-amber-100 inline-block" />
                4-8 · normal
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-orange-100 inline-block" />
                8-12 · lento
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-100 inline-block" />
                &gt;12 · exceso
              </span>
            </div>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="text-xs border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-semibold text-slate-400 px-2 py-1 w-16">
                    SUC
                  </th>
                  {heatmapTipos.map((t) => (
                    <th
                      key={t}
                      className="text-center text-[10px] font-semibold text-slate-500 px-1 py-1"
                    >
                      <span className="block truncate max-w-[68px]">{t}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapSucursales.map((suc) => (
                  <tr key={suc}>
                    <td className="text-[11px] font-medium text-slate-600 px-2 py-1 whitespace-nowrap">
                      {SUCURSAL_SHORT[suc] ?? suc}
                    </td>
                    {heatmapTipos.map((tipo) => (
                      <WosCell
                        key={tipo}
                        wos={heatmapData[suc]?.[tipo]?.avg_weeks_of_supply}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ── Alertas de reposición ─────────────────────────────────────────────── */}
      {replenishment.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44 }}
          className="bg-white rounded-xl card-shadow overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100">
            <SectionHeader
              title="Alertas de reposición"
              subtitle={`${replenishment.length} SKUs con alta demanda y menos de 2 semanas de stock`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {["Descripción", "Sucursal", "Stock actual", "Sem. restantes", "Velocidad"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide ${
                          h === "Descripción" ? "text-left px-5" : "text-right px-3"
                        }`}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {replenishment.slice(0, 50).map((row) => {
                  const stock = row.inv_fin_unidades ?? 0
                  const vel = row.velocidad_semanal ?? 0
                  const weeksLeft = vel > 0 ? stock / vel : null
                  return (
                    <tr
                      key={`${row.codigo}-${row.sucursal_key}`}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800 truncate max-w-[200px]">
                          {row.descripcion ?? "—"}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {row.sku_padre}
                          {row.talla ? ` · ${row.talla}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-[10px] font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                          {row.sucursal_key}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700 tabular-nums">
                        {stock}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {weeksLeft != null ? (
                          <span
                            className={`font-bold tabular-nums ${
                              weeksLeft < 1 ? "text-red-600" : "text-orange-500"
                            }`}
                          >
                            {weeksLeft.toFixed(1)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        <span className="font-semibold text-indigo-600">{vel.toFixed(1)}</span>
                        <span className="text-slate-400 ml-0.5">/sem</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {replenishment.length > 50 && (
              <p className="px-5 py-3 text-xs text-slate-400 text-center bg-slate-50 border-t border-slate-100">
                Mostrando 50 de {replenishment.length} alertas
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* ── Category margin matrix (existing) ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl card-shadow p-5"
      >
        <SectionHeader
          title="Matriz de eficiencia por categoría"
          subtitle={
            isFiltered
              ? "Participación filtrada · margen histórico"
              : "Margen bruto vs participación en ingresos"
          }
        />
        <div className="mt-4 space-y-3">
          {categories.map((cat, i) => {
            const status =
              cat.marginPct > 50 ? "healthy" : cat.marginPct >= 40 ? "caution" : "risk"
            return (
              <motion.div
                key={cat.categoria}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.04 }}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 w-28 flex-shrink-0">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      status === "healthy"
                        ? "bg-emerald-500"
                        : status === "caution"
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-xs font-medium text-slate-700 truncate">
                    {cat.categoria}
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-12 flex-shrink-0">Margen</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${
                          status === "healthy"
                            ? "bg-emerald-500"
                            : status === "caution"
                            ? "bg-amber-400"
                            : "bg-red-400"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(cat.marginPct, 100)}%` }}
                        transition={{ duration: 0.6, delay: 0.4 + i * 0.04 }}
                      />
                    </div>
                    <span
                      className={`text-xs font-bold w-10 text-right ${
                        status === "healthy"
                          ? "text-emerald-600"
                          : status === "caution"
                          ? "text-amber-600"
                          : "text-red-500"
                      }`}
                    >
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
                    <span className="text-xs text-slate-500 w-10 text-right">
                      {formatPercentAbs(cat.revenueShare)}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 hidden md:block">
                  <p className="text-xs font-bold text-slate-900">
                    {formatCurrency(cat.revenue, { compact: true })}
                  </p>
                  <p className="text-[10px] text-slate-400">{formatNumber(cat.units)} uds</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
