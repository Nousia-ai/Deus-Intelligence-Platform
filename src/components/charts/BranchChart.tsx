"use client"

import { motion } from "framer-motion"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts"
import type { BranchMetrics } from "@/lib/types"
import { formatCurrency, formatPercentAbs, CHART_COLORS } from "@/lib/utils"

interface BranchBarChartProps {
  data: BranchMetrics[]
}

export function BranchBarChart({ data }: BranchBarChartProps) {
  const chartData = data
    .filter((b) => b.tipo === "física")
    .map((b) => ({
      name: b.nombre.replace("Deus Store ", ""),
      revenue: b.revenue,
      margen: b.marginPct,
    }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="w-full h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v, { compact: true })}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "#475569", fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            width={88}
          />
          <Tooltip
            formatter={(v) => [formatCurrency(Number(v)), "Ingresos"]}
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              fontSize: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}
          />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={28}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#4F46E5" : i === 1 ? "#6366F1" : "#A5B4FC"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

interface CategoryPieChartProps {
  data: { categoria: string; revenue: number; revenueShare: number }[]
}

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const chartData = data.slice(0, 6).map((d, i) => ({
    name: d.categoria,
    value: d.revenue,
    share: d.revenueShare,
    fill: CHART_COLORS[i],
  }))

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="w-full h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="40%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={3}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, _name, entry) => [
              `${formatCurrency(Number(v), { compact: true })} (${formatPercentAbs((entry as { payload: { share: number } }).payload.share)})`,
              "Ingresos",
            ]}
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              fontSize: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: "11px", color: "#475569", fontWeight: 500 }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </motion.div>
  )
}
