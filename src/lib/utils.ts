import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(
  value: number,
  options: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals = 0 } = options

  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `$${(value / 1_000).toFixed(1)}K`
    }
    return `$${value.toFixed(decimals)}`
  }

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatNumber(
  value: number,
  options: { compact?: boolean; decimals?: number } = {}
): string {
  const { compact = false, decimals = 0 } = options

  if (compact) {
    if (Math.abs(value) >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`
    }
  }

  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`
}

export function formatPercentAbs(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function calcChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

export const MONTH_LABELS_ES: Record<number, string> = {
  1: "Ene", 2: "Feb", 3: "Mar", 4: "Abr",
  5: "May", 6: "Jun", 7: "Jul", 8: "Ago",
  9: "Sep", 10: "Oct", 11: "Nov", 12: "Dic",
}

export const MONTH_FULL_ES: Record<number, string> = {
  1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
  5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
  9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre",
}

export const DAY_LABELS_ES: Record<number, string> = {
  0: "Lunes", 1: "Martes", 2: "Miércoles", 3: "Jueves",
  4: "Viernes", 5: "Sábado", 6: "Domingo",
}

export const BRANCH_LABELS: Record<string, string> = {
  "16S001": "16 de Septiembre",
  "ATL001": "Atlixco",
  "CSU001": "Centro Sur",
  "CHO001": "Cholula",
  "CRZ001": "Cruz del Sur",
  "SND001": "San Diego",
  "TOL001": "En Línea",
  "COR001": "Mercado Libre",
  "MLI001": "ML Full",
  "CEDIS": "CEDIS",
}

export const BRANCH_SHORT: Record<string, string> = {
  "16S001": "16 Sep",
  "ATL001": "Atlixco",
  "CSU001": "C. Sur",
  "CHO001": "Cholula",
  "CRZ001": "Cruz Sur",
  "SND001": "San Diego",
  "MLI001": "ML Full",
}

export const CHART_COLORS = [
  "#4F46E5",
  "#7C3AED",
  "#0EA5E9",
  "#059669",
  "#D97706",
  "#DB2777",
  "#0891B2",
  "#65A30D",
  "#EA580C",
  "#9333EA",
]

export function getChangeColor(change: number): string {
  if (change > 0) return "text-emerald-600"
  if (change < 0) return "text-red-500"
  return "text-slate-400"
}

export function getChangeBg(change: number): string {
  if (change > 0) return "bg-emerald-50 text-emerald-700"
  if (change < 0) return "bg-red-50 text-red-600"
  return "bg-slate-100 text-slate-500"
}
