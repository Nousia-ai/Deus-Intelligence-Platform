"use client"

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react"
import type { DashboardSummary, FilterState, MonthlyRevenue } from "@/lib/types"
import { MONTH_LABELS_ES, calcChange } from "@/lib/utils"

interface DiscountKPIs {
  pctVentasConDescuento: number
  pctUnidadesConDescuento: number
  profundidadDescuento: number
  mixPrecioLista: number
}

interface FilterContextValue {
  filter: FilterState
  setFilter: (f: FilterState) => void
  toggleBranch: (id: string) => void
  toggleYear: (year: number) => void
  toggleMonth: (month: number) => void
  clearFilters: () => void
  isFiltered: boolean
  // Derived filtered data
  filteredRevenue: number
  filteredUnits: number
  filteredMarginPct: number
  filteredMonthlyRevenue: MonthlyRevenue[]
  filteredBranchRevenue: { id: string; nombre: string; revenue: number; revenueShare: number }[]
  filteredCategoryRevenue: { categoria: string; revenue: number; revenueShare: number }[]
  prevYearRevenue: number
  yoyChange: number | null
  // Filtered discount KPIs (1–4)
  filteredDiscountKPIs: DiscountKPIs
}

const FilterContext = createContext<FilterContextValue | null>(null)

interface FilterProviderProps {
  children: ReactNode
  data: DashboardSummary
}

export function FilterProvider({ children, data }: FilterProviderProps) {
  const [filter, setFilter] = useState<FilterState>({
    selectedBranches: [],
    selectedYears: [],
    selectedMonths: [],
  })

  const toggleBranch = useCallback((id: string) => {
    setFilter((prev) => ({
      ...prev,
      selectedBranches: prev.selectedBranches.includes(id)
        ? prev.selectedBranches.filter((b) => b !== id)
        : [...prev.selectedBranches, id],
    }))
  }, [])

  const toggleYear = useCallback((year: number) => {
    setFilter((prev) => ({
      ...prev,
      selectedYears: prev.selectedYears.includes(year)
        ? prev.selectedYears.filter((y) => y !== year)
        : [...prev.selectedYears, year],
    }))
  }, [])

  const toggleMonth = useCallback((month: number) => {
    setFilter((prev) => ({
      ...prev,
      selectedMonths: prev.selectedMonths.includes(month)
        ? prev.selectedMonths.filter((m) => m !== month)
        : [...prev.selectedMonths, month],
    }))
  }, [])

  const clearFilters = useCallback(() => {
    setFilter({ selectedBranches: [], selectedYears: [], selectedMonths: [] })
  }, [])

  const isFiltered =
    filter.selectedBranches.length > 0 ||
    filter.selectedYears.length > 0 ||
    filter.selectedMonths.length > 0

  // ── Computed filtered values ──────────────────────────────────────────────
  const derived = useMemo(() => {
    const activeBranches = filter.selectedBranches.length > 0
      ? filter.selectedBranches
      : data.availableBranches.map((b) => b.id)

    const activeYears = filter.selectedYears.length > 0
      ? filter.selectedYears
      : data.availableYears

    const activeMonths = filter.selectedMonths  // empty = all months

    // ── Filtered revenue via branch×month matrix ──
    let filteredRevenue = 0
    const monthRevMap: Record<string, number> = {}

    for (const branchId of activeBranches) {
      const bm = data.branchMonthMatrix[branchId] || {}
      for (const [key, rev] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        filteredRevenue += rev
        monthRevMap[key] = (monthRevMap[key] || 0) + rev
      }
    }

    // ── Filtered monthly revenue array ──
    const filteredMonthlyRevenue: MonthlyRevenue[] = Object.entries(monthRevMap)
      .map(([key, revenue]) => {
        const [año, mes] = key.split("-").map(Number)
        return {
          año, mes,
          label: `${MONTH_LABELS_ES[mes]} ${año}`,
          revenue, units: 0, transactions: 0, avgTicket: 0,
        }
      })
      .filter((m) => m.revenue > 0)
      .sort((a, b) => a.año * 100 + a.mes - (b.año * 100 + b.mes))

    // ── Filtered branch revenue ──
    const filteredBranchRevenue = data.availableBranches
      .map((b) => {
        const bm = data.branchMonthMatrix[b.id] || {}
        let rev = 0
        for (const [key, val] of Object.entries(bm)) {
          const [year, month] = key.split("-").map(Number)
          if (!activeYears.includes(year)) continue
          if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
          rev += val
        }
        return { id: b.id, nombre: b.nombre, revenue: rev, revenueShare: 0 }
      })
      .map((b) => ({ ...b, revenueShare: filteredRevenue > 0 ? (b.revenue / filteredRevenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue)

    // ── Filtered category revenue (exact via branch×month×category matrix) ──
    const catRevMap: Record<string, number> = {}
    for (const branchId of activeBranches) {
      const bmc = data.branchMonthCategoryMatrix[branchId] || {}
      for (const [key, catMap] of Object.entries(bmc)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [cat, rev] of Object.entries(catMap)) {
          catRevMap[cat] = (catRevMap[cat] || 0) + rev
        }
      }
    }
    const catTotal = Object.values(catRevMap).reduce((s, v) => s + v, 0)
    const filteredCategoryRevenue = Object.entries(catRevMap)
      .filter(([cat]) => cat !== "Bundle" && cat !== "Otro" && cat !== "Melon")
      .map(([categoria, revenue]) => ({
        categoria, revenue,
        revenueShare: catTotal > 0 ? (revenue / catTotal) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // ── YoY comparison via branchMonthMatrix (respects month filter) ──
    const sortedActiveYears = [...activeYears].sort()
    const lastYear = sortedActiveYears[sortedActiveYears.length - 1]
    const prevYearForComp = sortedActiveYears.length >= 2
      ? sortedActiveYears[sortedActiveYears.length - 2]
      : lastYear - 1

    let currYearRevenue = 0
    let prevYearRevenue = 0
    for (const branchId of activeBranches) {
      const bm = data.branchMonthMatrix[branchId] || {}
      for (const [key, rev] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        if (year === lastYear) currYearRevenue += rev
        if (year === prevYearForComp) prevYearRevenue += rev
      }
    }
    const yoyChange = prevYearRevenue > 0 ? calcChange(currYearRevenue, prevYearRevenue) : null

    // ── Filtered discount KPIs (1–4) via discountMonthMatrix ──
    let filtRevConDesc = 0, filtTotRev = 0, filtUnidConDesc = 0, filtTotUnid = 0, filtProfNum = 0
    for (const branchId of activeBranches) {
      const bm = data.discountMonthMatrix[branchId] || {}
      for (const [key, stats] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        filtRevConDesc += stats.revConDesc
        filtTotRev += stats.totRev
        filtUnidConDesc += stats.unidConDesc
        filtTotUnid += stats.totUnid
        filtProfNum += stats.profNum
      }
    }
    const filteredDiscountKPIs: DiscountKPIs = {
      pctVentasConDescuento: filtTotRev > 0 ? (filtRevConDesc / filtTotRev) * 100 : 0,
      pctUnidadesConDescuento: filtTotUnid > 0 ? (filtUnidConDesc / filtTotUnid) * 100 : 0,
      profundidadDescuento: filtRevConDesc > 0 ? filtProfNum / filtRevConDesc : 0,
      mixPrecioLista: filtTotRev > 0 ? ((filtTotRev - filtRevConDesc) / filtTotRev) * 100 : 0,
    }

    // ── Filtered units (exact via branch×month units matrix) ──
    let filteredUnits = 0
    for (const branchId of activeBranches) {
      const bmu = data.branchMonthUnitsMatrix[branchId] || {}
      for (const [key, units] of Object.entries(bmu)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        filteredUnits += units
      }
    }

    return {
      filteredRevenue,
      filteredUnits,
      filteredMarginPct: data.marginPct,
      filteredMonthlyRevenue,
      filteredBranchRevenue,
      filteredCategoryRevenue,
      prevYearRevenue,
      yoyChange,
      filteredDiscountKPIs,
    }
  }, [filter, data])

  return (
    <FilterContext.Provider value={{
      filter, setFilter, toggleBranch, toggleYear, toggleMonth, clearFilters, isFiltered,
      ...derived,
    }}>
      {children}
    </FilterContext.Provider>
  )
}

export function useFilter() {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error("useFilter must be used within FilterProvider")
  return ctx
}
