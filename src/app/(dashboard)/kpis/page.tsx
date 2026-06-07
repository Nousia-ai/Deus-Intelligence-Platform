import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { KPIsContent } from "./KPIsContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"

export default async function KPIsPage() {
  const data = await computeDashboardSummaryAsync()
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
