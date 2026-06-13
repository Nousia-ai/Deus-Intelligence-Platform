"use client"

import { useMemo } from "react"
import { motion } from "framer-motion"
import { AlertTriangle, ArrowRight, Package, ShoppingCart, Download, Zap } from "lucide-react"
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader"
import { formatCurrency, formatPercentAbs, formatNumber } from "@/lib/utils"
import type {
  DashboardSummary,
  InventoryKPI,
  TransferCandidate,
  WeeksOfSupplyRow,
} from "@/lib/types"

interface DecisionesContentProps {
  data: DashboardSummary
  liquidar: InventoryKPI[]
  transferir: TransferCandidate[]
  reponer: InventoryKPI[]
  weeksOfSupply: WeeksOfSupplyRow[]
}

const BUCKET_CONFIG = {
  LIQUIDAR: {
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-100",
    headerBg: "bg-red-600",
    badgeBg: "bg-red-100 text-red-700",
    icon: AlertTriangle,
    accion: "Markdown 40–60% · Considerar outlet",
  },
  TRANSFERIR: {
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    headerBg: "bg-blue-600",
    badgeBg: "bg-blue-100 text-blue-700",
    icon: ArrowRight,
    accion: "Mover stock a sucursal receptora esta semana",
  },
  REPONER: {
    color: "text-orange-600",
    bg: "bg-orange-50",
    border: "border-orange-100",
    headerBg: "bg-orange-500",
    badgeBg: "bg-orange-100 text-orange-700",
    icon: Package,
    accion: "Solicitar reposición urgente a proveedor",
  },
  COMPRAR: {
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    headerBg: "bg-emerald-600",
    badgeBg: "bg-emerald-100 text-emerald-700",
    icon: ShoppingCart,
    accion: "Reforzar compra para temporada siguiente",
  },
} as const

function exportCSV(
  liquidar: InventoryKPI[],
  transferir: TransferCandidate[],
  reponer: InventoryKPI[],
  comprar: DashboardSummary["revenueByCategory"]
) {
  const rows: string[] = [
    `DECISIONES DE LA SEMANA - ${new Date().toLocaleDateString("es-MX")}`,
    "",
    "=== LIQUIDAR (nivel_alerta=ROJA) ===",
    "SKU,Descripción,Sucursal,Días s/venta,Sell-through,Valor costo",
    ...liquidar.slice(0, 50).map((r) =>
      [
        r.sku_padre ?? "",
        `"${r.descripcion ?? ""}"`,
        r.sucursal_key,
        r.dias_sin_venta ?? "",
        r.sell_through != null ? (r.sell_through * 100).toFixed(1) + "%" : "",
        r.valor_inv_costo?.toFixed(2) ?? "",
      ].join(",")
    ),
    "",
    "=== TRANSFERIR (DONANTE → RECEPTORA) ===",
    "SKU,Descripción,De,Stock donante,A,Transferir uds",
    ...transferir.slice(0, 50).map((t) =>
      [
        t.sku_padre,
        `"${t.descripcion ?? ""}"`,
        t.donante_key,
        t.donante_stock,
        t.receptora_key,
        t.unidades_a_transferir,
      ].join(",")
    ),
    "",
    "=== REPONER (RECEPTORA <2 semanas) ===",
    "SKU,Descripción,Sucursal,Stock actual,Sem. restantes,Velocidad/sem",
    ...reponer.slice(0, 50).map((r) => {
      const vel = r.velocidad_semanal ?? 0
      const wl = vel > 0 ? ((r.inv_fin_unidades ?? 0) / vel).toFixed(1) : ""
      return [
        r.sku_padre ?? "",
        `"${r.descripcion ?? ""}"`,
        r.sucursal_key,
        r.inv_fin_unidades ?? "",
        wl,
        vel.toFixed(1),
      ].join(",")
    }),
    "",
    "=== COMPRAR (alto margen) ===",
    "Categoría,Margen%,Ingresos,Unidades",
    ...comprar.map((c) =>
      [
        `"${c.categoria}"`,
        c.marginPct.toFixed(1) + "%",
        c.revenue.toFixed(2),
        c.units,
      ].join(",")
    ),
  ]

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `decisiones-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function DecisionesContent({
  data,
  liquidar,
  transferir,
  reponer,
  weeksOfSupply,
}: DecisionesContentProps) {
  const valorLiquidar = useMemo(
    () => liquidar.reduce((s, r) => s + (r.valor_inv_costo ?? 0), 0),
    [liquidar]
  )

  const comprar = useMemo(
    () => data.revenueByCategory.filter((c) => c.marginPct > 50).sort((a, b) => b.marginPct - a.marginPct),
    [data]
  )

  const totalImpact = valorLiquidar

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        icon={Zap}
        title="Decisiones de la Semana"
        subtitle="4 acciones concretas para optimizar el inventario esta semana"
      />

      {/* ── Summary banner ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-900 rounded-xl p-5 text-white"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
              Resumen ejecutivo
            </p>
            <p className="text-2xl font-bold">
              {formatCurrency(totalImpact, { compact: true })}{" "}
              <span className="text-sm font-normal text-white/50">en inventario en riesgo</span>
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">{liquidar.length}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">Liquidar</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-400">{transferir.length}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">Transferir</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-400">{reponer.length}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">Reponer</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">{comprar.length}</p>
              <p className="text-[10px] text-white/40 uppercase tracking-wide">Comprar</p>
            </div>
          </div>
          <button
            onClick={() => exportCSV(liquidar, transferir, reponer, data.revenueByCategory)}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold text-white/80 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </button>
        </div>
      </motion.div>

      {/* ── 4 buckets ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* LIQUIDAR */}
        <BucketCard
          type="LIQUIDAR"
          count={liquidar.length}
          metrica={`${formatCurrency(valorLiquidar, { compact: true })} en costo`}
          delay={0.1}
          empty={liquidar.length === 0}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-[10px] font-semibold text-slate-400 uppercase">Descripción</th>
                <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase px-2">Suc</th>
                <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase px-2">Días</th>
                <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {liquidar.slice(0, 8).map((r) => (
                <tr key={`${r.codigo}-${r.sucursal_key}`} className="hover:bg-slate-50/60">
                  <td className="py-2 pr-2">
                    <p className="font-medium text-slate-800 truncate max-w-[160px]">{r.descripcion ?? "—"}</p>
                    <p className="text-[10px] text-slate-400">{r.sku_padre}</p>
                  </td>
                  <td className="py-2 text-right px-2">
                    <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">{r.sucursal_key}</span>
                  </td>
                  <td className="py-2 text-right px-2 font-bold text-red-600 tabular-nums">{r.dias_sin_venta ?? "—"}</td>
                  <td className="py-2 text-right font-semibold text-slate-700 tabular-nums">
                    {r.valor_inv_costo != null ? formatCurrency(r.valor_inv_costo, { compact: true }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {liquidar.length > 8 && (
            <p className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-100 mt-2">
              +{liquidar.length - 8} más · ver Inventario → filtro ROJA
            </p>
          )}
        </BucketCard>

        {/* TRANSFERIR */}
        <BucketCard
          type="TRANSFERIR"
          count={transferir.length}
          metrica={transferir.length > 0 ? `${transferir.reduce((s, t) => s + t.unidades_a_transferir, 0)} unidades a mover` : "Sin candidatos esta semana"}
          delay={0.15}
          empty={transferir.length === 0}
        >
          {transferir.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">No hay pares DONANTE–RECEPTORA</p>
              <p className="text-[11px] text-slate-300 mt-1">El stock está distribuido uniformemente</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-[10px] font-semibold text-slate-400 uppercase">SKU</th>
                  <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase px-2">De</th>
                  <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase px-2">A</th>
                  <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase">Mover</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transferir.slice(0, 8).map((t, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-slate-800 truncate max-w-[140px]">{t.descripcion ?? "—"}</p>
                      <p className="text-[10px] text-slate-400">{t.sku_padre}</p>
                    </td>
                    <td className="py-2 text-right px-2">
                      <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">{t.donante_key}</span>
                    </td>
                    <td className="py-2 text-right px-2">
                      <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">{t.receptora_key}</span>
                    </td>
                    <td className="py-2 text-right font-bold text-blue-600 tabular-nums">{t.unidades_a_transferir} uds</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </BucketCard>

        {/* REPONER */}
        <BucketCard
          type="REPONER"
          count={reponer.length}
          metrica={reponer.length > 0 ? `${reponer.filter(r => (r.inv_fin_unidades ?? 0) / (r.velocidad_semanal ?? 1) < 1).length} con stock < 1 semana` : "Sin alertas de reposición"}
          delay={0.2}
          empty={reponer.length === 0}
        >
          {reponer.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-400">Sin SKUs en zona crítica</p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 text-[10px] font-semibold text-slate-400 uppercase">Descripción</th>
                  <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase px-2">Suc</th>
                  <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase px-2">Stock</th>
                  <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase">Sem.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reponer.slice(0, 8).map((r) => {
                  const vel = r.velocidad_semanal ?? 0
                  const wl = vel > 0 ? (r.inv_fin_unidades ?? 0) / vel : null
                  return (
                    <tr key={`${r.codigo}-${r.sucursal_key}`} className="hover:bg-slate-50/60">
                      <td className="py-2 pr-2">
                        <p className="font-medium text-slate-800 truncate max-w-[160px]">{r.descripcion ?? "—"}</p>
                        <p className="text-[10px] text-slate-400">{r.sku_padre}</p>
                      </td>
                      <td className="py-2 text-right px-2">
                        <span className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-medium">{r.sucursal_key}</span>
                      </td>
                      <td className="py-2 text-right px-2 font-semibold text-slate-700 tabular-nums">{r.inv_fin_unidades ?? "—"}</td>
                      <td className="py-2 text-right">
                        {wl != null ? (
                          <span className={`font-bold tabular-nums ${wl < 1 ? "text-red-600" : "text-orange-500"}`}>
                            {wl.toFixed(1)}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </BucketCard>

        {/* COMPRAR */}
        <BucketCard
          type="COMPRAR"
          count={comprar.length}
          metrica={`${formatCurrency(comprar.reduce((s, c) => s + c.revenue, 0), { compact: true })} en ingresos`}
          delay={0.25}
          empty={comprar.length === 0}
        >
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 text-[10px] font-semibold text-slate-400 uppercase">Categoría</th>
                <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase px-2">Margen</th>
                <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase px-2">Ingresos</th>
                <th className="text-right py-2 text-[10px] font-semibold text-slate-400 uppercase">Uds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {comprar.slice(0, 8).map((c) => (
                <tr key={c.categoria} className="hover:bg-slate-50/60">
                  <td className="py-2 pr-2 font-medium text-slate-800">{c.categoria}</td>
                  <td className="py-2 text-right px-2">
                    <span className="font-bold text-emerald-600 tabular-nums">{formatPercentAbs(c.marginPct)}</span>
                  </td>
                  <td className="py-2 text-right px-2 font-semibold text-slate-700 tabular-nums">
                    {formatCurrency(c.revenue, { compact: true })}
                  </td>
                  <td className="py-2 text-right text-slate-500 tabular-nums">{formatNumber(c.units)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </BucketCard>

      </div>
    </div>
  )
}

// ── BucketCard ────────────────────────────────────────────────────────────────

interface BucketCardProps {
  type: keyof typeof BUCKET_CONFIG
  count: number
  metrica: string
  delay: number
  empty: boolean
  children: React.ReactNode
}

function BucketCard({ type, count, metrica, delay, empty, children }: BucketCardProps) {
  const cfg = BUCKET_CONFIG[type]
  const Icon = cfg.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`bg-white rounded-xl card-shadow overflow-hidden border ${cfg.border}`}
    >
      {/* Header */}
      <div className={`px-5 py-4 ${cfg.bg} border-b ${cfg.border}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-widest ${cfg.color} opacity-70`}>{type}</p>
              <p className={`text-xl font-bold ${cfg.color} leading-none mt-0.5`}>
                {count}
                <span className={`text-xs font-normal ml-1.5 opacity-60 ${cfg.color}`}>
                  {type === "LIQUIDAR" ? "SKUs" : type === "TRANSFERIR" ? "pares" : type === "REPONER" ? "SKUs" : "categorías"}
                </span>
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-[11px] font-semibold ${cfg.color} opacity-80`}>{metrica}</p>
            <p className={`text-[10px] mt-0.5 opacity-55 ${cfg.color}`}>{cfg.accion}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4">{children}</div>
    </motion.div>
  )
}
