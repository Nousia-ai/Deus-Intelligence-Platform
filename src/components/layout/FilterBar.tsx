"use client"

import { motion, AnimatePresence } from "framer-motion"
import { SlidersHorizontal, X } from "lucide-react"
import { useFilter } from "@/contexts/FilterContext"
import { cn } from "@/lib/utils"
import type { DashboardSummary } from "@/lib/types"

interface FilterBarProps {
  data: DashboardSummary
}

const MONTH_ABBR = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

function Pill({
  active,
  onClick,
  children,
  size = "md",
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  size?: "md" | "sm"
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.1, ease: "easeOut" }}
      className={cn(
        "font-medium rounded-full border transition-all duration-150 whitespace-nowrap flex-shrink-0",
        size === "md" ? "text-[11px] px-3 py-1" : "text-[10px] px-2 py-[3px]",
        active
          ? "bg-[#3730A3] text-white border-[#3730A3] shadow-sm"
          : "bg-[#FDFCF9] text-[#4A4840] border-[#E4E2D8] hover:border-[#4338CA]/40 hover:text-[#3730A3]"
      )}
    >
      {children}
    </motion.button>
  )
}

export function FilterBar({ data }: FilterBarProps) {
  const { filter, toggleBranch, toggleYear, toggleMonth, clearFilters, isFiltered } = useFilter()

  const activeMonthCount = filter.selectedMonths.length
  const activeYearCount = filter.selectedYears.length
  const activeBranchCount = filter.selectedBranches.length

  return (
    <div className="border-b border-[#E4E2D8]/70 bg-[#FDFCF9]/80 backdrop-blur-sm flex-shrink-0">
      {/* ── Row 1: Sucursales + Año ── */}
      <div className="flex items-center gap-3 px-5 py-2 overflow-x-auto scrollbar-thin">
        {/* Icon + Label */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <SlidersHorizontal className="w-3 h-3 text-[#9C9B95]" />
          <span className="text-[9px] font-semibold text-[#9C9B95] uppercase tracking-[0.08em]">Filtrar</span>
        </div>

        <div className="w-px h-3.5 bg-[#E4E2D8] flex-shrink-0" />

        {/* Branch pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[9px] font-semibold text-[#9C9B95] uppercase tracking-[0.06em] mr-0.5">
            Sucursal{activeBranchCount > 0 && (
              <span className="ml-1 text-[#3730A3] font-bold font-mono">·{activeBranchCount}</span>
            )}
          </span>
          {data.availableBranches.map((branch) => (
            <Pill
              key={branch.id}
              active={filter.selectedBranches.includes(branch.id)}
              onClick={() => toggleBranch(branch.id)}
            >
              {branch.nombre}
            </Pill>
          ))}
        </div>

        <div className="w-px h-3.5 bg-[#E4E2D8] flex-shrink-0" />

        {/* Year pills */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[9px] font-semibold text-[#9C9B95] uppercase tracking-[0.06em] mr-0.5">
            Año{activeYearCount > 0 && (
              <span className="ml-1 text-[#3730A3] font-bold font-mono">·{activeYearCount}</span>
            )}
          </span>
          {data.availableYears.map((year) => (
            <Pill
              key={year}
              active={filter.selectedYears.includes(year)}
              onClick={() => toggleYear(year)}
            >
              {year}
            </Pill>
          ))}
        </div>

        {/* Spacer + status + clear */}
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          <AnimatePresence>
            {isFiltered && (
              <motion.div
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-1.5"
              >
                <span className="w-1 h-1 rounded-full bg-[#4338CA] animate-pulse" />
                <span className="text-[9px] font-semibold text-[#3730A3] tracking-[0.04em]">Filtrado</span>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isFiltered && (
              <motion.button
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.15 }}
                onClick={clearFilters}
                className="flex items-center gap-1 text-[10px] font-medium text-[#9C9B95] hover:text-red-500 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
                Limpiar
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Row 2: Mes ── */}
      <div className="flex items-center gap-1.5 px-5 pb-2 overflow-x-auto scrollbar-thin">
        <span className="text-[9px] font-semibold text-[#9C9B95] uppercase tracking-[0.06em] mr-1 flex-shrink-0">
          Mes{activeMonthCount > 0 && (
            <span className="ml-1 text-[#3730A3] font-bold font-mono">·{activeMonthCount}</span>
          )}
        </span>
        {MONTHS.map((m) => (
          <Pill
            key={m}
            size="sm"
            active={filter.selectedMonths.includes(m)}
            onClick={() => toggleMonth(m)}
          >
            {MONTH_ABBR[m]}
          </Pill>
        ))}

        {/* Quarter quick-selectors */}
        <div className="w-px h-3 bg-[#E4E2D8] mx-1 flex-shrink-0" />
        {[
          { label: "Q1", months: [1, 2, 3] },
          { label: "Q2", months: [4, 5, 6] },
          { label: "Q3", months: [7, 8, 9] },
          { label: "Q4", months: [10, 11, 12] },
        ].map(({ label, months }) => (
          <button
            key={label}
            onClick={() => {
              months.forEach((m) => { if (!filter.selectedMonths.includes(m)) toggleMonth(m) })
              filter.selectedMonths.filter((m) => !months.includes(m)).forEach((m) => toggleMonth(m))
            }}
            className="text-[9px] font-semibold text-[#9C9B95] hover:text-[#3730A3] transition-colors px-1.5 py-0.5 rounded-[4px] border border-[#E4E2D8] hover:border-[#4338CA]/40 whitespace-nowrap flex-shrink-0"
          >
            {label}
          </button>
        ))}

        <AnimatePresence>
          {activeMonthCount > 0 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => {
                ;[...filter.selectedMonths].forEach((m) => toggleMonth(m))
              }}
              className="text-[9px] font-medium text-[#9C9B95] hover:text-red-500 transition-colors ml-1 flex items-center gap-0.5 flex-shrink-0"
            >
              <X className="w-2.5 h-2.5" />
              {activeMonthCount} {activeMonthCount === 1 ? "mes" : "meses"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
