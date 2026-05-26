"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  LayoutDashboard,
  Store,
  Package,
  TrendingUp,
  Tag,
  BarChart3,
  Target,
  ChevronLeft,
  PanelLeftOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  {
    href: "/inicio",
    icon: LayoutDashboard,
    label: "Resumen",
    sublabel: "Vista ejecutiva",
  },
  {
    href: "/sucursales",
    icon: Store,
    label: "Sucursales",
    sublabel: "Rendimiento por punto",
  },
  {
    href: "/productos",
    icon: Package,
    label: "Productos",
    sublabel: "Inteligencia de catálogo",
  },
  {
    href: "/temporal",
    icon: TrendingUp,
    label: "Tendencias",
    sublabel: "Patrones temporales",
  },
  {
    href: "/precios",
    icon: Tag,
    label: "Precios",
    sublabel: "Comportamiento de descuentos",
  },
  {
    href: "/inventario",
    icon: BarChart3,
    label: "Inventario",
    sublabel: "Salud del stock",
  },
  {
    href: "/kpis",
    icon: Target,
    label: "KPIs CEO",
    sublabel: "13 métricas estratégicas",
  },
]

// ── Deus Stores logo — full wordmark ────────────────────────────────────────
function DeusWordmark() {
  return (
    <svg
      viewBox="0 0 172 56"
      className="h-7 w-auto flex-shrink-0"
      fill="none"
      aria-label="Deus Stores"
    >
      {/* DEUS bold wordmark */}
      <text
        x="2"
        y="38"
        style={{
          fontFamily: "var(--font-geist-sans, 'Geist', -apple-system, sans-serif)",
          fontWeight: 800,
          fontSize: 40,
          letterSpacing: "-1px",
        }}
        fill="white"
      >
        DEUS
      </text>
      {/* Characteristic underline that curves up on the right — the brand signature */}
      <path
        d="M2,46 H148 Q162,46 162,32"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* STORES in tracked small-caps */}
      <text
        x="160"
        y="55"
        style={{
          fontFamily: "var(--font-geist-sans, 'Geist', -apple-system, sans-serif)",
          fontWeight: 500,
          fontSize: 9.5,
          letterSpacing: "3px",
        }}
        fill="rgba(255,255,255,0.55)"
        textAnchor="end"
      >
        STORES
      </text>
    </svg>
  )
}

// ────────────────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)

  // Restore sidebar preference after mount — avoids SSR/client hydration mismatch
  useEffect(() => {
    const saved = localStorage.getItem("sidebar-open")
    if (saved === "false") setOpen(false)
  }, [])

  const toggle = () => {
    const next = !open
    setOpen(next)
    localStorage.setItem("sidebar-open", String(next))
  }

  return (
    <>
    {/* ── Floating re-open button (visible only when sidebar is closed) ── */}
    <AnimatePresence>
      {!open && (
        <motion.button
          key="sidebar-reopen"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={toggle}
          title="Abrir menú"
          className="fixed top-3.5 left-3 z-50 flex items-center justify-center w-8 h-8 rounded-lg bg-[#0B0F19] border border-white/10 text-white/50 hover:text-white/90 hover:border-white/25 shadow-lg transition-all duration-150"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </motion.button>
      )}
    </AnimatePresence>

    <motion.aside
      animate={{ width: open ? 236 : 0 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col h-full bg-[#0B0F19] sidebar-glow overflow-hidden flex-shrink-0"
    >
      {/* Subtle top light-leak */}
      <div
        className="absolute inset-x-0 top-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(99,102,241,0.35), transparent)",
        }}
      />

      {/* Logo area */}
      <div className="flex items-center h-14 px-3.5 border-b border-white/[0.05] flex-shrink-0">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <DeusWordmark />
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3.5 overflow-y-auto scrollbar-thin">
        <div className="space-y-px">
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  whileHover={{ x: 1.5 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className={cn(
                    "relative flex items-center gap-3 rounded-[7px] px-2.5 py-2.5 group transition-all duration-150",
                    isActive
                      ? "bg-indigo-500/10 text-indigo-300"
                      : "text-white/45 hover:text-white/80 hover:bg-white/[0.04]"
                  )}
                >
                  {/* Active rule */}
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-indigo-400 rounded-full"
                      transition={{
                        type: "spring",
                        stiffness: 420,
                        damping: 32,
                      }}
                    />
                  )}
                  <item.icon
                    className={cn(
                      "w-[15px] h-[15px] flex-shrink-0 transition-colors duration-150",
                      isActive ? "text-indigo-400" : "text-current"
                    )}
                  />
                  <div className="overflow-hidden min-w-0">
                    <p
                      className={cn(
                        "text-[13px] whitespace-nowrap leading-none",
                        isActive
                          ? "font-medium text-white/95"
                          : "font-normal text-current"
                      )}
                    >
                      {item.label}
                    </p>
                    <p className="text-[9px] font-semibold text-white/22 whitespace-nowrap mt-0.5 uppercase tracking-[0.06em]">
                      {item.sublabel}
                    </p>
                  </div>
                </motion.div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-2 pb-3.5 border-t border-white/[0.05] pt-3.5 flex-shrink-0">
        <div className="mb-3 px-2.5">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-[9px] font-semibold text-white/25 tracking-[0.08em] uppercase whitespace-nowrap">
              Datos actualizados
            </span>
          </div>
          <p className="text-[9px] text-white/18 mt-0.5 ml-3.5 font-medium whitespace-nowrap">
            Abr 2023 – May 2026
          </p>
        </div>

        <button
          onClick={toggle}
          className="w-full flex items-center justify-center gap-2 rounded-[7px] px-2.5 py-2 text-white/25 hover:text-white/55 hover:bg-white/[0.04] transition-all duration-150 group"
        >
          <ChevronLeft className="w-3.5 h-3.5 transition-transform duration-150 group-hover:-translate-x-0.5 flex-shrink-0" />
          <span className="text-[11px] font-medium whitespace-nowrap">Cerrar menú</span>
        </button>
      </div>
    </motion.aside>
    </>
  )
}
