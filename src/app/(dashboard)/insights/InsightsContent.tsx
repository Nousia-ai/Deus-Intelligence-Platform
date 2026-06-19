"use client"

import { Fragment, useState, useMemo, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Search,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  Lightbulb,
} from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { cn } from "@/lib/utils"
import type { SellThroughRow } from "@/lib/types"

// ── Constants ─────────────────────────────────────────────────────────────────

const BRANCHES = [
  { key: "16S",  label: "16 Sep" },
  { key: "atlx", label: "Atlixco" },
  { key: "cs",   label: "C. Sur" },
  { key: "chol", label: "Cholula" },
  { key: "czsr", label: "Cruz del Sur" },
  { key: "sd",   label: "San Diego" },
] as const

type BranchKey = (typeof BRANCHES)[number]["key"]
type SortKey = "global" | BranchKey

const PAGE_SIZE = 50

const BRANCH_FULL: Record<string, string> = {
  "16S":  "16 de Septiembre",
  atlx:   "Atlixco",
  cs:     "Centro Sur",
  chol:   "Cholula",
  czsr:   "Cruz del Sur",
  sd:     "San Diego",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stColorClass(st: number): string {
  const pct = Math.min(st * 100, 100)
  if (pct >= 80) return "bg-emerald-50 text-emerald-700 font-semibold"
  if (pct >= 60) return "bg-indigo-50 text-indigo-700"
  if (pct >= 40) return "bg-amber-50 text-amber-600"
  if (pct >= 20) return "bg-orange-50 text-orange-600"
  return "bg-red-50 text-red-600"
}

function stFmt(st: number): string {
  return (Math.min(st, 1) * 100).toFixed(0) + "%"
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MatrixSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-8 w-72 bg-slate-100 rounded animate-pulse" />
      <div className="flex gap-3">
        <div className="h-9 w-64 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-9 w-36 bg-slate-100 rounded-lg animate-pulse" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="h-10 bg-slate-50 border-b border-slate-100" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-10 border-b border-slate-50 flex items-center px-4 gap-4">
            <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-16 bg-slate-100 rounded animate-pulse" />
            {[...Array(7)].map((_, j) => (
              <div key={j} className="h-5 w-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function InsightsContent() {
  const [rows, setRows] = useState<SellThroughRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/insights/sell-through")
      .then((r) => {
        if (!r.ok) throw new Error(`Error ${r.status}`)
        return r.json() as Promise<SellThroughRow[]>
      })
      .then((data) => {
        setRows(data)
        setLoading(false)
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  const [search, setSearch] = useState("")
  const [marcaFilter, setMarcaFilter] = useState("__all__")
  const [tipoFilter, setTipoFilter] = useState("__all__")
  const [sortKey, setSortKey] = useState<SortKey>("global")
  const [sortAsc, setSortAsc] = useState(false)
  const [page, setPage] = useState(1)
  const [expandedSku, setExpandedSku] = useState<string | null>(null)

  // ── Filter options ───────────────────────────────────────────────────────────
  const marcas = useMemo(
    () =>
      Array.from(new Set(rows.map((r) => r.marca ?? "").filter(Boolean))).sort(),
    [rows]
  )
  const tipos = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.tipo_producto ?? "").filter(Boolean))
      ).sort(),
    [rows]
  )

  // ── Filtered + sorted rows ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (
        q &&
        !r.sku_padre.toLowerCase().includes(q) &&
        !(r.descripcion ?? "").toLowerCase().includes(q) &&
        !(r.marca ?? "").toLowerCase().includes(q)
      )
        return false
      if (marcaFilter !== "__all__" && r.marca !== marcaFilter) return false
      if (tipoFilter !== "__all__" && r.tipo_producto !== tipoFilter) return false
      return true
    })
  }, [rows, search, marcaFilter, tipoFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const stA =
        sortKey === "global"
          ? a.avg_sell_through
          : (a.by_sucursal.find((s) => s.sucursal_key === sortKey)
              ?.sell_through ?? -1)
      const stB =
        sortKey === "global"
          ? b.avg_sell_through
          : (b.by_sucursal.find((s) => s.sucursal_key === sortKey)
              ?.sell_through ?? -1)
      return sortAsc ? stA - stB : stB - stA
    })
  }, [filtered, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) setSortAsc((v) => !v)
      else {
        setSortKey(key)
        setSortAsc(false)
      }
      setPage(1)
    },
    [sortKey]
  )

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleMarca  = (v: string) => { setMarcaFilter(v); setPage(1) }
  const handleTipo   = (v: string) => { setTipoFilter(v); setPage(1) }

  // ── Summary stats ────────────────────────────────────────────────────────────
  const totalSKUs = rows.length
  const avgGlobal =
    totalSKUs > 0
      ? rows.reduce((s, r) => s + r.avg_sell_through, 0) / totalSKUs
      : 0
  const skusExcelente = rows.filter((r) => r.avg_sell_through >= 0.8).length
  const skusCritico   = rows.filter((r) => r.avg_sell_through < 0.2).length

  return (
    <div className="space-y-6">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        icon={Lightbulb}
        title="Insights"
        subtitle="Análisis de sell-through, distribución y performance por artículo"
      />

      {/* ── Section title ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-full bg-indigo-500 flex-shrink-0" />
        <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">
          ¿Qué se está vendiendo y dónde se está vendiendo?
        </h2>
      </div>

      {/* ── Loading / error states ───────────────────────────────────────────── */}
      {loading && <MatrixSkeleton />}

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          Error al cargar datos: {error}
        </div>
      )}

      {/* ── Content (shown when loaded) ──────────────────────────────────────── */}
      {!loading && !error && (
        <>
          {/* KPI summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "SKUs analizados",
                value: totalSKUs.toLocaleString("es-MX"),
                sub: "con inventario inicial",
                color: "text-slate-900",
              },
              {
                label: "ST promedio global",
                value: (avgGlobal * 100).toFixed(1) + "%",
                sub: "benchmark ≥80% excelente",
                color:
                  avgGlobal >= 0.8
                    ? "text-emerald-600"
                    : avgGlobal >= 0.5
                      ? "text-indigo-600"
                      : "text-amber-600",
              },
              {
                label: "ST ≥ 80% · excelente",
                value: skusExcelente.toLocaleString("es-MX"),
                sub:
                  totalSKUs > 0
                    ? ((skusExcelente / totalSKUs) * 100).toFixed(0) + "% del catálogo"
                    : "—",
                color: "text-emerald-600",
              },
              {
                label: "ST < 20% · crítico",
                value: skusCritico.toLocaleString("es-MX"),
                sub:
                  totalSKUs > 0
                    ? ((skusCritico / totalSKUs) * 100).toFixed(0) + "% requiere atención"
                    : "—",
                color: "text-red-600",
              },
            ].map((card) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="bg-white rounded-xl border border-slate-200 px-4 py-3"
              >
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.07em]">
                  {card.label}
                </p>
                <p className={cn("text-2xl font-bold mt-1", card.color)}>
                  {card.value}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{card.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 flex-wrap text-[11px]">
            <span className="text-slate-400 font-medium flex-shrink-0">Sell-through:</span>
            {[
              { label: "≥80% excelente",   cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
              { label: "60–79% bueno",      cls: "bg-indigo-50 text-indigo-700 border-indigo-100" },
              { label: "40–59% regular",    cls: "bg-amber-50 text-amber-600 border-amber-100" },
              { label: "20–39% bajo",       cls: "bg-orange-50 text-orange-600 border-orange-100" },
              { label: "<20% crítico",      cls: "bg-red-50 text-red-600 border-red-100" },
            ].map((l) => (
              <span key={l.label} className={cn("px-2 py-0.5 rounded-full font-medium border", l.cls)}>
                {l.label}
              </span>
            ))}
            <span className="text-slate-400 hidden sm:inline ml-1">
              — = sin stock en esa sucursal
            </span>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar SKU, descripción o marca…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 placeholder:text-slate-400"
              />
            </div>
            <select
              value={marcaFilter}
              onChange={(e) => handleMarca(e.target.value)}
              className="px-3 py-1.5 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer text-slate-700"
            >
              <option value="__all__">Todas las marcas</option>
              {marcas.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={tipoFilter}
              onChange={(e) => handleTipo(e.target.value)}
              className="px-3 py-1.5 text-[13px] border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer text-slate-700"
            >
              <option value="__all__">Todos los tipos</option>
              {tipos.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="ml-auto text-[12px] text-slate-400">
              {filtered.length.toLocaleString("es-MX")} SKUs
            </span>
          </div>

          {/* Matrix table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.07em] w-24 sticky left-0 bg-slate-50/70 z-10">
                      SKU padre
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.07em] min-w-[180px]">
                      Descripción
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.07em] w-24">
                      Marca
                    </th>
                    <SortHeader label="Global"      colKey="global" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                    {BRANCHES.map((b) => (
                      <SortHeader key={b.key} label={b.label} colKey={b.key} sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((row, idx) => {
                    const stByBranch: Partial<Record<BranchKey, number>> = {}
                    for (const b of row.by_sucursal) {
                      stByBranch[b.sucursal_key as BranchKey] = b.sell_through
                    }
                    const isExpanded = expandedSku === row.sku_padre

                    return (
                      <Fragment key={row.sku_padre}>
                        <motion.tr
                          initial={{ opacity: 0, y: 3 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.006, 0.15), duration: 0.2 }}
                          className={cn(
                            "transition-colors cursor-pointer",
                            isExpanded ? "bg-slate-50" : "hover:bg-slate-50/60"
                          )}
                          onClick={() => setExpandedSku(isExpanded ? null : row.sku_padre)}
                        >
                          <td className="px-4 py-2.5 sticky left-0 bg-inherit z-10">
                            <span className="font-mono text-[12px] font-semibold text-slate-800">
                              {row.sku_padre}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 max-w-[220px]">
                            <span className="text-[12px] text-slate-600 truncate block" title={row.descripcion ?? ""}>
                              {row.descripcion ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {row.marca && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 whitespace-nowrap">
                                {row.marca}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <STCell value={row.avg_sell_through} />
                          </td>
                          {BRANCHES.map((b) => (
                            <td key={b.key} className="px-3 py-2.5 text-center">
                              {stByBranch[b.key] !== undefined ? (
                                <STCell value={stByBranch[b.key] as number} />
                              ) : (
                                <span className="text-slate-200 text-xs select-none">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-2 py-2.5 text-slate-300">
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5" />
                              : <ChevronRight className="w-3.5 h-3.5" />
                            }
                          </td>
                        </motion.tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={BRANCHES.length + 5} className="px-4 py-3 border-b border-slate-100">
                              <SkuDetail row={row} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}

                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={BRANCHES.length + 5} className="px-4 py-10 text-center text-[13px] text-slate-400">
                        No se encontraron SKUs con los filtros aplicados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/40">
                <span className="text-[11px] text-slate-400">
                  Mostrando{" "}
                  <span className="font-medium text-slate-600">
                    {((page - 1) * PAGE_SIZE + 1).toLocaleString("es-MX")}–
                    {Math.min(page * PAGE_SIZE, sorted.length).toLocaleString("es-MX")}
                  </span>{" "}
                  de {sorted.length.toLocaleString("es-MX")} SKUs
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="px-3 py-1 text-[12px] border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Anterior
                  </button>
                  <span className="text-[12px] text-slate-500 w-16 text-center">
                    {page} / {totalPages}
                  </span>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1 text-[12px] border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    Siguiente →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function STCell({ value }: { value: number }) {
  return (
    <span className={cn(
      "inline-flex items-center justify-center min-w-[2.8rem] px-1.5 py-0.5 rounded text-[11px] tabular-nums",
      stColorClass(value)
    )}>
      {stFmt(value)}
    </span>
  )
}

interface SortHeaderProps {
  label: string
  colKey: SortKey
  sortKey: SortKey
  sortAsc: boolean
  onToggle: (key: SortKey) => void
}

function SortHeader({ label, colKey, sortKey, sortAsc, onToggle }: SortHeaderProps) {
  const isActive = sortKey === colKey
  return (
    <th
      className={cn(
        "text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] w-24 cursor-pointer select-none group transition-colors",
        isActive ? "text-indigo-600" : "text-slate-500 hover:text-slate-700"
      )}
      onClick={() => onToggle(colKey)}
    >
      <span className="inline-flex items-center justify-center gap-1">
        {label}
        {isActive
          ? <span className="text-indigo-400">{sortAsc ? "↑" : "↓"}</span>
          : <ArrowUpDown className="w-2.5 h-2.5 opacity-30 group-hover:opacity-60" />
        }
      </span>
    </th>
  )
}

function SkuDetail({ row }: { row: SellThroughRow }) {
  const branchRows = row.by_sucursal
    .filter((b) => BRANCH_FULL[b.sucursal_key])
    .sort((a, b) => b.sell_through - a.sell_through)

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
        Detalle por sucursal — {row.sku_padre}
        {row.descripcion ? ` · ${row.descripcion}` : ""}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {branchRows.map((b) => (
          <div key={b.sucursal_key} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-[10px] font-medium text-slate-500 truncate">
              {BRANCH_FULL[b.sucursal_key] ?? b.sucursal_key}
            </p>
            <p className={cn(
              "text-lg font-bold mt-0.5",
              b.sell_through >= 0.8 ? "text-emerald-600"
                : b.sell_through >= 0.6 ? "text-indigo-600"
                : b.sell_through >= 0.4 ? "text-amber-600"
                : b.sell_through >= 0.2 ? "text-orange-600"
                : "text-red-600"
            )}>
              {stFmt(b.sell_through)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {b.unidades_vendidas} vend. / {b.inv_fin_unidades} stock
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
