import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { InventarioContent } from "./InventarioContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"
import {
  getAlertSummary,
  getAlerts,
  getStockouts,
  getTransferCandidates,
  getWeeksOfSupply,
  getReplenishmentAlerts,
} from "@/lib/inventory"

export default async function InventarioPage() {
  const [data, alertSummary, alerts, stockouts, transfers, weeksOfSupply, replenishment] =
    await Promise.all([
      computeDashboardSummaryAsync(),
      getAlertSummary(),
      getAlerts(),
      getStockouts(),
      getTransferCandidates(),
      getWeeksOfSupply(),
      getReplenishmentAlerts(),
    ])

  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header
          title="Salud del Inventario"
          subtitle="Alertas de aging, slow movers y quiebres de stock"
        />
        <div className="flex-1 p-6">
          <InventarioContent
            data={data}
            alertSummary={alertSummary}
            alerts={alerts}
            stockouts={stockouts}
            transfers={transfers}
            weeksOfSupply={weeksOfSupply}
            replenishment={replenishment}
          />
        </div>
      </div>
    </PageTransition>
  )
}
