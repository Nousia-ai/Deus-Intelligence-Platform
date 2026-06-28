import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase"

export const runtime = "nodejs"

// GET /api/chat/sessions/[id] — load messages for a session
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ error: "DB no disponible" }, { status: 500 })

  const { id } = await params
  const { data, error } = await supabase
    .from("chat_messages")
    .select("id, role, content, error, created_at")
    .eq("session_id", id)
    .order("created_at", { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/chat/sessions/[id] — append messages to session
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ error: "DB no disponible" }, { status: 500 })

  const { id } = await params
  const { messages } = await req.json() as { messages: { role: string; content: string; error?: boolean }[] }

  const rows = messages.map((m) => ({
    session_id: id,
    role: m.role,
    content: m.content,
    error: m.error ?? false,
  }))

  const { error } = await supabase.from("chat_messages").insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bump updated_at so session sorts to top
  await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", id)

  return NextResponse.json({ ok: true })
}

// PATCH /api/chat/sessions/[id] — rename title
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ error: "DB no disponible" }, { status: 500 })

  const { id } = await params
  const { title } = await req.json() as { title: string }

  const { error } = await supabase
    .from("chat_sessions")
    .update({ title: title.slice(0, 80), updated_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/chat/sessions/[id] — delete session + cascade messages
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ error: "DB no disponible" }, { status: 500 })

  const { id } = await params
  const { error } = await supabase.from("chat_sessions").delete().eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
