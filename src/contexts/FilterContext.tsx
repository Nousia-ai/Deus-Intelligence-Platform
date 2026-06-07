"use client"

import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from "react"
import type { DashboardSummary, FilterState, MonthlyRevenue, SKUMetrics } from "@/lib/types"
import { MONTH_LABELS_ES, DAY_LABELS_ES, calcChange } from "@/lib/utils"

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
  filteredGrossMargin: number
  filteredMonthlyRevenue: MonthlyRevenue[]
  filteredBranchRevenue: { id: string; nombre: string; revenue: number; revenueShare: number }[]
  filteredCategoryRevenue: { categoria: string; revenue: number; revenueShare: number }[]
  prevYearRevenue: number
  yoyChange: number | null
  // Filtered discount KPIs (1–4)
  filteredDiscountKPIs: DiscountKPIs
  // Filtered chart data
  filteredTopBrands: { marca: string; revenue: number; units: number; share: number }[]
  filteredPaymentMethods: { method: string; count: number; revenue: number; share: number }[]
  filteredGenderSplit: { genero: string; revenue: number; units: number; share: number }[]
  filteredDayOfWeek: { dia: number; label: string; revenue: number; units: number }[]
  filteredPriceRanges: { rango: string; count: number; revenue: number; share: number }[]
  // Filtered branch-level metrics (margin, gross margin, discount, units)
  filteredBranchMetrics: Record<string, { marginPct: number; grossMargin: number; discountRate: number; units: number }>
  // Filtered ATV/UPT (via exact ticket dedup matrix)
  filteredTicketCount: number
  filteredATV: number
  filteredUPT: number
  // Filtered discount rate per category  { categoria → discountRate % }
  filteredCategoryDiscount: Record<string, number>
  // Filtered SKU performance (physical branches, top-200 SKUs)
  filteredTopSKUs: SKUMetrics[]
  filteredConcentration: { top3: number; top10: number; top20: number }
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

    // ── Filtered margin (physical scope, excludes bundles + null cost) ────────
    let filtGrossMarginNum = 0, filtGrossMarginDen = 0
    for (const branchId of activeBranches) {
      const bm = data.branchMonthMarginMatrix[branchId] || {}
      for (const [key, val] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        filtGrossMarginNum += val.grossMargin
        filtGrossMarginDen += val.importe_neto
      }
    }
    const filteredMarginPct = filtGrossMarginDen > 0 ? (filtGrossMarginNum / filtGrossMarginDen) * 100 : 0
    const filteredGrossMargin = filtGrossMarginNum

    // ── Filtered top brands ───────────────────────────────────────────────────
    const brandRevMap: Record<string, { revenue: number; units: number }> = {}
    for (const branchId of activeBranches) {
      const bm = data.branchMonthBrandMatrix[branchId] || {}
      for (const [key, brandMap] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [marca, vals] of Object.entries(brandMap)) {
          if (!brandRevMap[marca]) brandRevMap[marca] = { revenue: 0, units: 0 }
          brandRevMap[marca].revenue += vals.revenue
          brandRevMap[marca].units += vals.units
        }
      }
    }
    const brandTotal = Object.values(brandRevMap).reduce((s, v) => s + v.revenue, 0)
    const filteredTopBrands = Object.entries(brandRevMap)
      .map(([marca, m]) => ({ marca, ...m, share: brandTotal > 0 ? (m.revenue / brandTotal) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)

    // ── Filtered payment methods ──────────────────────────────────────────────
    const payRevMap: Record<string, { count: number; revenue: number }> = {}
    for (const branchId of activeBranches) {
      const bm = data.branchMonthPaymentMatrix[branchId] || {}
      for (const [key, payMap] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [method, vals] of Object.entries(payMap)) {
          if (!payRevMap[method]) payRevMap[method] = { count: 0, revenue: 0 }
          payRevMap[method].count += vals.count
          payRevMap[method].revenue += vals.revenue
        }
      }
    }
    const totalPayCount = Object.values(payRevMap).reduce((s, v) => s + v.count, 0)
    const filteredPaymentMethods = Object.entries(payRevMap)
      .map(([method, m]) => ({ method, ...m, share: totalPayCount > 0 ? (m.count / totalPayCount) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)

    // ── Filtered gender split ─────────────────────────────────────────────────
    const genRevMap: Record<string, { revenue: number; units: number }> = {}
    for (const branchId of activeBranches) {
      const bm = data.branchMonthGenderMatrix[branchId] || {}
      for (const [key, genMap] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [genero, vals] of Object.entries(genMap)) {
          if (!genRevMap[genero]) genRevMap[genero] = { revenue: 0, units: 0 }
          genRevMap[genero].revenue += vals.revenue
          genRevMap[genero].units += vals.units
        }
      }
    }
    const genTotal = Object.values(genRevMap).reduce((s, v) => s + v.revenue, 0)
    const filteredGenderSplit = Object.entries(genRevMap)
      .map(([genero, m]) => ({ genero, ...m, share: genTotal > 0 ? (m.revenue / genTotal) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue)

    // ── Filtered day of week ──────────────────────────────────────────────────
    const dowRevMap: Record<string, { revenue: number; units: number }> = {}
    for (const branchId of activeBranches) {
      const bm = data.branchMonthDayOfWeekMatrix[branchId] || {}
      for (const [key, dowMap] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [dayKey, vals] of Object.entries(dowMap)) {
          if (!dowRevMap[dayKey]) dowRevMap[dayKey] = { revenue: 0, units: 0 }
          dowRevMap[dayKey].revenue += vals.revenue
          dowRevMap[dayKey].units += vals.units
        }
      }
    }
    const filteredDayOfWeek = Object.entries(dowRevMap)
      .map(([d, m]) => ({ dia: parseInt(d), label: DAY_LABELS_ES[parseInt(d)] || `Día ${d}`, ...m }))
      .sort((a, b) => a.dia - b.dia)

    // ── Filtered price ranges ─────────────────────────────────────────────────
    const priceRevMap: Record<string, { count: number; revenue: number }> = {}
    for (const branchId of activeBranches) {
      const bm = data.branchMonthPriceRangeMatrix[branchId] || {}
      for (const [key, rangoMap] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [rango, vals] of Object.entries(rangoMap)) {
          if (!priceRevMap[rango]) priceRevMap[rango] = { count: 0, revenue: 0 }
          priceRevMap[rango].count += vals.count
          priceRevMap[rango].revenue += vals.revenue
        }
      }
    }
    const totalPriceCount = Object.values(priceRevMap).reduce((s, v) => s + v.count, 0)
    const filteredPriceRanges = Object.entries(priceRevMap)
      .map(([rango, m]) => ({ rango, ...m, share: totalPriceCount > 0 ? (m.count / totalPriceCount) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue)

    // ── Filtered branch metrics (margin, grossMargin, discount, units) ───────
    const branchMetricsMap: Record<string, { marginPct: number; grossMargin: number; discountRate: number; units: number }> = {}
    for (const b of data.availableBranches) {
      const bid = b.id
      const staticB = data.revenueByBranch.find((x) => x.sucursal_id === bid)
      let gm = 0, imn = 0
      for (const [key, val] of Object.entries(data.branchMonthMarginMatrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        gm += val.grossMargin
        imn += val.importe_neto
      }
      let unidConDesc = 0, totUnid = 0
      for (const [key, val] of Object.entries(data.discountMonthMatrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        unidConDesc += val.unidConDesc
        totUnid += val.totUnid
      }
      let units = 0
      for (const [key, val] of Object.entries(data.branchMonthUnitsMatrix[bid] || {})) {
        const [y, m] = key.split("-").map(Number)
        if (!activeYears.includes(y)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(m)) continue
        units += val
      }
      branchMetricsMap[bid] = {
        marginPct: imn > 0 ? (gm / imn) * 100 : (staticB?.marginPct ?? 0),
        grossMargin: gm,
        discountRate: totUnid > 0 ? (unidConDesc / totUnid) * 100 : (staticB?.discountRate ?? 0),
        units: units || (staticB?.units ?? 0),
      }
    }
    const filteredBranchMetrics = branchMetricsMap

    // ── Filtered ticket count → ATV / UPT ────────────────────────────────────
    let filteredTicketCount = 0
    for (const branchId of activeBranches) {
      const bm = data.branchMonthTicketCountMatrix[branchId] || {}
      for (const [key, count] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        filteredTicketCount += count
      }
    }
    const filteredATV = filteredTicketCount > 0 ? filteredRevenue / filteredTicketCount : data.ceoKPIs.atv
    const filteredUPT = filteredTicketCount > 0 ? filteredUnits / filteredTicketCount : data.ceoKPIs.upt

    // ── Filtered category discount rates ─────────────────────────────────────
    const catDiscMap: Record<string, { unidConDesc: number; totUnid: number }> = {}
    for (const branchId of activeBranches) {
      const bm = data.branchMonthCategoryDiscountMatrix[branchId] || {}
      for (const [key, catMap] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [cat, val] of Object.entries(catMap)) {
          if (!catDiscMap[cat]) catDiscMap[cat] = { unidConDesc: 0, totUnid: 0 }
          catDiscMap[cat].unidConDesc += val.unidConDesc
          catDiscMap[cat].totUnid += val.totUnid
        }
      }
    }
    const filteredCategoryDiscount: Record<string, number> = {}
    for (const [cat, val] of Object.entries(catDiscMap)) {
      filteredCategoryDiscount[cat] = val.totUnid > 0 ? (val.unidConDesc / val.totUnid) * 100 : 0
    }

    // ── Filtered SKU metrics (top-200 SKUs, physical branches) ──────────────
    const skuAccMap: Record<string, { revenue: number; units: number; unidConDesc: number; totUnid: number; grossMargin: number; importe_neto_mar: number }> = {}
    for (const branchId of activeBranches) {
      const bm = data.branchMonthSKUMatrix[branchId] || {}
      for (const [key, skuMap] of Object.entries(bm)) {
        const [year, month] = key.split("-").map(Number)
        if (!activeYears.includes(year)) continue
        if (activeMonths.length > 0 && !activeMonths.includes(month)) continue
        for (const [sku, vals] of Object.entries(skuMap)) {
          if (!skuAccMap[sku]) skuAccMap[sku] = { revenue: 0, units: 0, unidConDesc: 0, totUnid: 0, grossMargin: 0, importe_neto_mar: 0 }
          skuAccMap[sku].revenue += vals.revenue
          skuAccMap[sku].units += vals.units
          skuAccMap[sku].unidConDesc += vals.unidConDesc
          skuAccMap[sku].totUnid += vals.totUnid
          skuAccMap[sku].grossMargin += vals.grossMargin
          skuAccMap[sku].importe_neto_mar += vals.importe_neto_mar
        }
      }
    }
    const filteredSKUTotal = Object.values(skuAccMap).reduce((s, v) => s + v.revenue, 0)
    const allFilteredSKUs: SKUMetrics[] = Object.entries(skuAccMap)
      .map(([sku_padre, m]) => ({
        sku_padre,
        revenue: m.revenue,
        units: m.units,
        grossMargin: m.grossMargin,
        marginPct: m.importe_neto_mar > 0 ? (m.grossMargin / m.importe_neto_mar) * 100 : 0,
        discountPct: m.totUnid > 0 ? (m.unidConDesc / m.totUnid) * 100 : 0,
        revenueShare: filteredSKUTotal > 0 ? (m.revenue / filteredSKUTotal) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
    const filteredTopSKUs = allFilteredSKUs.slice(0, 25)
    const filteredConcentration = {
      top3: allFilteredSKUs.slice(0, 3).reduce((s, sk) => s + sk.revenueShare, 0),
      top10: allFilteredSKUs.slice(0, 10).reduce((s, sk) => s + sk.revenueShare, 0),
      top20: allFilteredSKUs.slice(0, 20).reduce((s, sk) => s + sk.revenueShare, 0),
    }

    return {
      filteredRevenue,
      filteredUnits,
      filteredMarginPct,
      filteredGrossMargin,
      filteredMonthlyRevenue,
      filteredBranchRevenue,
      filteredCategoryRevenue,
      prevYearRevenue,
      yoyChange,
      filteredDiscountKPIs,
      filteredTopBrands,
      filteredPaymentMethods,
      filteredGenderSplit,
      filteredDayOfWeek,
      filteredPriceRanges,
      filteredBranchMetrics,
      filteredTicketCount,
      filteredATV,
      filteredUPT,
      filteredCategoryDiscount,
      filteredTopSKUs,
      filteredConcentration,
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
