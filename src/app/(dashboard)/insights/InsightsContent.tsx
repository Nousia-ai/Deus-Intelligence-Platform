"use client"

import { Fragment, useState, useMemo, useCallback, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Search,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  ArrowRight,
  ArrowRightLeft,
  Download,
  FilterX,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { SellThroughRow } from "@/lib/types"
import { computeTransfersForRow } from "@/lib/transfers"

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
type SortKey = "vendidas" | "global" | BranchKey

const PAGE_SIZE = 50

const BRANCH_FULL: Record<string, string> = {
  "16S":  "16 de Septiembre",
  atlx:   "Atlixco",
  cs:     "Centro Sur",
  chol:   "Cholula",
  czsr:   "Cruz del Sur",
  sd:     "San Diego",
}

// ST segments (benchmarks fashion retail)
const SEGMENTS = [
  { key: "excelente", label: "≥80%",   name: "Excelente", min: 0.8, max: Infinity, chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  { key: "bueno",     label: "60–79%", name: "Bueno",     min: 0.6, max: 0.8,      chip: "bg-indigo-50 text-indigo-700 border-indigo-200",   dot: "bg-indigo-500" },
  { key: "regular",   label: "40–59%", name: "Regular",   min: 0.4, max: 0.6,      chip: "bg-amber-50 text-amber-700 border-amber-200",      dot: "bg-amber-400" },
  { key: "bajo",      label: "20–39%", name: "Bajo",      min: 0.2, max: 0.4,      chip: "bg-orange-50 text-orange-700 border-orange-200",   dot: "bg-orange-500" },
  { key: "critico",   label: "<20%",   name: "Crítico",   min: 0,   max: 0.2,      chip: "bg-red-50 text-red-700 border-red-200",            dot: "bg-red-500" },
] as const

type SegmentKey = (typeof SEGMENTS)[number]["key"]

const VOLUME_OPTIONS = [
  { value: 0,  label: "Cualquier volumen" },
  { value: 5,  label: "≥ 5 vendidas" },
  { value: 10, label: "≥ 10 vendidas" },
  { value: 25, label: "≥ 25 vendidas" },
  { value: 50, label: "≥ 50 vendidas" },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function stColorClass(st: number): string {
  const pct = Math.min(st * 100, 100)
  if (pct >= 80) return "bg-emerald-50 text-emerald-700 font-semibold"
  if (pct >= 60) return "bg-indigo-50 text-indigo-700"
  if (pct >= 40) return "bg-amber-50 text-amber-600"
  if (pct >= 20) return "bg-orange-50 text-orange-600"
  return "bg-red-50 text-red-600"
}

function stBarColor(st: number): string {
  const pct = Math.min(st * 100, 100)
  if (pct >= 80) return "bg-emerald-500"
  if (pct >= 60) return "bg-indigo-500"
  if (pct >= 40) return "bg-amber-400"
  if (pct >= 20) return "bg-orange-500"
  return "bg-red-500"
}

function stTextColor(st: number): string {
  const pct = Math.min(st * 100, 100)
  if (pct >= 80) return "text-emerald-600"
  if (pct >= 60) return "text-indigo-600"
  if (pct >= 40) return "text-amber-600"
  if (pct >= 20) return "text-orange-600"
  return "text-red-600"
}

function stFmt(st: number): string {
  return (Math.min(st, 1) * 100).toFixed(0) + "%"
}

function segmentOf(st: number): SegmentKey {
  if (st >= 0.8) return "excelente"
  if (st >= 0.6) return "bueno"
  if (st >= 0.4) return "regular"
  if (st >= 0.2) return "bajo"
  return "critico"
}

function exportCsv(rows: SellThroughRow[]) {
  const header = [
    "SKU Padre", "Descripción", "Marca", "Tipo", "Vendidas", "Stock", "ST Global",
    ...BRANCHES.map((b) => `ST ${BRANCH_FULL[b.key]}`),
  ]
  const lines = rows.map((r) => {
    const stMap: Record<string, number> = {}
    for (const b of r.by_sucursal) stMap[b.sucursal_key] = b.sell_through
    return [
      r.sku_padre,
      `"${(r.descripcion ?? "").replace(/"/g, '""')}"`,
      r.marca ?? "",
      r.tipo_producto ?? "",
      r.total_vendidas,
      Math.max(0, r.total_ini),
      (r.avg_sell_through * 100).toFixed(1) + "%",
      ...BRANCHES.map((b) =>
        stMap[b.key] !== undefined ? (stMap[b.key] * 100).toFixed(1) + "%" : ""
      ),
    ].join(",")
  })
  const csv = "﻿" + [header.join(","), ...lines].join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `sell-through-matriz-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
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
  const [minVol, setMinVol] = useState(0)
  const [segmentFilter, setSegmentFilter] = useState<SegmentKey | null>(null)
  const [sortKey, setSortKey] = useState<SortKey>("vendidas")
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

  // ── Filtering pipeline: search/marca/tipo/volumen → conteos por segmento → segmento ──
  const baseFiltered = useMemo(() => {
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
      if (r.total_vendidas < minVol) return false
      return true
    })
  }, [rows, search, marcaFilter, tipoFilter, minVol])

  const segmentCounts = useMemo(() => {
    const counts: Record<SegmentKey, number> = {
      excelente: 0, bueno: 0, regular: 0, bajo: 0, critico: 0,
    }
    for (const r of baseFiltered) counts[segmentOf(r.avg_sell_through)]++
    return counts
  }, [baseFiltered])

  const filtered = useMemo(() => {
    if (!segmentFilter) return baseFiltered
    return baseFiltered.filter((r) => segmentOf(r.avg_sell_through) === segmentFilter)
  }, [baseFiltered, segmentFilter])

  const sorted = useMemo(() => {
    const valueOf = (r: SellThroughRow): number =>
      sortKey === "vendidas"
        ? r.total_vendidas
        : sortKey === "global"
          ? r.avg_sell_through
          : (r.by_sucursal.find((s) => s.sucursal_key === sortKey)?.sell_through ?? -1)
    return [...filtered].sort((a, b) =>
      sortAsc ? valueOf(a) - valueOf(b) : valueOf(b) - valueOf(a)
    )
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

  const handleSearch  = (v: string) => { setSearch(v); setPage(1) }
  const handleMarca   = (v: string) => { setMarcaFilter(v); setPage(1) }
  const handleTipo    = (v: string) => { setTipoFilter(v); setPage(1) }
  const handleMinVol  = (v: number) => { setMinVol(v); setPage(1) }
  const handleSegment = (k: SegmentKey) => {
    setSegmentFilter((cur) => (cur === k ? null : k))
    setPage(1)
  }
  const clearFilters = () => {
    setSearch(""); setMarcaFilter("__all__"); setTipoFilter("__all__")
    setMinVol(0); setSegmentFilter(null); setPage(1)
  }

  const hasActiveFilters =
    search !== "" || marcaFilter !== "__all__" || tipoFilter !== "__all__" ||
    minVol > 0 || segmentFilter !== null

  // ── Summary stats (sobre todo el catálogo, no lo filtrado) ──────────────────
  const totalSKUs = rows.length
  const avgGlobal =
    totalSKUs > 0
      ? rows.reduce((s, r) => s + r.avg_sell_through, 0) / totalSKUs
      : 0
  const skusExcelente = rows.filter((r) => r.avg_sell_through >= 0.8).length
  const skusCritico   = rows.filter((r) => r.avg_sell_through < 0.2).length

  return (
    <div className="space-y-5">
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
                sub: "con movimiento de inventario",
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

          {/* Segment chips — leyenda interactiva que filtra al hacer clic */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium flex-shrink-0 mr-1">
              Sell-through:
            </span>
            {SEGMENTS.map((s) => {
              const active = segmentFilter === s.key
              return (
                <button
                  key={s.key}
                  onClick={() => handleSegment(s.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-150 cursor-pointer",
                    s.chip,
                    active
                      ? "ring-2 ring-offset-1 ring-indigo-300 shadow-sm"
                      : "opacity-80 hover:opacity-100 hover:shadow-sm"
                  )}
                  title={active ? "Quitar filtro" : `Ver solo SKUs con ST ${s.label}`}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", s.dot)} />
                  {s.label} {s.name}
                  <span className="font-bold tabular-nums">
                    {segmentCounts[s.key].toLocaleString("es-MX")}
                  </span>
                </button>
              )
            })}
            <span className="text-[11px] text-slate-400 hidden lg:inline ml-1">
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
            <select
              value={minVol}
              onChange={(e) => handleMinVol(Number(e.target.value))}
              className={cn(
                "px-3 py-1.5 text-[13px] border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer",
                minVol > 0
                  ? "border-indigo-300 text-indigo-700 font-medium"
                  : "border-slate-200 text-slate-700"
              )}
              title="Filtra SKUs con pocas unidades vendidas para reducir ruido"
            >
              {VOLUME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                title="Limpiar todos los filtros"
              >
                <FilterX className="w-3.5 h-3.5" />
                Limpiar
              </button>
            )}

            <div className="ml-auto flex items-center gap-3">
              <span className="text-[12px] text-slate-400">
                {sorted.length.toLocaleString("es-MX")} SKUs
              </span>
              <button
                onClick={() => exportCsv(sorted)}
                disabled={sorted.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Descargar la vista actual (con filtros aplicados) como CSV"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar
              </button>
            </div>
          </div>

          {/* Matrix table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-auto max-h-[66vh]">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.07em] w-24 sticky left-0 top-0 bg-slate-50 z-30">
                      SKU padre
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.07em] min-w-[180px] sticky top-0 bg-slate-50 z-20">
                      Descripción
                    </th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-[0.07em] w-24 sticky top-0 bg-slate-50 z-20">
                      Marca
                    </th>
                    <SortHeader label="Vendidas" colKey="vendidas" sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                    <SortHeader label="Global"   colKey="global"   sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                    {BRANCHES.map((b) => (
                      <SortHeader key={b.key} label={b.label} colKey={b.key} sortKey={sortKey} sortAsc={sortAsc} onToggle={toggleSort} />
                    ))}
                    <th className="w-8 sticky top-0 bg-slate-50 z-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginated.map((row, idx) => {
                    const branchData: Partial<Record<BranchKey, { st: number; vend: number; stock: number }>> = {}
                    for (const b of row.by_sucursal) {
                      branchData[b.sucursal_key as BranchKey] = {
                        st: b.sell_through,
                        vend: b.unidades_vendidas,
                        stock: Math.max(0, b.inv_fin_unidades),
                      }
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
                            isExpanded ? "bg-slate-50" : "bg-white hover:bg-slate-50/60"
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
                            <span className="text-[12px] font-semibold text-slate-700 tabular-nums">
                              {row.total_vendidas.toLocaleString("es-MX")}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <GlobalSTCell value={row.avg_sell_through} />
                          </td>
                          {BRANCHES.map((b) => {
                            const d = branchData[b.key]
                            return (
                              <td key={b.key} className="px-3 py-2.5 text-center">
                                {d !== undefined ? (
                                  <span title={`${BRANCH_FULL[b.key]}: ${d.vend} vend · ${d.stock} stock`}>
                                    <STCell value={d.st} />
                                  </span>
                                ) : (
                                  <span className="text-slate-200 text-xs select-none">—</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-2 py-2.5 text-slate-300">
                            {isExpanded
                              ? <ChevronDown className="w-3.5 h-3.5" />
                              : <ChevronRight className="w-3.5 h-3.5" />
                            }
                          </td>
                        </motion.tr>

                        {isExpanded && (
                          <tr className="bg-slate-50/80">
                            <td colSpan={BRANCHES.length + 6} className="px-4 py-3 border-b border-slate-100">
                              <SkuDetail row={row} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}

                  {paginated.length === 0 && (
                    <tr>
                      <td colSpan={BRANCHES.length + 6} className="px-4 py-12 text-center">
                        <p className="text-[13px] text-slate-400 mb-3">
                          No se encontraron SKUs con los filtros aplicados
                        </p>
                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <FilterX className="w-3.5 h-3.5" />
                            Limpiar filtros
                          </button>
                        )}
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

/** Celda Global: % + barra de progreso para escaneo visual rápido */
function GlobalSTCell({ value }: { value: number }) {
  const pct = Math.min(value * 100, 100)
  return (
    <div className="flex items-center gap-2 min-w-[5.5rem]">
      <span className={cn("text-[11px] font-semibold tabular-nums w-8 text-right", stTextColor(value))}>
        {stFmt(value)}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden min-w-[2.5rem]">
        <div
          className={cn("h-full rounded-full", stBarColor(value))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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
        "text-center px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.07em] w-24 cursor-pointer select-none group transition-colors sticky top-0 bg-slate-50 z-20",
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

  const totalStock = Math.max(0, row.total_ini)
  const transfers = useMemo(() => computeTransfersForRow(row), [row])

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          Detalle por sucursal — {row.sku_padre}
          {row.descripcion ? ` · ${row.descripcion}` : ""}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {/* Card de total global primero */}
          <div className="bg-slate-900 rounded-lg px-3 py-2">
            <p className="text-[10px] font-medium text-white/50 truncate">Total global</p>
            <p className={cn("text-lg font-bold mt-0.5 text-white")}>
              {stFmt(row.avg_sell_through)}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">
              {row.total_vendidas} vend. / {totalStock} stock
            </p>
          </div>

          {branchRows.map((b) => {
            const stock = Math.max(0, b.inv_fin_unidades)
            return (
              <div key={b.sucursal_key} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-medium text-slate-500 truncate">
                  {BRANCH_FULL[b.sucursal_key] ?? b.sucursal_key}
                </p>
                <p className={cn("text-lg font-bold mt-0.5", stTextColor(b.sell_through))}>
                  {stFmt(b.sell_through)}
                </p>
                <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-1 mb-1">
                  <div
                    className={cn("h-full rounded-full", stBarColor(b.sell_through))}
                    style={{ width: `${Math.min(b.sell_through * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  {b.unidades_vendidas} vend. / {stock} stock
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {transfers.length > 0 && (
        <div className="pt-3 border-t border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <ArrowRightLeft className="w-3 h-3 text-indigo-500" />
            Traspasos sugeridos
          </p>
          <div className="space-y-1.5">
            {transfers.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 bg-white rounded-lg border border-indigo-100 px-3 py-2 text-[12px] flex-wrap"
              >
                <span className="font-semibold text-slate-700 whitespace-nowrap">
                  {BRANCH_FULL[t.from_sucursal] ?? t.from_sucursal}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                <span className="font-semibold text-slate-700 whitespace-nowrap">
                  {BRANCH_FULL[t.to_sucursal] ?? t.to_sucursal}
                </span>
                <span className="font-bold text-indigo-600 tabular-nums whitespace-nowrap">
                  {t.quantity} {t.quantity === 1 ? "pieza" : "piezas"}
                </span>
                <span className="text-slate-400 tabular-nums whitespace-nowrap ml-auto">
                  {stFmt(t.from_sell_through)} → {stFmt(t.to_sell_through)}
                </span>
                {t.confidence === "baja" && (
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0 whitespace-nowrap"
                    title="Basado en pocas unidades observadas — tómalo como referencia, no como certeza"
                  >
                    muestra baja
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
