/**
 * Recomendaciones de traspaso entre sucursales (rebalanceo de inventario).
 *
 * Metodología estándar de fashion retail (rate-of-sale gap + redistribución
 * proporcional a demanda demostrada — ver Nextail/StyleMatrix inventory rebalancing):
 *   1. Señal de traspaso: brecha de sell-through del mismo SKU entre sucursales.
 *      Un donante vende mal (≤40%, segmento bajo/crítico); un receptor vende bien
 *      (≥60%, segmento bueno/excelente); la brecha debe ser ≥30pp para justificar
 *      el costo logístico del movimiento.
 *   2. Cantidad: se redistribuye el stock combinado (donante + receptor) en
 *      proporción a la demanda ya demostrada (unidades vendidas) en cada uno —
 *      no una regla fija — dejando 1 unidad de resguardo en el donante si ese
 *      SKU aún tiene alguna venta ahí (si vendió 0, se permite vaciar el stock).
 *
 * Pure — no I/O. Se usa tanto desde el cliente (detalle expandible en /insights,
 * ya con SellThroughRow[] cargado) como desde el servidor (chat assistant tool).
 */
import type { SellThroughRow, TransferRecommendation } from "./types"

const DONOR_ST_MAX = 0.40
const RECEIVER_ST_MIN = 0.60
const MIN_ST_GAP = 0.30
const MIN_TRANSFER_QTY = 1

function confidenceFor(sampleSize: number): TransferRecommendation["confidence"] {
  if (sampleSize >= 20) return "alta"
  if (sampleSize >= 6) return "media"
  return "baja"
}

/** Traspasos sugeridos dentro de un mismo sku_padre, entre sus sucursales. */
export function computeTransfersForRow(row: SellThroughRow): TransferRecommendation[] {
  const branches = row.by_sucursal.filter((b) => b.inv_fin_unidades > 0 || b.unidades_vendidas > 0)
  if (branches.length < 2) return []

  const donors = branches
    .filter((b) => b.sell_through <= DONOR_ST_MAX && b.inv_fin_unidades >= MIN_TRANSFER_QTY)
    .sort((a, b) => a.sell_through - b.sell_through)

  const receivers = branches
    .filter((b) => b.sell_through >= RECEIVER_ST_MIN)
    .sort((a, b) => b.sell_through - a.sell_through)

  if (donors.length === 0 || receivers.length === 0) return []

  // Stock restante por donante — se decrementa a medida que se asigna a distintos receptores
  const remaining: Record<string, number> = {}
  for (const d of donors) remaining[d.sucursal_key] = d.inv_fin_unidades

  const recs: TransferRecommendation[] = []

  for (const receiver of receivers) {
    for (const donor of donors) {
      if (donor.sucursal_key === receiver.sucursal_key) continue

      const gap = receiver.sell_through - donor.sell_through
      if (gap < MIN_ST_GAP) continue

      const availableStock = remaining[donor.sucursal_key]
      if (availableStock < MIN_TRANSFER_QTY) continue

      const combinedStock = availableStock + receiver.inv_fin_unidades
      const combinedSold = donor.unidades_vendidas + receiver.unidades_vendidas
      const targetDonorStock =
        combinedSold > 0
          ? Math.round(combinedStock * (donor.unidades_vendidas / combinedSold))
          : Math.floor(availableStock / 2)

      // Resguardo: 1 unidad si el donante todavía vende algo de este SKU; 0 si está muerto ahí
      const retain = donor.unidades_vendidas > 0 ? 1 : 0
      const qty = Math.min(availableStock - retain, Math.max(0, availableStock - targetDonorStock))
      if (qty < MIN_TRANSFER_QTY) continue

      const sampleSize = donor.unidades_vendidas + donor.inv_fin_unidades + receiver.unidades_vendidas + receiver.inv_fin_unidades

      recs.push({
        sku_padre: row.sku_padre,
        descripcion: row.descripcion,
        marca: row.marca,
        tipo_producto: row.tipo_producto,
        from_sucursal: donor.sucursal_key,
        to_sucursal: receiver.sucursal_key,
        from_sell_through: donor.sell_through,
        to_sell_through: receiver.sell_through,
        quantity: qty,
        from_stock_after: availableStock - qty,
        confidence: confidenceFor(sampleSize),
        impact_score: qty * gap,
      })

      remaining[donor.sucursal_key] -= qty
    }
  }

  return recs.sort((a, b) => b.impact_score - a.impact_score)
}

/** Todos los traspasos recomendados a través de todo el catálogo, priorizados por impacto. */
export function getAllTransferRecommendations(rows: SellThroughRow[]): TransferRecommendation[] {
  return rows.flatMap(computeTransfersForRow).sort((a, b) => b.impact_score - a.impact_score)
}
