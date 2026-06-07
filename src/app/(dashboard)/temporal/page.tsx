import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { TemporalContent } from "./TemporalContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"

export default async function TemporalPage() {
  const data = await computeDashboardSummaryAsync()
  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header title="Análisis Temporal" subtitle="Patrones de estacionalidad · Click en mes para drill-down" />
        <div className="flex-1 p-6">
          <TemporalContent data={data} />
        </div>
      </div>
    </PageTransition>
  )
}
