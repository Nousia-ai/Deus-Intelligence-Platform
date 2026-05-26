"use client"

import { motion, AnimatePresence } from "framer-motion"
import { TrendingUp, TrendingDown, Minus, LucideIcon } from "lucide-react"
import { cn, getChangeBg } from "@/lib/utils"
import { useCountUp } from "@/hooks/useCountUp"

interface KPICardProps {
  title: string
  value: string
  numericValue?: number
  change?: number
  changeLabel?: string
  icon?: LucideIcon
  iconColor?: string
  accentColor?: string
  subtitle?: string
  delay?: number
  formatter?: (n: number) => string
}

export function KPICard({
  title,
  value,
  numericValue,
  change,
  changeLabel,
  icon: Icon,
  iconColor = "text-indigo-500",
  accentColor = "bg-indigo-50",
  subtitle,
  delay = 0,
  formatter,
}: KPICardProps) {
  const hasChange = change !== undefined
  const isPositive = (change ?? 0) > 0
  const isNegative = (change ?? 0) < 0

  // Animate numeric value if provided
  const animated = useCountUp({
    end: numericValue ?? 0,
    duration: 900,
    delay: delay * 1000,
    decimals: 0,
  })

  const displayValue = numericValue !== undefined && formatter
    ? formatter(animated)
    : value

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group relative bg-white rounded-xl card-shadow hover:card-shadow-hover transition-all duration-200 p-5 overflow-hidden cursor-default"
    >
      {/* Hover accent stripe */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500/0 via-indigo-500/40 to-indigo-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-start justify-between mb-4">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider leading-none">
          {title}
        </p>
        {Icon && (
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110", accentColor)}>
            <Icon className={cn("w-4 h-4", iconColor)} />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <AnimatePresence mode="wait">
          <motion.p
            key={numericValue ?? value}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-2xl font-bold text-slate-900 leading-none tracking-tight tabular-nums"
          >
            {displayValue}
          </motion.p>
        </AnimatePresence>

        {subtitle && (
          <p className="text-xs text-slate-400 font-medium">{subtitle}</p>
        )}

        {hasChange && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.15 }}
            className="flex items-center gap-1.5 pt-0.5"
          >
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", getChangeBg(change!))}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {isPositive ? "+" : ""}{change!.toFixed(1)}%
            </span>
            {changeLabel && (
              <span className="text-[11px] text-slate-400">{changeLabel}</span>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

interface KPIGridProps {
  children: React.ReactNode
  columns?: 2 | 3 | 4
}

export function KPIGrid({ children, columns = 4 }: KPIGridProps) {
  return (
    <div className={cn(
      "grid gap-4",
      columns === 4 && "grid-cols-2 lg:grid-cols-4",
      columns === 3 && "grid-cols-1 md:grid-cols-3",
      columns === 2 && "grid-cols-1 md:grid-cols-2"
    )}>
      {children}
    </div>
  )
}
