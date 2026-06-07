import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { InventarioContent } from "./InventarioContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"

export default async function InventarioPage() {
  const data = await computeDashboardSummaryAsync()
  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header title="Salud del Inventario" subtitle="Rotación, stock lento y eficiencia del portafolio" />
        <div className="flex-1 p-6">
          <InventarioContent data={data} />
        </div>
      </div>
    </PageTransition>
  )
}
