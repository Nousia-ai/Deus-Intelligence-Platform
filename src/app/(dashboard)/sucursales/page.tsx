import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { BranchContent } from "./BranchContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"

export default async function SucursalesPage() {
  const data = await computeDashboardSummaryAsync()
  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header title="Rendimiento de Sucursales" subtitle="Comparativo y análisis por punto de venta" />
        <div className="flex-1 p-6">
          <BranchContent data={data} />
        </div>
      </div>
    </PageTransition>
  )
}
