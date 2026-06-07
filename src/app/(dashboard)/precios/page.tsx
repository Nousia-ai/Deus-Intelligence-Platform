import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { PreciosContent } from "./PreciosContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"

export default async function PreciosPage() {
  const data = await computeDashboardSummaryAsync()
  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header title="Comportamiento de Precios" subtitle="Descuentos, segmentación y poder de precio" />
        <div className="flex-1 p-6">
          <PreciosContent data={data} />
        </div>
      </div>
    </PageTransition>
  )
}
