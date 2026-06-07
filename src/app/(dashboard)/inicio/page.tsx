import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { DashboardContent } from "./DashboardContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"

export default async function InicioPage() {
  const data = await computeDashboardSummaryAsync()
  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header title="Resumen Ejecutivo" subtitle="Visión integral de operaciones · Deus Store" />
        <div className="flex-1">
          <DashboardContent data={data} />
        </div>
      </div>
    </PageTransition>
  )
}
