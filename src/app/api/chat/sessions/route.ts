import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export const runtime = "nodejs"

export async function GET() {
  if (!supabase) return NextResponse.json({ error: "DB no disponible" }, { status: 500 })

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, title, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (!supabase) return NextResponse.json({ error: "DB no disponible" }, { status: 500 })

  const { title } = await req.json()

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ title: (title as string | undefined)?.slice(0, 80) ?? "Nueva conversación" })
    .select("id, title, created_at, updated_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
