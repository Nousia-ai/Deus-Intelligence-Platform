/**
 * Server-only — importa el service_role key via supabase.ts.
 * Nunca importar en Client Components.
 */
import { supabase } from "./supabase"
import type {
  InventoryKPI,
  AlertLevel,
  AlertSummary,
  TransferCandidate,
  WeeksOfSupplyRow,
} from "./types"

export interface AlertFilters {
  sucursal?: string
  nivel?: AlertLevel
  tipo_producto?: string
  bucket?: string
}

/** Todos los SKUs con alerta activa (nivel_alerta IS NOT NULL, stock > 0). */
export async function getAlerts(filters?: AlertFilters): Promise<InventoryKPI[]> {
  if (!supabase) return []

  let query = supabase
    .from("inventory_kpis")
    .select("*")
    .not("nivel_alerta", "is", null)
    .gt("inv_fin_unidades", 0)

  if (filters?.sucursal) query = query.eq("sucursal_key", filters.sucursal)
  if (filters?.nivel) query = query.eq("nivel_alerta", filters.nivel)
  if (filters?.tipo_producto) query = query.eq("tipo_producto", filters.tipo_producto)
  if (filters?.bucket) query = query.eq("bucket_aging", filters.bucket)

  const { data, error } = await query.order("valor_inv_costo", { ascending: false })
  if (error) {
    console.error("[inventory.getAlerts]", error.message)
    return []
  }
  return (data ?? []) as InventoryKPI[]
}

/** Conteo y valor agregado por nivel de alerta (para las 3 tarjetas del dashboard). */
export async function getAlertSummary(): Promise<AlertSummary[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from("inventory_kpis")
    .select("nivel_alerta, sucursal_key, valor_inv_costo")
    .not("nivel_alerta", "is", null)
    .gt("inv_fin_unidades", 0)

  if (error) {
    console.error("[inventory.getAlertSummary]", error.message)
    return []
  }

  const map: Record<string, AlertSummary> = {}
  for (const row of data ?? []) {
    const nivel = row.nivel_alerta as AlertLevel
    if (!map[nivel]) map[nivel] = { nivel, skus: 0, valor_en_riesgo: 0, sucursales: [] }
    map[nivel].skus++
    map[nivel].valor_en_riesgo += row.valor_inv_costo ?? 0
    if (!map[nivel].sucursales.includes(row.sucursal_key)) {
      map[nivel].sucursales.push(row.sucursal_key)
    }
  }

  const order: AlertLevel[] = ["ROJA", "NARANJA", "AMARILLA"]
  return order.map((n) => map[n]).filter(Boolean)
}

/** Promedio de weeks_of_supply por sucursal × tipo_producto (excluye básicos y promos). */
export async function getWeeksOfSupply(sucursal?: string): Promise<WeeksOfSupplyRow[]> {
  if (!supabase) return []

  let query = supabase
    .from("inventory_kpis")
    .select("sucursal_key, sucursal_nombre, tipo_producto, weeks_of_supply")
    .eq("es_basico", 0)
    .eq("es_promo", 0)
    .gt("inv_fin_unidades", 0)
    .not("weeks_of_supply", "is", null)
    .not("tipo_producto", "is", null)

  if (sucursal) query = query.eq("sucursal_key", sucursal)

  const { data, error } = await query
  if (error) {
    console.error("[inventory.getWeeksOfSupply]", error.message)
    return []
  }

  const agg: Record<string, { sum: number; count: number; nombre: string | null }> = {}
  for (const row of data ?? []) {
    const key = `${row.sucursal_key}|||${row.tipo_producto}`
    if (!agg[key]) agg[key] = { sum: 0, count: 0, nombre: row.sucursal_nombre }
    agg[key].sum += row.weeks_of_supply as number
    agg[key].count++
  }

  return Object.entries(agg)
    .map(([key, v]) => {
      const [sucursal_key, tipo_producto] = key.split("|||")
      return {
        sucursal_key,
        sucursal_nombre: v.nombre,
        tipo_producto,
        avg_weeks_of_supply: v.sum / v.count,
        skus: v.count,
      }
    })
    .sort((a, b) => b.avg_weeks_of_supply - a.avg_weeks_of_supply)
}

/**
 * Pares DONANTE → RECEPTORA para el mismo sku_padre.
 * Donante: perfil_demanda=DONANTE + stock > 2 uds.
 * Receptora: perfil_demanda=RECEPTORA + stock < 2 uds.
 */
export async function getTransferCandidates(): Promise<TransferCandidate[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from("inventory_kpis")
    .select(
      "sku_padre, descripcion, marca, tipo_producto, sucursal_key, sucursal_nombre, inv_fin_unidades, perfil_demanda"
    )
    .not("perfil_demanda", "is", null)
    .not("sku_padre", "is", null)

  if (error) {
    console.error("[inventory.getTransferCandidates]", error.message)
    return []
  }

  type SkuEntry = {
    descripcion: string | null
    marca: string | null
    tipo_producto: string | null
    donantes: Array<{ sucursal_key: string; sucursal_nombre: string | null; stock: number }>
    receptoras: Array<{ sucursal_key: string; sucursal_nombre: string | null; stock: number }>
  }

  const skuMap: Record<string, SkuEntry> = {}

  for (const row of data ?? []) {
    const sku = row.sku_padre as string
    if (!skuMap[sku]) {
      skuMap[sku] = {
        descripcion: row.descripcion,
        marca: row.marca,
        tipo_producto: row.tipo_producto,
        donantes: [],
        receptoras: [],
      }
    }
    const stock = (row.inv_fin_unidades as number) ?? 0
    if (row.perfil_demanda === "DONANTE" && stock > 2) {
      skuMap[sku].donantes.push({
        sucursal_key: row.sucursal_key,
        sucursal_nombre: row.sucursal_nombre,
        stock,
      })
    } else if (row.perfil_demanda === "RECEPTORA" && stock < 2) {
      skuMap[sku].receptoras.push({
        sucursal_key: row.sucursal_key,
        sucursal_nombre: row.sucursal_nombre,
        stock,
      })
    }
  }

  const candidates: TransferCandidate[] = []
  for (const [sku_padre, v] of Object.entries(skuMap)) {
    if (v.donantes.length === 0 || v.receptoras.length === 0) continue
    for (const d of v.donantes) {
      for (const r of v.receptoras) {
        candidates.push({
          sku_padre,
          descripcion: v.descripcion,
          marca: v.marca,
          tipo_producto: v.tipo_producto,
          donante_key: d.sucursal_key,
          donante_nombre: d.sucursal_nombre,
          donante_stock: d.stock,
          receptora_key: r.sucursal_key,
          receptora_nombre: r.sucursal_nombre,
          receptora_stock: r.stock,
          unidades_a_transferir: Math.floor(d.stock / 2),
        })
      }
    }
  }

  return candidates.sort((a, b) => b.unidades_a_transferir - a.unidades_a_transferir)
}

/** SKUs con quiebre de stock: inv_fin = 0 pero tenían ventas (ordenados por velocidad). */
export async function getStockouts(): Promise<InventoryKPI[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from("inventory_kpis")
    .select("*")
    .eq("inv_fin_unidades", 0)
    .gt("unidades_vendidas", 0)
    .order("velocidad_semanal", { ascending: false })

  if (error) {
    console.error("[inventory.getStockouts]", error.message)
    return []
  }
  return (data ?? []) as InventoryKPI[]
}

/**
 * SKUs con perfil RECEPTORA y menos de 2 semanas de stock según su velocidad.
 * Ordena por urgencia (menor WoS primero).
 */
export async function getReplenishmentAlerts(): Promise<InventoryKPI[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from("inventory_kpis")
    .select("*")
    .eq("perfil_demanda", "RECEPTORA")
    .gt("inv_fin_unidades", 0)
    .not("velocidad_semanal", "is", null)

  if (error) {
    console.error("[inventory.getReplenishmentAlerts]", error.message)
    return []
  }

  return ((data ?? []) as InventoryKPI[])
    .filter((row) => {
      const stock = row.inv_fin_unidades ?? 0
      const vel = row.velocidad_semanal ?? 0
      return vel > 0 && stock < vel * 2
    })
    .sort((a, b) => {
      const wosA = (a.inv_fin_unidades ?? 0) / (a.velocidad_semanal ?? 1)
      const wosB = (b.inv_fin_unidades ?? 0) / (b.velocidad_semanal ?? 1)
      return wosA - wosB
    })
}
