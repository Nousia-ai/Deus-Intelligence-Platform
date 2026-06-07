import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { ProductContent } from "./ProductContent"
import { computeDashboardSummaryAsync } from "@/lib/analytics"

export default async function ProductosPage() {
  const data = await computeDashboardSummaryAsync()
  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header title="Inteligencia de Producto" subtitle="Rendimiento de categorías, marcas y SKUs" />
        <div className="flex-1 p-6">
          <ProductContent data={data} />
        </div>
      </div>
    </PageTransition>
  )
}
