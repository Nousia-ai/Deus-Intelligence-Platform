import { NextResponse } from "next/server"
import { computeDashboardSummary } from "@/lib/analytics"

export const dynamic = "force-static"
export const revalidate = 3600

export async function GET() {
  try {
    const data = computeDashboardSummary()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json({ error: "Failed to compute analytics" }, { status: 500 })
  }
}
