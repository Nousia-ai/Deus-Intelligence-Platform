import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { InsightsContent } from "./InsightsContent"

export default function InsightsPage() {
  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header
          title="Insights"
          subtitle="Análisis de sell-through y distribución por sucursal"
        />
        <div className="flex-1 p-6">
          <InsightsContent />
        </div>
      </div>
    </PageTransition>
  )
}
