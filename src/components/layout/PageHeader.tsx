"use client"

import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  icon?: LucideIcon
  title: string
  subtitle?: string
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ icon: Icon, title, subtitle, children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 pb-6", className)}>
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-start gap-3"
      >
        {Icon && (
          <div className="w-8 h-8 rounded-[8px] bg-[#EEEDFB] flex items-center justify-center flex-shrink-0 mt-0.5">
            <Icon className="w-[15px] h-[15px] text-[#3730A3]" />
          </div>
        )}
        <div>
          <h1 className="text-lg font-semibold text-[#100F0C] leading-tight tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-[12px] text-[#9C9B95] mt-0.5 font-normal leading-snug">{subtitle}</p>
          )}
        </div>
      </motion.div>
      {children && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="flex items-center gap-2 flex-shrink-0"
        >
          {children}
        </motion.div>
      )}
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 mb-4", className)}>
      <div>
        <h2 className="text-[13px] font-semibold text-[#100F0C] tracking-tight">{title}</h2>
        {subtitle && <p className="text-[11px] text-[#9C9B95] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
