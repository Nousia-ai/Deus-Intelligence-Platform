"use client"

import { motion } from "framer-motion"
import { TrendingUp, AlertTriangle, Lightbulb, Activity, Info, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { InsightType } from "@/lib/types"

const INSIGHT_CONFIG: Record<InsightType["type"], {
  icon: LucideIcon
  bg: string
  border: string
  iconColor: string
  badge: string
  badgeBg: string
}> = {
  opportunity: {
    icon: Lightbulb,
    bg: "bg-amber-50/60",
    border: "border-amber-200/60",
    iconColor: "text-amber-600",
    badge: "Oportunidad",
    badgeBg: "bg-amber-100 text-amber-700",
  },
  risk: {
    icon: AlertTriangle,
    bg: "bg-red-50/60",
    border: "border-red-200/60",
    iconColor: "text-red-500",
    badge: "Riesgo",
    badgeBg: "bg-red-100 text-red-600",
  },
  trend: {
    icon: TrendingUp,
    bg: "bg-emerald-50/60",
    border: "border-emerald-200/60",
    iconColor: "text-emerald-600",
    badge: "Tendencia",
    badgeBg: "bg-emerald-100 text-emerald-700",
  },
  anomaly: {
    icon: Activity,
    bg: "bg-violet-50/60",
    border: "border-violet-200/60",
    iconColor: "text-violet-600",
    badge: "Anomalía",
    badgeBg: "bg-violet-100 text-violet-700",
  },
  info: {
    icon: Info,
    bg: "bg-sky-50/60",
    border: "border-sky-200/60",
    iconColor: "text-sky-600",
    badge: "Observación",
    badgeBg: "bg-sky-100 text-sky-700",
  },
}

interface InsightCardProps {
  insight: InsightType
  delay?: number
}

export function InsightCard({ insight, delay = 0 }: InsightCardProps) {
  const config = INSIGHT_CONFIG[insight.type]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-xl border p-4 transition-all duration-200 hover:shadow-sm",
        config.bg,
        config.border
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <config.icon className={cn("w-4 h-4", config.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", config.badgeBg)}>
              {config.badge}
            </span>
            {insight.metricValue && (
              <span className="text-xs font-bold text-slate-700">
                {insight.metricValue}
              </span>
            )}
          </div>
          <h4 className="text-sm font-semibold text-slate-800 leading-snug mb-1">
            {insight.title}
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            {insight.description}
          </p>
        </div>
      </div>
    </motion.div>
  )
}

interface InsightPanelProps {
  insights: InsightType[]
  title?: string
}

export function InsightPanel({ insights, title = "Observaciones ejecutivas" }: InsightPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-1 h-4 bg-indigo-500 rounded-full" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="text-xs text-slate-400 ml-auto">{insights.length} señales</span>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <InsightCard key={insight.id} insight={insight} delay={i * 0.06} />
        ))}
      </div>
    </div>
  )
}
