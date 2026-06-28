"use client"

import { Pencil, Trash2, MessageSquarePlus } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Props {
  sessions: ChatSession[]
  currentId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
}

// ── Date grouping ─────────────────────────────────────────────────────────────

function getGroup(updatedAt: string): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86_400_000)
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86_400_000)
  const d = new Date(updatedAt)
  if (d >= today) return "Hoy"
  if (d >= yesterday) return "Ayer"
  if (d >= sevenDaysAgo) return "Últimos 7 días"
  return "Anteriores"
}

const GROUP_ORDER = ["Hoy", "Ayer", "Últimos 7 días", "Anteriores"]

// ── Component ─────────────────────────────────────────────────────────────────

export function SessionPanel({ sessions, currentId, onSelect, onNew, onDelete, onRename }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // Group sessions by date
  const groups: Record<string, ChatSession[]> = {}
  for (const s of sessions) {
    const g = getGroup(s.updated_at)
    if (!groups[g]) groups[g] = []
    groups[g].push(s)
  }

  const startRename = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation()
    setRenamingId(s.id)
    setRenameValue(s.title)
  }

  const commitRename = (id: string) => {
    const v = renameValue.trim()
    if (v) onRename(id, v)
    setRenamingId(null)
  }

  return (
    <div className="flex flex-col w-[220px] flex-shrink-0 border-r border-black/[0.06] bg-[#FDFCF9] h-full overflow-hidden">
      {/* New chat button */}
      <div className="flex-shrink-0 px-3 pt-4 pb-3">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-300 transition-all duration-150"
        >
          <MessageSquarePlus className="w-3.5 h-3.5 flex-shrink-0" />
          Nueva conversación
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-4">
        {sessions.length === 0 && (
          <p className="text-[11px] text-[#b5b1ab] text-center px-3 pt-6 leading-relaxed">
            Tus conversaciones aparecerán aquí
          </p>
        )}

        {GROUP_ORDER.filter((g) => groups[g]?.length).map((group) => (
          <div key={group}>
            <p className="text-[9px] font-semibold text-[#c0bbb5] uppercase tracking-widest px-2 pb-1 pt-1">
              {group}
            </p>
            <div className="space-y-0.5">
              {groups[group].map((s) => (
                <div
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className={cn(
                    "group relative flex items-center gap-1.5 rounded-lg px-2 py-2 cursor-pointer transition-all duration-100",
                    s.id === currentId
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-[#4a4742] hover:bg-black/[0.04]"
                  )}
                >
                  {renamingId === s.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => commitRename(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename(s.id)
                        if (e.key === "Escape") setRenamingId(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 text-[12px] bg-white border border-indigo-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-300"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 text-[12px] leading-snug truncate">
                      {s.title}
                    </span>
                  )}

                  {/* Action buttons — visible on hover or when active */}
                  {renamingId !== s.id && (
                    <div className={cn(
                      "flex items-center gap-0.5 flex-shrink-0 transition-opacity duration-100",
                      s.id === currentId ? "opacity-60" : "opacity-0 group-hover:opacity-60"
                    )}>
                      <button
                        onClick={(e) => startRename(s, e)}
                        className="p-0.5 rounded hover:text-indigo-600 hover:opacity-100 transition-colors"
                        title="Renombrar"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                        className="p-0.5 rounded hover:text-red-500 hover:opacity-100 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
