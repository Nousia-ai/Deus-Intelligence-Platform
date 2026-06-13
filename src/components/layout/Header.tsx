"use client"

import { Bell, Search, Calendar } from "lucide-react"
import { motion } from "framer-motion"

// Data end date — update when re-seeding with fresher data
const DATA_END = new Date(2026, 4, 31) // May 31, 2026

function useFreshness() {
  const today = new Date()
  const days = Math.max(0, Math.floor((today.getTime() - DATA_END.getTime()) / (1000 * 60 * 60 * 24)))
  const dot = days < 14 ? "bg-emerald-500" : days < 30 ? "bg-amber-400" : "bg-red-500"
  const tip = days < 14 ? `${days}d · datos frescos` : days < 30 ? `${days}d · próxima actualización pronto` : `${days}d · datos desactualizados`
  return { days, dot, tip }
}

interface HeaderProps {
  title: string
  subtitle?: string
}

export function Header({ title, subtitle }: HeaderProps) {
  const { dot, tip } = useFreshness()

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200/60 bg-white/70 backdrop-blur-sm flex-shrink-0">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-[15px] font-semibold text-slate-900 leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5 font-medium">{subtitle}</p>
        )}
      </motion.div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Date range + freshness badge */}
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 font-medium" title={tip}>
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Abr 2023 – May 2026</span>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} title={tip} />
        </div>

        {/* Search */}
        <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Buscar...</span>
          <kbd className="hidden sm:inline text-[10px] font-mono bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>

        {/* Notifications */}
        <button className="relative w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500" />
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          DS
        </div>
      </div>
    </header>
  )
}
