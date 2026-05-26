import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { KPIsContent } from "./KPIsContent"
import { computeDashboardSummary } from "@/lib/analytics"

export default function KPIsPage() {
  const data = computeDashboardSummary()
  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header title="Scorecard del CEO" subtitle="13 KPIs estratégicos · Fórmulas exactas sobre df_ventas_v4" />
        <div className="flex-1">
          <KPIsContent data={data} />
        </div>
      </div>
    </PageTransition>
  )
}
