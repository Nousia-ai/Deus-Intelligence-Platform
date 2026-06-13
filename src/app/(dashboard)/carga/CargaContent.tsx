"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Upload, CheckCircle2, XCircle, Clock,
  RefreshCw, TrendingUp, Package, ArrowRight,
  AlertTriangle, Undo2, CalendarDays,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EtlLog {
  id: number
  source: string
  filename: string | null
  rows_processed: number
  rows_inserted: number
  status: "running" | "success" | "error" | "reverted"
  error_message: string | null
  started_at: string
  completed_at: string | null
}

interface UploadResult {
  ok?: boolean
  error?: string
  warning?: boolean
  rows_at_risk?: number
  rows_inserted?: number
  rows_total?: number
  rows_upserted?: number
  fecha_min?: string
  fecha_max?: string
  transacciones?: number
  sucursal_key?: string
  sucursal_nombre?: string
  periodo_inicio?: string
  periodo_fin?: string
  duration_ms?: number
  etl_run_id?: number
  sucursal_dist?: Record<string, number>
}

interface InventarioSucursalStatus {
  sucursal_key: string
  sucursal_nombre: string
  periodo_fin: string | null
  updated_at: string | null
}

interface CargaContentProps {
  logs: EtlLog[]
  ventasUltimaFecha: string | null
  inventarioStatus: InventarioSucursalStatus[]
}

// ─── Date helpers (deterministic — no locale dependency) ──────────────────────

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

function fmtDateShort(dateStr: string): string {
  const parts = dateStr.slice(0, 10).split("-").map(Number)
  return `${parts[2]} ${MONTHS_ES[parts[1] - 1]} ${parts[0]}`
}

function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Locale-safe number formatter
function fmtNum(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}

// ─── Status badges ────────────────────────────────────────────────────────────

function VentasStatusBadge({ ultimaFecha }: { ultimaFecha: string }) {
  const next = nextDayStr(ultimaFecha)
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 mb-3">
      <CalendarDays className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" />
      <div className="space-y-0.5">
        <p className="text-[11px] text-slate-500">
          Último dato:{" "}
          <span className="font-semibold text-slate-700">{fmtDateShort(ultimaFecha)}</span>
        </p>
        <p className="text-[11px] text-indigo-600 font-medium">
          → Cargar desde el {fmtDateShort(next)}
        </p>
      </div>
    </div>
  )
}

function InventarioStatusBadge({ sucursales }: { sucursales: InventarioSucursalStatus[] }) {
  // 45-day threshold for "recent" (amber if older, green if recent)
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 mb-3">
      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.07em] mb-2">
        Estado por sucursal
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {sucursales.map(s => {
          const dateStr = s.periodo_fin ?? s.updated_at?.slice(0, 10) ?? null
          const isRecent = dateStr ? dateStr >= cutoff : false
          return (
            <div key={s.sucursal_key} className="flex items-center gap-1.5 min-w-0">
              <span className={cn(
                "w-1.5 h-1.5 rounded-full flex-shrink-0",
                dateStr
                  ? isRecent ? "bg-emerald-400" : "bg-amber-400"
                  : "bg-slate-200"
              )} />
              <span className="text-[10px] text-slate-600 truncate min-w-0 flex-1">
                {s.sucursal_nombre}
              </span>
              <span className="text-[9px] text-slate-400 flex-shrink-0 tabular-nums">
                {dateStr ? fmtDateShort(dateStr) : "Sin datos"}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Upload Card ──────────────────────────────────────────────────────────────

type UploadState = "idle" | "uploading" | "warning" | "success" | "error"

function UploadCard({
  title,
  subtitle,
  icon: Icon,
  accept,
  endpoint,
  hint,
  accentColor,
  statusInfo,
}: {
  title: string
  subtitle: string
  icon: React.ElementType
  accept: string
  endpoint: string
  hint: string
  accentColor: "indigo" | "violet"
  statusInfo?: React.ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<UploadState>("idle")
  const [result, setResult] = useState<UploadResult | null>(null)
  const [fileName, setFileName] = useState("")
  const [progress, setProgress] = useState("")
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const colors = {
    indigo: {
      iconBg: "bg-indigo-50",
      icon: "text-indigo-600",
      link: "text-indigo-600",
      confirmBtn: "bg-indigo-600 hover:bg-indigo-700 text-white",
    },
    violet: {
      iconBg: "bg-violet-50",
      icon: "text-violet-600",
      link: "text-violet-600",
      confirmBtn: "bg-violet-600 hover:bg-violet-700 text-white",
    },
  }[accentColor]

  const handleFile = async (file: File, force = false) => {
    if (!file.name.endsWith(".xlsx")) {
      setState("error")
      setResult({ error: "Solo se aceptan archivos .xlsx" })
      return
    }
    setFileName(file.name)
    setState("uploading")
    setProgress("Procesando ETL…")

    const formData = new FormData()
    formData.append("file", file)

    const headers: HeadersInit = force ? { "X-Confirm": "true" } : {}

    try {
      const res = await fetch(endpoint, { method: "POST", body: formData, headers })
      const data: UploadResult = await res.json()

      if (data.warning) {
        setPendingFile(file)
        setResult(data)
        setState("warning")
        return
      }

      setResult(data)
      setState(data.ok ? "success" : "error")
      // Bust the Next.js App Router client cache so the dashboard re-fetches
      // fresh data (including the newly uploaded rows) on next navigation.
      if (data.ok) router.refresh()
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Error de red" })
      setState("error")
    }
  }

  const confirmOverwrite = () => {
    if (pendingFile) handleFile(pendingFile, true)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const reset = () => {
    setState("idle")
    setResult(null)
    setFileName("")
    setProgress("")
    setPendingFile(null)
  }

  return (
    <div className="bg-white rounded-xl card-shadow p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", colors.iconBg)}>
          <Icon className={cn("w-4.5 h-4.5", colors.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
        {state === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
        {state === "error"   && <XCircle      className="w-4 h-4 text-red-500 flex-shrink-0" />}
        {state === "warning" && <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
      </div>

      {/* Status info badge — visible only in idle/error state */}
      {statusInfo && (state === "idle" || state === "error") && statusInfo}

      {/* Drop zone */}
      {(state === "idle" || state === "error") && (
        <>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed cursor-pointer py-8 px-4 text-center transition-colors duration-150",
              "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50",
            )}
          >
            <Upload className="w-5 h-5 text-slate-300" />
            <p className="text-[12px] text-slate-500">
              Arrastra aquí o{" "}
              <span className={cn("font-medium underline underline-offset-2", colors.link)}>selecciona</span>
            </p>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{hint}</p>
            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
          </div>
          {state === "error" && result?.error && (
            <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
              <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-red-600">{result.error}</p>
            </div>
          )}
        </>
      )}

      {/* Uploading */}
      {state === "uploading" && (
        <div className="flex flex-col items-center gap-3 py-8 border-2 border-dashed border-slate-200 rounded-lg">
          <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
          <p className="text-[12px] text-slate-500">{progress}</p>
          {fileName && <p className="text-[10px] text-slate-400 font-mono truncate max-w-[90%]">{fileName}</p>}
        </div>
      )}

      {/* Warning — archivo cubre fechas de meses anteriores */}
      {state === "warning" && result?.warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-[12px] font-semibold text-amber-800">
                El archivo cubre fechas anteriores al mes actual
              </p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                Hay <span className="font-semibold">{fmtNum(result.rows_at_risk ?? 0)} filas</span> existentes
                desde <span className="font-semibold">{fmtDateShort(result.fecha_min ?? "")}</span> que serán
                borradas y reemplazadas por las del archivo.
              </p>
              {fileName && (
                <p className="text-[10px] text-amber-600 font-mono truncate">{fileName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reset}
              className="flex-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg py-1.5 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmOverwrite}
              className={cn(
                "flex-1 text-[11px] font-medium rounded-lg py-1.5 transition-colors",
                colors.confirmBtn
              )}
            >
              Sí, reemplazar
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {state === "success" && result && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <StatPill
              label="Filas"
              value={fmtNum(result.rows_inserted ?? result.rows_upserted ?? 0)}
              color="emerald"
            />
            {result.transacciones !== undefined && (
              <StatPill label="Tickets" value={fmtNum(result.transacciones)} color="indigo" />
            )}
            {result.fecha_min && (
              <StatPill
                label="Período"
                value={`${result.fecha_min} → ${result.fecha_max}`}
                color="slate"
                wide
              />
            )}
            {result.sucursal_nombre && (
              <StatPill label="Sucursal" value={result.sucursal_nombre} color="indigo" />
            )}
            {result.periodo_inicio && (
              <StatPill
                label="Período kardex"
                value={`${result.periodo_inicio} → ${result.periodo_fin}`}
                color="slate"
                wide
              />
            )}
            {result.duration_ms !== undefined && (
              <StatPill label="Tiempo" value={`${(result.duration_ms / 1000).toFixed(1)}s`} color="slate" />
            )}
          </div>

          {/* Validation badges — only shown for ventas uploads */}
          {result.sucursal_dist && (() => {
            const unknownCount = result.sucursal_dist["UNKNOWN"] ?? 0
            const knownCount = Object.entries(result.sucursal_dist)
              .filter(([k]) => k !== "UNKNOWN")
              .reduce((s, [, v]) => s + v, 0)
            return (
              <div className="space-y-1.5 pt-0.5">
                {unknownCount > 0 && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-px" />
                    <p className="text-[10px] text-amber-700 leading-relaxed">
                      <span className="font-semibold">{fmtNum(unknownCount)} filas</span> sin sucursal reconocida
                      {knownCount > 0 && ` · ${fmtNum(knownCount)} correctas`}.{" "}
                      Verifica que los folios del archivo correspondan al ERP de Deus (prefijos A–N, PS).
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                  <p className="text-[10px] text-emerald-700 font-medium">
                    Datos listos —{" "}
                    <a href="/inicio" className="underline font-semibold">
                      ver en Resumen
                    </a>
                  </p>
                </div>
              </div>
            )
          })()}

          <button
            onClick={reset}
            className="w-full mt-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors py-1"
          >
            Cargar otro archivo
          </button>
        </div>
      )}
    </div>
  )
}

function StatPill({
  label,
  value,
  color,
  wide = false,
}: {
  label: string
  value: string
  color: "emerald" | "indigo" | "slate"
  wide?: boolean
}) {
  return (
    <div className={cn("rounded-lg bg-slate-50 px-3 py-2", wide && "col-span-2")}>
      <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-[0.07em]">{label}</p>
      <p className={cn(
        "text-[12px] font-semibold mt-0.5 truncate",
        color === "emerald" && "text-emerald-700",
        color === "indigo"  && "text-indigo-700",
        color === "slate"   && "text-slate-600",
      )}>
        {value}
      </p>
    </div>
  )
}

// ─── ETL History ──────────────────────────────────────────────────────────────

function EtlHistory({ logs }: { logs: EtlLog[] }) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [revertingId, setRevertingId] = useState<number | null>(null)
  const [revertResult, setRevertResult] = useState<{ id: number; rowsDeleted: number; ok: boolean } | null>(null)

  if (logs.length === 0) return null

  const doRevert = async (id: number) => {
    setRevertingId(id)
    setConfirmId(null)
    setRevertResult(null)
    try {
      const res = await fetch("/api/carga/revert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etl_run_id: id }),
      })
      const data = await res.json()
      setRevertResult({ id, rowsDeleted: data.rows_deleted ?? 0, ok: data.ok === true })
      router.refresh()
    } catch {
      setRevertResult({ id, rowsDeleted: 0, ok: false })
    } finally {
      setRevertingId(null)
    }
  }

  return (
    <div className="bg-white rounded-xl card-shadow p-5">
      <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.07em] mb-3">
        Historial reciente
      </h3>
      <div className="space-y-1.5">
        {logs.map(log => (
          <div key={log.id}>
            <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors group">
              {log.status === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              ) : log.status === "reverted" ? (
                <Undo2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              ) : log.status === "error" ? (
                <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[11px] truncate font-medium",
                  log.status === "reverted" ? "text-slate-400 line-through" : "text-slate-600",
                )}>
                  {log.filename ?? log.source}
                </p>
                {log.error_message && log.status !== "reverted" && (
                  <p className="text-[10px] text-red-500 truncate">{log.error_message}</p>
                )}
                {log.status === "reverted" && (
                  <p className="text-[10px] text-slate-400">
                    {log.error_message?.startsWith("Revertido") ? log.error_message : "Revertida"}
                  </p>
                )}
              </div>

              <div className="text-right flex-shrink-0">
                {log.rows_inserted > 0 && log.status !== "reverted" && (
                  <p className="text-[10px] text-slate-500 font-medium">{fmtNum(log.rows_inserted)} filas</p>
                )}
                <p className="text-[9px] text-slate-400" suppressHydrationWarning>
                  {new Date(log.started_at).toLocaleDateString("es-MX", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>

              {log.status === "success" && log.source === "erp_import" && (
                <button
                  onClick={() => setConfirmId(confirmId === log.id ? null : log.id)}
                  title="Revertir esta carga"
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400"
                >
                  <Undo2 className="w-3 h-3" />
                </button>
              )}

              {revertingId === log.id && (
                <RefreshCw className="w-3 h-3 text-slate-400 animate-spin ml-1 flex-shrink-0" />
              )}
            </div>

            {confirmId === log.id && (
              <div className="mx-3 mb-1.5 rounded-lg bg-red-50 border border-red-100 px-3 py-2.5 flex items-center gap-3">
                <p className="text-[11px] text-red-700 flex-1">
                  ¿Eliminar las <span className="font-semibold">{fmtNum(log.rows_inserted)} filas</span> de esta carga?
                </p>
                <button
                  onClick={() => setConfirmId(null)}
                  className="text-[10px] font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-white transition-colors"
                >
                  No
                </button>
                <button
                  onClick={() => doRevert(log.id)}
                  className="text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded transition-colors"
                >
                  Sí, revertir
                </button>
              </div>
            )}

            {revertResult?.id === log.id && (
              <div className={cn(
                "mx-3 mb-1.5 rounded-lg px-3 py-2 flex items-center gap-2",
                revertResult.ok
                  ? "bg-emerald-50 border border-emerald-100"
                  : "bg-red-50 border border-red-100",
              )}>
                {revertResult.ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                )}
                <p className={cn(
                  "text-[11px]",
                  revertResult.ok ? "text-emerald-700" : "text-red-600",
                )}>
                  {revertResult.ok
                    ? <><span className="font-semibold">{fmtNum(revertResult.rowsDeleted)} filas eliminadas</span> del sistema correctamente</>
                    : "Error al revertir — revisa la consola del servidor"}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CargaContent({ logs, ventasUltimaFecha, inventarioStatus }: CargaContentProps) {
  return (
    <div className="px-6 py-6 max-w-3xl mx-auto space-y-5">

      {/* Instructions */}
      <div className="bg-white rounded-xl card-shadow px-5 py-4">
        <p className="text-[12px] text-slate-500 leading-relaxed">
          Exporta los reportes directamente desde{" "}
          <span className="text-slate-800 font-semibold">Microsip ERP</span> y súbelos aquí.
          El sistema corre el ETL automáticamente y actualiza el dashboard sin herramientas externas.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <Step num="1" text="Ventas: Diario de ventas de mostrador (.xlsx)" />
          <Step num="2" text="Inventario: Kardex de artículos por sucursal (.xlsx)" />
          <Step num="3" text="El dashboard se actualiza automáticamente" />
          <Step num="4" text="Repite para cada sucursal del inventario" />
        </div>
      </div>

      {/* Upload cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <UploadCard
          title="Ventas"
          subtitle="Diario de ventas de mostrador"
          icon={TrendingUp}
          accept=".xlsx"
          endpoint="/api/carga/ventas"
          hint="Reporte de ventas Microsip .xlsx"
          accentColor="indigo"
          statusInfo={
            ventasUltimaFecha
              ? <VentasStatusBadge ultimaFecha={ventasUltimaFecha} />
              : undefined
          }
        />
        <UploadCard
          title="Inventario"
          subtitle="Kardex por sucursal (una a la vez)"
          icon={Package}
          accept=".xlsx"
          endpoint="/api/carga/inventario"
          hint="Kardex de artículos Microsip .xlsx"
          accentColor="violet"
          statusInfo={
            inventarioStatus.length > 0
              ? <InventarioStatusBadge sucursales={inventarioStatus} />
              : undefined
          }
        />
      </div>

      {/* Note */}
      <div className="flex items-center gap-2 px-1">
        <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
        <p className="text-[10px] text-slate-400">
          El inventario se carga sucursal por sucursal. Sube los 6 archivos de Kardex para datos completos.
        </p>
      </div>

      {/* ETL history */}
      <EtlHistory logs={logs} />

      {/* Recovery tool */}
      <SeedCsvPanel />

    </div>
  )
}

// ─── Recovery: seed from CSV ──────────────────────────────────────────────────

function SeedCsvPanel() {
  const router = useRouter()
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [result, setResult] = useState<{ rows_inserted?: number; fecha_min?: string; fecha_max?: string; duration_ms?: number; error?: string } | null>(null)

  const doSeed = async () => {
    setState("loading")
    setResult(null)
    try {
      const res = await fetch("/api/admin/seed-csv", { method: "POST" })
      const data = await res.json()
      setResult(data)
      setState(data.ok ? "success" : "error")
      if (data.ok) router.refresh()
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Error de red" })
      setState("error")
    }
  }

  return (
    <div className="border border-dashed border-slate-200 rounded-xl px-4 py-3">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.07em] mb-2">
        Recuperación de datos
      </p>
      {state === "idle" && (
        <div className="flex items-start gap-3">
          <p className="text-[11px] text-slate-500 flex-1 leading-relaxed">
            Si <code className="bg-slate-100 px-1 rounded text-slate-700">ventas_lineas</code> está vacío o incompleto,
            puedes restablecer los datos históricos del CSV base (Abr 2023 – May 2026).
          </p>
          <button
            onClick={doSeed}
            className="flex-shrink-0 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-400 rounded-lg px-3 py-1.5 transition-colors bg-indigo-50 hover:bg-indigo-100"
          >
            Restaurar CSV
          </button>
        </div>
      )}
      {state === "loading" && (
        <div className="flex items-center gap-2 py-1">
          <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin flex-shrink-0" />
          <p className="text-[11px] text-slate-500">Importando 185,318 filas desde CSV — puede tardar 1-2 minutos…</p>
        </div>
      )}
      {state === "success" && result && (
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-px" />
          <div className="text-[11px] text-emerald-700">
            <span className="font-semibold">{fmtNum(result.rows_inserted ?? 0)} filas restauradas</span>
            {result.fecha_min && <> · {result.fecha_min} → {result.fecha_max}</>}
            {result.duration_ms && <> · {(result.duration_ms / 1000).toFixed(1)}s</>}
          </div>
        </div>
      )}
      {state === "error" && result && (
        <div className="flex items-start gap-2">
          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-px" />
          <p className="text-[11px] text-red-600">{result.error}</p>
        </div>
      )}
    </div>
  )
}

function Step({ num, text }: { num: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-100 text-indigo-600 text-[9px] font-bold flex items-center justify-center mt-0.5">
        {num}
      </span>
      <p className="text-[11px] text-slate-500">{text}</p>
    </div>
  )
}
