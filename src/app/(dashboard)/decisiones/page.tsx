import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { DecisionesContent } from "./DecisionesContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"
import {
  getAlerts,
  getTransferCandidates,
  getReplenishmentAlerts,
  getWeeksOfSupply,
} from "@/lib/inventory"

export default async function DecisionesPage() {
  const [data, liquidar, transferir, reponer, weeksOfSupply] = await Promise.all([
    computeDashboardSummaryAsync(),
    getAlerts({ nivel: "ROJA" }),
    getTransferCandidates(),
    getReplenishmentAlerts(),
    getWeeksOfSupply(),
  ])

  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header
          title="Decisiones de la Semana"
          subtitle="4 acciones concretas para optimizar el inventario esta semana"
        />
        <div className="flex-1 p-6">
          <DecisionesContent
            data={data}
            liquidar={liquidar}
            transferir={transferir}
            reponer={reponer}
            weeksOfSupply={weeksOfSupply}
          />
        </div>
      </div>
    </PageTransition>
  )
}
