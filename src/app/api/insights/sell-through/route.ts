import { NextResponse } from "next/server"
import { getSellThroughMatrix } from "@/lib/inventory"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET() {
  const rows = await getSellThroughMatrix()
  return NextResponse.json(rows)
}
