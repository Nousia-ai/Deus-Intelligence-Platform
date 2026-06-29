import { NextRequest } from "next/server"
import OpenAI from "openai"
import { computeDashboardSummary } from "@/lib/analytics"
import { supabase } from "@/lib/supabase"

export const runtime = "nodejs"
export const maxDuration = 60

const BRANCH_NAMES: Record<string, string> = {
  "16S001": "16 de Septiembre",
  ATL001: "Atlixco",
  CSU001: "Centro Sur",
  CHO001: "Cholula",
  CRZ001: "Cruz del Sur",
  SND001: "San Diego",
}

const PHYSICAL_BRANCHES = ["16S001", "ATL001", "CSU001", "CHO001", "CRZ001", "SND001"]
const MONTH_LABELS = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

// ── Tool definitions ──────────────────────────────────────────────────────────

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_resumen_general",
      description:
        "Obtiene el resumen general del negocio: ingresos totales, unidades, margen, ticket promedio, top categorías y marcas. Puede filtrarse por año y/o mes. El mes más reciente con datos completos es mayo 2026 (año=2026, mes=5).",
      parameters: {
        type: "object",
        properties: {
          año: { type: "number", description: "Año a filtrar (ej. 2025). Omitir para todos los años." },
          mes: { type: "number", description: "Mes a filtrar 1–12. Omitir para todos los meses." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_rendimiento_sucursales",
      description:
        "Compara el rendimiento de las 6 sucursales físicas: ingresos, margen, unidades, share del total. Puede filtrarse por año y/o mes. El mes más reciente con datos completos es mayo 2026 (año=2026, mes=5).",
      parameters: {
        type: "object",
        properties: {
          año: { type: "number", description: "Año (ej. 2025)." },
          mes: { type: "number", description: "Mes 1–12." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tendencias_temporales",
      description:
        "Muestra tendencias de venta mes a mes, comparación año a año (YoY) y patrones por día de la semana.",
      parameters: {
        type: "object",
        properties: {
          años: {
            type: "array",
            items: { type: "number" },
            description: "Lista de años a incluir (ej. [2024, 2025]). Omitir para todos.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_productos",
      description:
        "Muestra los productos (SKUs), categorías y marcas con mejor desempeño en revenue, unidades o margen. Soporta filtro por año, mes y sucursal para análisis de períodos específicos.",
      parameters: {
        type: "object",
        properties: {
          limite: { type: "number", description: "Número de resultados a mostrar (default 10, máx 20)." },
          metrica: {
            type: "string",
            enum: ["revenue", "units", "margen"],
            description: "Métrica para ordenar (default revenue).",
          },
          año: { type: "number", description: "Año a filtrar (ej. 2025). Omitir para histórico." },
          mes: { type: "number", description: "Mes a filtrar 1–12 (ej. 5 = mayo). Omitir para todo el año." },
          sucursal: { type: "string", description: "Nombre de sucursal (ej. 'Centro Sur', 'Atlixco'). Omitir para todas." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_analisis_descuentos",
      description:
        "Analiza el comportamiento de descuentos: porcentaje de ventas con descuento, profundidad promedio y revenue sacrificado.",
      parameters: {
        type: "object",
        properties: {
          año: { type: "number" },
          mes: { type: "number" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_inventario_alertas",
      description:
        "Consulta el estado del inventario: alertas por nivel (ROJA/NARANJA/AMARILLA), semanas de stock, productos parados. Puede filtrarse por sucursal y nivel de alerta.",
      parameters: {
        type: "object",
        properties: {
          sucursal: {
            type: "string",
            description:
              "Nombre o clave de sucursal (ej. 'Centro Sur', 'Atlixco', 'San Diego', etc.). Omitir para todas.",
          },
          nivel_alerta: {
            type: "string",
            enum: ["ROJA", "NARANJA", "AMARILLA"],
            description: "Filtrar por nivel de alerta.",
          },
        },
      },
    },
  },
]

// ── Tool executors ────────────────────────────────────────────────────────────

function periodLabel(año?: number, mes?: number): string {
  if (año && mes) return `${MONTH_LABELS[mes]} ${año}`
  if (año) return `año ${año}`
  return "histórico (Abr 2023 – May 2026)"
}

function filterByPeriod(key: string, año?: number, mes?: number): boolean {
  if (!año && !mes) return true
  const [y, m] = key.split("-").map(Number)
  if (año && y !== año) return false
  if (mes && m !== mes) return false
  return true
}

function executeGetResumenGeneral(args: { año?: number; mes?: number }) {
  const data = computeDashboardSummary()
  const { año, mes } = args

  let revenue = 0
  let units = 0

  for (const branch of PHYSICAL_BRANCHES) {
    for (const [key, rev] of Object.entries(data.branchMonthMatrix[branch] ?? {})) {
      if (filterByPeriod(key, año, mes)) revenue += rev
    }
    for (const [key, u] of Object.entries(data.branchMonthUnitsMatrix[branch] ?? {})) {
      if (filterByPeriod(key, año, mes)) units += u
    }
  }

  if (!año && !mes) {
    revenue = data.physicalTotalRevenue
    units = data.physicalTotalUnits
  }

  return {
    periodo: periodLabel(año, mes),
    ingresos_totales: `$${(revenue / 1_000_000).toFixed(2)}M MXN`,
    unidades_vendidas: units.toLocaleString("es-MX"),
    margen_bruto_pct: `${(data.ceoKPIs.margenBrutoPct * 100).toFixed(1)}%`,
    ticket_promedio_atv: `$${data.ceoKPIs.atv.toFixed(0)} MXN`,
    upt: data.ceoKPIs.upt.toFixed(2),
    ingresos_por_año: Object.entries(data.physicalRevenueByYear)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([y, r]) => `${y}: $${(r / 1_000_000).toFixed(2)}M`)
      .join(" | "),
    top_categorias: data.revenueByCategory.slice(0, 5).map((c) => ({
      categoria: c.categoria,
      revenue: `$${(c.revenue / 1_000_000).toFixed(2)}M`,
      share: `${(c.revenueShare * 100).toFixed(1)}%`,
    })),
    top_marcas: data.topBrands.slice(0, 5).map((b) => ({
      marca: b.marca,
      revenue: `$${(b.revenue / 1_000_000).toFixed(2)}M`,
      share: `${(b.share * 100).toFixed(1)}%`,
    })),
  }
}

function executeGetRendimientoSucursales(args: { año?: number; mes?: number }) {
  const data = computeDashboardSummary()
  const { año, mes } = args

  const branchRevenue: Record<string, number> = {}
  const branchUnits: Record<string, number> = {}
  const branchMargin: Record<string, { gm: number; neto: number }> = {}

  for (const branch of PHYSICAL_BRANCHES) {
    let rev = 0, u = 0, gm = 0, neto = 0

    for (const [key, r] of Object.entries(data.branchMonthMatrix[branch] ?? {})) {
      if (filterByPeriod(key, año, mes)) rev += r
    }
    for (const [key, units] of Object.entries(data.branchMonthUnitsMatrix[branch] ?? {})) {
      if (filterByPeriod(key, año, mes)) u += units
    }
    for (const [key, mg] of Object.entries(data.branchMonthMarginMatrix[branch] ?? {})) {
      if (filterByPeriod(key, año, mes)) {
        gm += mg.grossMargin
        neto += mg.importe_neto
      }
    }

    branchRevenue[branch] = rev
    branchUnits[branch] = u
    branchMargin[branch] = { gm, neto }
  }

  const totalRev = Object.values(branchRevenue).reduce((a, b) => a + b, 0)

  const ranked = PHYSICAL_BRANCHES
    .sort((a, b) => branchRevenue[b] - branchRevenue[a])
    .map((id, i) => ({
      ranking: i + 1,
      sucursal: BRANCH_NAMES[id] ?? id,
      revenue: `$${(branchRevenue[id] / 1_000_000).toFixed(2)}M`,
      share: totalRev > 0 ? `${((branchRevenue[id] / totalRev) * 100).toFixed(1)}%` : "N/A",
      unidades: branchUnits[id].toLocaleString("es-MX"),
      margen_pct:
        branchMargin[id].neto > 0
          ? `${((branchMargin[id].gm / branchMargin[id].neto) * 100).toFixed(1)}%`
          : "N/D",
    }))

  return { periodo: periodLabel(año, mes), sucursales: ranked }
}

function executeGetTendenciasTemporales(args: { años?: number[] }) {
  const data = computeDashboardSummary()
  const años = args.años

  const mensual = data.revenueByMonth
    .filter((m) => !años || años.includes(m.año))
    .map((m) => ({
      periodo: `${MONTH_LABELS[m.mes]} ${m.año}`,
      revenue: `$${(m.revenue / 1_000_000).toFixed(2)}M`,
      unidades: m.units.toLocaleString("es-MX"),
      ticket_promedio: `$${m.avgTicket.toFixed(0)}`,
    }))

  const porAño = Object.entries(data.physicalRevenueByYear)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([y, r]) => ({ año: y, revenue: `$${(r / 1_000_000).toFixed(2)}M` }))

  const diasSemana = data.dayOfWeek.map((d) => ({
    dia: d.label,
    revenue: `$${(d.revenue / 1_000_000).toFixed(2)}M`,
    unidades: d.units.toLocaleString("es-MX"),
  }))

  return {
    tendencia_mensual: mensual.slice(-24),
    resumen_por_año: porAño,
    patron_dia_semana: diasSemana,
    contexto: "Diciembre es ~3× el promedio mensual. Viernes–Domingo representan ~53% del ingreso semanal.",
  }
}

function executeGetTopProductos(args: { limite?: number; metrica?: string; año?: number; mes?: number; sucursal?: string }) {
  const data = computeDashboardSummary()
  const limite = Math.min(args.limite ?? 10, 20)
  const metrica = args.metrica ?? "revenue"
  const { año, mes, sucursal } = args

  // Resolve branch filter
  const branches = sucursal
    ? PHYSICAL_BRANCHES.filter(b =>
        BRANCH_NAMES[b]?.toLowerCase().includes(sucursal.toLowerCase()) ||
        b.toLowerCase() === sucursal.toLowerCase()
      )
    : PHYSICAL_BRANCHES

  // If no period specified, use pre-computed aggregates (faster)
  if (!año && !mes) {
    const topSKUs = [...data.ceoKPIs.topSKUs]
      .sort((a, b) =>
        metrica === "units" ? b.units - a.units :
        metrica === "margen" ? b.grossMargin - a.grossMargin :
        b.revenue - a.revenue
      )
      .slice(0, limite)
      .map((s) => ({
        sku: s.sku_padre,
        nombre: data.skuNameMap[s.sku_padre] ?? s.sku_padre,
        revenue: `$${(s.revenue / 1_000).toFixed(0)}K`,
        unidades: s.units.toLocaleString("es-MX"),
        margen_pct: `${(s.marginPct * 100).toFixed(1)}%`,
        descuento_pct: `${(s.discountPct * 100).toFixed(1)}%`,
      }))

    return {
      periodo: "histórico (Abr 2023 – May 2026)",
      top_skus: topSKUs,
      top_categorias: data.revenueByCategory.slice(0, 8).map((c) => ({
        categoria: c.categoria,
        revenue: `$${(c.revenue / 1_000_000).toFixed(2)}M`,
        share: `${(c.revenueShare * 100).toFixed(1)}%`,
        margen_pct: c.marginPct ? `${(c.marginPct * 100).toFixed(1)}%` : "N/D",
      })),
      top_marcas: data.topBrands.slice(0, 10).map((b) => ({
        marca: b.marca,
        revenue: `$${(b.revenue / 1_000_000).toFixed(2)}M`,
        share: `${(b.share * 100).toFixed(1)}%`,
      })),
      concentracion: {
        top_3_skus: `${(data.ceoKPIs.top3Concentration * 100).toFixed(1)}%`,
        top_10_skus: `${(data.ceoKPIs.top10Concentration * 100).toFixed(1)}%`,
        top_20_skus: `${(data.ceoKPIs.top20Concentration * 100).toFixed(1)}%`,
      },
    }
  }

  // Period-filtered: aggregate from branchMonthSKUMatrix
  const skuAgg: Record<string, { revenue: number; units: number; grossMargin: number; importe_neto: number }> = {}

  for (const branch of branches) {
    for (const [key, skus] of Object.entries(data.branchMonthSKUMatrix[branch] ?? {})) {
      if (!filterByPeriod(key, año, mes)) continue
      for (const [sku, vals] of Object.entries(skus)) {
        if (!skuAgg[sku]) skuAgg[sku] = { revenue: 0, units: 0, grossMargin: 0, importe_neto: 0 }
        skuAgg[sku].revenue += vals.revenue
        skuAgg[sku].units += vals.units
        skuAgg[sku].grossMargin += vals.grossMargin
        skuAgg[sku].importe_neto += vals.importe_neto_mar
      }
    }
  }

  if (Object.keys(skuAgg).length === 0) {
    return { periodo: periodLabel(año, mes), mensaje: "No hay datos de productos para ese período. El rango disponible es Abr 2023 – May 2026." }
  }

  const topSKUs = Object.entries(skuAgg)
    .map(([sku, v]) => ({
      sku,
      revenue: v.revenue,
      units: v.units,
      grossMargin: v.grossMargin,
      marginPct: v.importe_neto > 0 ? v.grossMargin / v.importe_neto : 0,
    }))
    .sort((a, b) =>
      metrica === "units" ? b.units - a.units :
      metrica === "margen" ? b.grossMargin - a.grossMargin :
      b.revenue - a.revenue
    )
    .slice(0, limite)
    .map((s) => ({
      sku: s.sku,
      nombre: data.skuNameMap[s.sku] ?? s.sku,
      revenue: `$${(s.revenue / 1_000).toFixed(0)}K`,
      unidades: s.units.toLocaleString("es-MX"),
      margen_pct: `${(s.marginPct * 100).toFixed(1)}%`,
    }))

  return {
    periodo: periodLabel(año, mes) + (sucursal ? ` · ${sucursal}` : " · todas las sucursales"),
    top_skus: topSKUs,
    nota: `Muestra top ${topSKUs.length} de ${Object.keys(skuAgg).length} SKUs con venta en el período.`,
  }
}

function executeGetAnalisisDescuentos(args: { año?: number; mes?: number }) {
  const data = computeDashboardSummary()
  const { año, mes } = args

  let revConDesc = 0, totRev = 0, unidConDesc = 0, totUnid = 0, profNum = 0

  for (const branch of PHYSICAL_BRANCHES) {
    for (const [key, d] of Object.entries(data.discountMonthMatrix[branch] ?? {})) {
      if (!filterByPeriod(key, año, mes)) continue
      revConDesc += d.revConDesc
      totRev += d.totRev
      unidConDesc += d.unidConDesc
      totUnid += d.totUnid
      profNum += d.profNum
    }
  }

  const pctRevConDesc = totRev > 0 ? revConDesc / totRev : 0
  const profundidad = revConDesc > 0 ? profNum / revConDesc : 0
  const revSacrificado = profundidad * revConDesc

  return {
    periodo: periodLabel(año, mes),
    pct_revenue_con_descuento: `${(pctRevConDesc * 100).toFixed(1)}%`,
    pct_unidades_con_descuento: totUnid > 0 ? `${((unidConDesc / totUnid) * 100).toFixed(1)}%` : "N/D",
    profundidad_promedio: `${(profundidad * 100).toFixed(1)}%`,
    revenue_sacrificado: `$${(revSacrificado / 1_000).toFixed(0)}K MXN`,
    revenue_total_con_descuento: `$${(revConDesc / 1_000_000).toFixed(2)}M`,
    contexto: "La mediana de descuento es 0% — la mayoría de ventas son a precio completo.",
  }
}

// Inventory keys differ between inventory_kpis and analytics
const SUCURSAL_KEY_MAP: Record<string, string> = {
  "16 de septiembre": "16S",
  "16sep": "16S",
  "16s": "16S",
  atlixco: "atlx",
  atl: "atlx",
  "centro sur": "cs",
  centrosur: "cs",
  cs: "cs",
  cholula: "chol",
  chol: "chol",
  "cruz del sur": "czsr",
  cruzdelsur: "czsr",
  czsr: "czsr",
  "san diego": "sd",
  sandiego: "sd",
  sd: "sd",
}

async function executeGetInventarioAlertas(args: { sucursal?: string; nivel_alerta?: string }) {
  if (!supabase) return { error: "Supabase no disponible." }

  let query = supabase
    .from("inventory_kpis")
    .select(
      "sucursal_nombre,sucursal_key,nivel_alerta,bucket_aging,weeks_of_supply," +
      "sku_padre,descripcion,marca,tipo_producto,unidades_disponibles,sell_through,demand_index"
    )
    .order("nivel_alerta", { ascending: true })
    .limit(300)

  if (args.sucursal) {
    const normalized = args.sucursal.toLowerCase().replace(/\s+/g, "")
    const key = SUCURSAL_KEY_MAP[normalized] ?? SUCURSAL_KEY_MAP[args.sucursal.toLowerCase()] ?? args.sucursal
    query = query.eq("sucursal_key", key)
  }
  if (args.nivel_alerta) {
    query = query.eq("nivel_alerta", args.nivel_alerta)
  }

  const { data: rawData, error } = await query
  if (error) return { error: error.message }
  if (!rawData?.length) return { mensaje: "No se encontraron registros con esos filtros." }

  type AlertRow = {
    sucursal_nombre: string | null
    sucursal_key: string | null
    nivel_alerta: string | null
    bucket_aging: string | null
    weeks_of_supply: number | null
    sku_padre: string | null
    descripcion: string | null
    marca: string | null
    tipo_producto: string | null
    unidades_disponibles: number | null
    sell_through: number | null
    demand_index: number | null
  }
  const data = rawData as unknown as AlertRow[]

  // Aggregate by sucursal × nivel_alerta
  const resumen: Record<string, Record<string, number>> = {}
  const criticas: AlertRow[] = []

  for (const row of data) {
    const suc = row.sucursal_nombre ?? row.sucursal_key ?? "Desconocida"
    const nivel = row.nivel_alerta ?? "Sin alerta"
    if (!resumen[suc]) resumen[suc] = {}
    resumen[suc][nivel] = (resumen[suc][nivel] ?? 0) + 1
    if (row.nivel_alerta === "ROJA") criticas.push(row)
  }

  return {
    total_skus_analizados: data.length,
    resumen_por_sucursal: Object.entries(resumen).map(([suc, niveles]) => ({
      sucursal: suc,
      alertas: niveles,
    })),
    muestra_alertas_rojas: criticas.slice(0, 8).map((r) => ({
      sku: r.sku_padre,
      descripcion: r.descripcion,
      marca: r.marca,
      tipo: r.tipo_producto,
      sucursal: r.sucursal_nombre,
      unidades: r.unidades_disponibles,
      sell_through: r.sell_through != null ? `${(r.sell_through * 100).toFixed(1)}%` : "N/D",
      semanas_de_stock: r.weeks_of_supply?.toFixed(1) ?? "N/D",
      aging: r.bucket_aging,
    })),
    contexto:
      "ROJA = producto crítico (parado >180 días o sell-through <10%). NARANJA = riesgo moderado. AMARILLA = atención requerida.",
  }
}

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el asesor de negocio personal de Germán, CEO de Deus Store — una cadena de moda con 6 sucursales físicas en Puebla, México: 16 de Septiembre, Atlixco, Centro Sur, Cholula, Cruz del Sur y San Diego.

Tu objetivo es ayudar a Germán a entender su negocio y tomar mejores decisiones. Germán NO es experto en análisis de datos, así que tu trabajo es traducir los números a lenguaje claro y accionable.

ESTRUCTURA OBLIGATORIA DE CADA RESPUESTA:
1. Los números clave (máximo 4-5, los más relevantes para la pregunta)
2. Qué significa esto para el negocio (1-2 oraciones en lenguaje simple, sin jerga)
3. Una recomendación o acción concreta que Germán puede tomar
4. Al final, SIEMPRE escribe 2-3 preguntas de seguimiento relevantes. Cada una en su propia línea, empezando con ¿ y terminando con ?. No escribas nada después de las preguntas.

REGLAS DE COMUNICACIÓN:
- Responde SIEMPRE en español.
- Cuando uses términos técnicos de BI, explícalos en paréntesis la primera vez. Ejemplos: "sell-through (qué porcentaje del inventario se vendió)", "ATV (ticket promedio por compra)", "margen bruto (lo que queda después de descontar el costo del producto)".
- Usa $ y millones (M) para dinero. Ej: $3.2M MXN.
- Si una tabla tiene más de 6 filas, muestra las más importantes y menciona que hay más datos disponibles.
- Sé conciso: máximo 150 palabras por respuesta, excluyendo tablas.
- Nunca inventes cifras. Si los datos no están disponibles, dilo claramente.
- Si la pregunta es ambigua (por ejemplo "¿cómo vamos?"), asume que se refiere al mes/año más reciente disponible y menciona el período que estás mostrando.
- Tono: como un asesor de confianza, no como un reporte corporativo.

FECHAS Y DISPONIBILIDAD DE DATOS:
- Hoy es 23 de junio de 2026.
- El rango de datos disponible es: Abril 2023 – Mayo 2026 (el mes más reciente con datos completos es MAYO 2026).
- JUNIO 2026 NO tiene datos aún. Si alguien pregunta por "junio" o "este mes", responde: "Aún no tenemos datos de junio 2026. El período más reciente disponible es mayo 2026." y luego muestra los datos de mayo 2026.
- Cuando alguien pregunte "cuánto vendimos este año" o "en 2026", los datos disponibles son enero–mayo 2026 (5 meses).

CONTEXTO DEL NEGOCIO:
- Datos históricos: Abril 2023 – Mayo 2026 (~$52.7M MXN en 3 años, solo tiendas físicas)
- Margen bruto promedio: ~50.7% (es decir, por cada $100 que vende, quedan ~$50 después del costo)
- Sucursal líder por ventas: Centro Sur, seguida de San Diego
- Pico estacional: diciembre es ~3× el promedio mensual
- Fin de semana (Vie–Dom): ~53% del ingreso semanal
- Marca propia DEUS: ~23% del ingreso total
- La mayoría de ventas son a precio completo — los descuentos son la excepción, no la regla`

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // process.env can be stale if a system env var overrides .env.local.
  // Read .env.local directly so the correct key always wins in development.
  let apiKey = process.env.OPENAI_API_KEY
  try {
    const fs = await import("fs")
    const path = await import("path")
    const raw = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    const match = raw.match(/^OPENAI_API_KEY=(.+)$/m)
    if (match) apiKey = match[1].trim()
  } catch { /* .env.local not present — fall back to process.env */ }

  if (!apiKey) {
    return new Response("OPENAI_API_KEY no configurada.", { status: 500 })
  }

  const openai = new OpenAI({ apiKey })
  const { messages } = await req.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const msgs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ]

        // Loop to handle chained tool calls server-side (max 5 iterations)
        for (let iter = 0; iter < 5; iter++) {
          const isLastIter = iter === 4

          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: msgs,
            tools: isLastIter ? undefined : tools,
            stream: true,
          })

          let assistantText = ""
          const toolCalls: Array<{
            index: number
            id: string
            name: string
            args: string
          }> = []
          let finishReason = ""

          for await (const chunk of response) {
            const choice = chunk.choices[0]
            if (!choice) continue
            finishReason = choice.finish_reason ?? finishReason

            const delta = choice.delta
            if (delta.content) {
              assistantText += delta.content
              controller.enqueue(encoder.encode(delta.content))
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolCalls[idx]) {
                  toolCalls[idx] = { index: idx, id: "", name: "", args: "" }
                }
                if (tc.id) toolCalls[idx].id += tc.id
                if (tc.function?.name) toolCalls[idx].name += tc.function.name
                if (tc.function?.arguments) toolCalls[idx].args += tc.function.arguments
              }
            }
          }

          // No tool calls — we have the final response
          if (finishReason !== "tool_calls" || toolCalls.length === 0) break

          // Add the assistant's tool-call message
          msgs.push({
            role: "assistant",
            content: assistantText || null,
            tool_calls: toolCalls.filter(Boolean).map((tc) => ({
              id: tc.id,
              type: "function" as const,
              function: { name: tc.name, arguments: tc.args },
            })),
          })

          // Execute each tool and append results
          for (const tc of toolCalls.filter(Boolean)) {
            let fnArgs: Record<string, unknown> = {}
            try {
              fnArgs = JSON.parse(tc.args || "{}")
            } catch {
              // ignore parse errors
            }

            let result: unknown
            try {
              switch (tc.name) {
                case "get_resumen_general":
                  result = executeGetResumenGeneral(fnArgs as { año?: number; mes?: number })
                  break
                case "get_rendimiento_sucursales":
                  result = executeGetRendimientoSucursales(fnArgs as { año?: number; mes?: number })
                  break
                case "get_tendencias_temporales":
                  result = executeGetTendenciasTemporales(fnArgs as { años?: number[] })
                  break
                case "get_top_productos":
                  result = executeGetTopProductos(fnArgs as { limite?: number; metrica?: string })
                  break
                case "get_analisis_descuentos":
                  result = executeGetAnalisisDescuentos(fnArgs as { año?: number; mes?: number })
                  break
                case "get_inventario_alertas":
                  result = await executeGetInventarioAlertas(
                    fnArgs as { sucursal?: string; nivel_alerta?: string }
                  )
                  break
                default:
                  result = { error: `Función desconocida: ${tc.name}` }
              }
            } catch (e) {
              result = { error: String(e) }
            }

            msgs.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            })
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Error interno."
        controller.enqueue(encoder.encode(`\n\nError: ${msg}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
