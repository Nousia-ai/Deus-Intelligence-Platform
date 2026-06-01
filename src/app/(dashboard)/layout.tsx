import { Sidebar } from "@/components/layout/Sidebar"
import { FilterBar } from "@/components/layout/FilterBar"
import { FilterProvider } from "@/contexts/FilterContext"
import { computeDashboardSummary } from "@/lib/analytics"
import { InsightsWidget } from "@/components/ui/QuickNotes"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const data = computeDashboardSummary()

  return (
    <FilterProvider data={data}>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <FilterBar data={data} />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            {children}
          </main>
        </div>
      </div>
      <InsightsWidget />
    </FilterProvider>
  )
}
