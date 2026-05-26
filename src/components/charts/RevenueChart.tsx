"use client"

import { motion } from "framer-motion"
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from "recharts"
import type { MonthlyRevenue } from "@/lib/types"
import { MONTH_LABELS_ES, formatCurrency } from "@/lib/utils"

interface RevenueChartProps {
  data: MonthlyRevenue[]
  years?: number[]
  onMonthClick?: (year: number, month: number) => void
}

const YEAR_COLORS: Record<number, string> = {
  2023: "#94A3B8",
  2024: "#818CF8",
  2025: "#4F46E5",
  2026: "#C7D2FE",
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; name: string; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-500">{p.name}</span>
          </div>
          <span className="font-bold text-slate-900">{formatCurrency(p.value, { compact: true })}</span>
        </div>
      ))}
    </div>
  )
}

export function RevenueAreaChart({ data, years = [2024, 2025], onMonthClick }: RevenueChartProps) {
  const filtered = data.filter((d) => years.includes(d.año))

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1
    const point: Record<string, string | number> = { label: MONTH_LABELS_ES[mes], mes }
    for (const year of years) {
      const found = filtered.find((d) => d.mes === mes && d.año === year)
      point[`${year}`] = found?.revenue || 0
    }
    return point
  })

  const handleClick = (chartData: Record<string, string | number>) => {
    if (!onMonthClick) return
    const mes = chartData.mes as number
    // Click fires for the most recent year shown
    const latestYear = Math.max(...years)
    onMonthClick(latestYear, mes)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={monthlyData}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          onClick={onMonthClick ? (d: any) => { if (d?.activePayload?.[0]) handleClick(d.activePayload[0].payload) } : undefined}
          style={onMonthClick ? { cursor: "pointer" } : undefined}
        >
          <defs>
            {years.map((year) => (
              <linearGradient key={year} id={`gradient-${year}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={YEAR_COLORS[year]} stopOpacity={0.15} />
                <stop offset="95%" stopColor={YEAR_COLORS[year]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" strokeWidth={1} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "var(--font-geist-sans)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94A3B8", fontFamily: "var(--font-geist-sans)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v, { compact: true })}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#E2E8F0", strokeWidth: 1 }} />
          {years.map((year) => (
            <Area
              key={year}
              type="monotone"
              dataKey={`${year}`}
              name={`${year}`}
              stroke={YEAR_COLORS[year]}
              strokeWidth={year === Math.max(...years) ? 2 : 1.5}
              fill={`url(#gradient-${year})`}
              dot={false}
              activeDot={{
                r: 5,
                fill: YEAR_COLORS[year],
                strokeWidth: 2,
                stroke: "#fff",
                style: onMonthClick ? { cursor: "pointer" } : {},
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

interface DayOfWeekChartProps {
  data: { dia: number; label: string; revenue: number }[]
}

export function DayOfWeekChart({ data }: DayOfWeekChartProps) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue))
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="w-full h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCurrency(v, { compact: true })} width={48} />
          <Tooltip
            formatter={(v) => [formatCurrency(Number(v)), "Ingresos"]}
            contentStyle={{ borderRadius: "10px", border: "1px solid #E2E8F0", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", fontSize: "12px" }}
          />
          <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.dia}
                fill={entry.revenue >= maxRevenue * 0.85 ? "#4F46E5" : entry.revenue >= maxRevenue * 0.7 ? "#818CF8" : "#E2E8F0"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
