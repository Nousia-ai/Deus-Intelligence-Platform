import { Header } from "@/components/layout/Header"
import { PageTransition } from "@/components/layout/PageTransition"
import { CargaContent } from "./CargaContent"
import { supabase } from "@/lib/supabase"

// Sucursales fijas que maneja el kardex (en el mismo orden del parser)
const SUCURSALES = [
  { key: "16S",  nombre: "16 de Septiembre" },
  { key: "atlx", nombre: "Atlixco" },
  { key: "cs",   nombre: "Centro Sur" },
  { key: "chol", nombre: "Cholula" },
  { key: "czsr", nombre: "Cruz del Sur" },
  { key: "sd",   nombre: "San Diego" },
]

async function getRecentLogs() {
  if (!supabase) return []
  const { data } = await supabase
    .from("etl_log")
    .select("id,source,filename,rows_processed,rows_inserted,status,error_message,started_at,completed_at")
    .order("started_at", { ascending: false })
    .limit(10)
  return data ?? []
}

async function getVentasLastDate(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from("ventas_lineas")
    .select("fecha")
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.fecha ?? null
}

async function getInventarioStatus() {
  if (!supabase) {
    return SUCURSALES.map(s => ({ sucursal_key: s.key, sucursal_nombre: s.nombre, periodo_fin: null, updated_at: null }))
  }
  // One lightweight query per branch (indexed lookup + limit 1 = fast)
  const results = await Promise.all(
    SUCURSALES.map(async ({ key, nombre }) => {
      const { data } = await supabase!
        .from("inventory_kpis")
        .select("periodo_fin, updated_at")
        .eq("sucursal_key", key)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      return {
        sucursal_key: key,
        sucursal_nombre: nombre,
        periodo_fin: data?.periodo_fin ?? null,
        updated_at: data?.updated_at ?? null,
      }
    })
  )
  return results
}

export default async function CargaPage() {
  const [logs, ventasUltimaFecha, inventarioStatus] = await Promise.all([
    getRecentLogs(),
    getVentasLastDate(),
    getInventarioStatus(),
  ])

  return (
    <PageTransition>
      <div className="flex flex-col min-h-full">
        <Header
          title="Carga de Datos"
          subtitle="ETL desde ERP Microsip · ventas e inventario"
        />
        <div className="flex-1">
          <CargaContent
            logs={logs}
            ventasUltimaFecha={ventasUltimaFecha}
            inventarioStatus={inventarioStatus}
          />
        </div>
      </div>
    </PageTransition>
  )
}
