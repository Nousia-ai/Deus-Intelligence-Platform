"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import { Lightbulb, Plus, X, Trash2, Check, PenLine } from "lucide-react"
import { cn } from "@/lib/utils"

interface Note {
  id: string
  title: string
  content: string
  color: string
  updatedAt: string
}

const COLORS: { key: string; bg: string; border: string; dot: string }[] = [
  { key: "white",  bg: "bg-white",          border: "border-slate-200",   dot: "bg-slate-300"   },
  { key: "yellow", bg: "bg-amber-50",        border: "border-amber-200",   dot: "bg-amber-400"   },
  { key: "blue",   bg: "bg-indigo-50",       border: "border-indigo-200",  dot: "bg-indigo-400"  },
  { key: "green",  bg: "bg-emerald-50",      border: "border-emerald-200", dot: "bg-emerald-400" },
  { key: "rose",   bg: "bg-rose-50",         border: "border-rose-200",    dot: "bg-rose-400"    },
]

function genId() {
  return Math.random().toString(36).slice(2, 10)
}

function loadNotes(): Note[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem("deus-insights") ?? "[]")
  } catch { return [] }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem("deus-insights", JSON.stringify(notes))
}

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({
  note, onUpdate, onDelete,
}: {
  note: Note
  onUpdate: (id: string, patch: Partial<Note>) => void
  onDelete: (id: string) => void
}) {
  const c = COLORS.find((x) => x.key === note.color) ?? COLORS[0]
  const [palette, setPalette] = useState(false)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.1 } }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn("group rounded-xl border p-3 flex flex-col gap-1.5 hover:shadow-sm transition-shadow", c.bg, c.border)}
    >
      <input
        type="text"
        value={note.title}
        onChange={(e) => onUpdate(note.id, { title: e.target.value })}
        placeholder="Título..."
        className="w-full text-[11.5px] font-semibold text-slate-800 bg-transparent outline-none placeholder:text-slate-300"
      />
      <textarea
        value={note.content}
        onChange={(e) => onUpdate(note.id, { content: e.target.value })}
        placeholder="Añade un insight..."
        rows={3}
        className="w-full text-[11px] text-slate-500 bg-transparent outline-none resize-none placeholder:text-slate-300 leading-relaxed"
      />
      <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pt-0.5">
        <div className="flex items-center gap-1">
          {palette
            ? COLORS.map((cl) => (
                <button key={cl.key} onClick={() => { onUpdate(note.id, { color: cl.key }); setPalette(false) }}
                  className={cn("w-3.5 h-3.5 rounded-full border transition-transform hover:scale-125", cl.dot,
                    cl.key === note.color ? "border-slate-500 scale-110" : "border-transparent"
                  )}
                />
              ))
            : <button onClick={() => setPalette(true)} className={cn("w-3.5 h-3.5 rounded-full border-transparent hover:scale-125 transition-transform", c.dot)} />
          }
          {palette && (
            <button onClick={() => setPalette(false)} className="ml-0.5 text-slate-300 hover:text-slate-500">
              <Check className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
        <button onClick={() => onDelete(note.id)} className="text-slate-200 hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      <p className="text-[9px] text-slate-300 font-medium leading-none">
        {new Date(note.updatedAt).toLocaleString("es-MX", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </p>
    </motion.div>
  )
}

// ── New note input ────────────────────────────────────────────────────────────

function NewNoteInput({ onCreate }: { onCreate: (n: Note) => void }) {
  const [active, setActive] = useState(false)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const commit = useCallback(() => {
    if (title.trim() || content.trim()) {
      onCreate({ id: genId(), title: title.trim(), content: content.trim(), color: "white", updatedAt: new Date().toISOString() })
    }
    setTitle(""); setContent(""); setActive(false)
  }, [title, content, onCreate])

  useEffect(() => {
    if (!active) return
    const handle = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) commit() }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [active, commit])

  return (
    <div ref={ref}
      onClick={() => !active && setActive(true)}
      className={cn(
        "rounded-xl border transition-all duration-200",
        active ? "bg-white border-slate-200 shadow-sm" : "bg-slate-50 border-slate-200/60 hover:border-slate-300 hover:bg-white cursor-text"
      )}
    >
      {active ? (
        <div className="p-3 space-y-2">
          <input autoFocus type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del insight..."
            className="w-full text-[11.5px] font-semibold text-slate-800 bg-transparent outline-none placeholder:text-slate-300"
          />
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe tu observación, idea o dato relevante..."
            rows={3} onKeyDown={(e) => e.key === "Escape" && commit()}
            className="w-full text-[11px] text-slate-500 bg-transparent outline-none resize-none placeholder:text-slate-300 leading-relaxed"
          />
          <div className="flex justify-end">
            <button onClick={commit} className="text-[10.5px] font-semibold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
              Guardar insight
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <Plus className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
          <span className="text-[11px] text-slate-300 font-medium">Nuevo insight...</span>
        </div>
      )}
    </div>
  )
}

// ── Panel (portal) ────────────────────────────────────────────────────────────

function InsightsPanel({
  open, onClose, notes, onCreateNote, onUpdateNote, onDeleteNote,
}: {
  open: boolean; onClose: () => void
  notes: Note[]
  onCreateNote: (n: Note) => void
  onUpdateNote: (id: string, p: Partial<Note>) => void
  onDeleteNote: (id: string) => void
}) {
  if (typeof document === "undefined") return null
  const count = notes.length

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Invisible backdrop just to catch outside clicks */}
          <div className="fixed inset-0 z-40" onClick={onClose} />

          {/* Panel */}
          <motion.div
            key="insights-panel"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "bottom right" }}
            className="fixed z-50 bottom-[88px] right-6 w-[360px] max-h-[560px] flex flex-col rounded-2xl bg-white shadow-[0_8px_40px_rgba(0,0,0,0.14)] border border-slate-200/80 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-500 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <p className="text-[12.5px] font-semibold text-slate-900 leading-none">Insights</p>
                  {count > 0 && (
                    <p className="text-[9px] text-slate-400 mt-0.5">{count} {count === 1 ? "anotación" : "anotaciones"}</p>
                  )}
                </div>
              </div>
              <button onClick={onClose}
                className="w-6 h-6 rounded-full flex items-center justify-center text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin bg-[#F7F8FC]">
              <NewNoteInput onCreate={onCreateNote} />

              {count > 0 ? (
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {notes.map((note) => (
                      <NoteCard key={note.id} note={note} onUpdate={onUpdateNote} onDelete={onDeleteNote} />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                  className="py-10 flex flex-col items-center gap-2 text-center"
                >
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center mb-1">
                    <PenLine className="w-5 h-5 text-indigo-300" />
                  </div>
                  <p className="text-[11.5px] font-semibold text-slate-400">Sin insights todavía</p>
                  <p className="text-[10.5px] text-slate-300 max-w-[200px] leading-relaxed">
                    Captura observaciones, ideas o patrones que encuentres en los datos
                  </p>
                </motion.div>
              )}
            </div>

            {/* Footer brand tag */}
            <div className="px-4 py-2 border-t border-slate-100 bg-white flex-shrink-0">
              <p className="text-[9px] font-semibold text-slate-300 uppercase tracking-[0.08em]">Deus Intelligence · Insights</p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ── Floating trigger button ───────────────────────────────────────────────────

export function InsightsWidget() {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true); setNotes(loadNotes()) }, [])
  useEffect(() => { saveNotes(notes) }, [notes])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("keydown", h)
    return () => document.removeEventListener("keydown", h)
  }, [open])

  const createNote = useCallback((note: Note) => setNotes((p) => [note, ...p]), [])
  const updateNote = useCallback((id: string, patch: Partial<Note>) =>
    setNotes((p) => p.map((n) => n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)), [])
  const deleteNote = useCallback((id: string) => setNotes((p) => p.filter((n) => n.id !== id)), [])

  const count = notes.length

  return (
    <>
      {/* Floating button */}
      {mounted && createPortal(
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {/* Pill label that appears on hover */}
          <AnimatePresence>
            {!open && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none"
              >
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => setOpen((v) => !v)}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.93 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-200",
              open
                ? "bg-slate-800 shadow-slate-900/30"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/40"
            )}
            title="Insights"
          >
            <AnimatePresence mode="wait">
              {open ? (
                <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <X className="w-5 h-5 text-white" />
                </motion.div>
              ) : (
                <motion.div key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
                  <Lightbulb className="w-5 h-5 text-white" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Badge */}
            {count > 0 && !open && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-white text-indigo-600 text-[9px] font-bold flex items-center justify-center px-1 shadow-sm border border-indigo-100"
              >
                {count > 9 ? "9+" : count}
              </motion.span>
            )}
          </motion.button>
        </div>,
        document.body
      )}

      {/* Panel */}
      {mounted && (
        <InsightsPanel
          open={open}
          onClose={() => setOpen(false)}
          notes={notes}
          onCreateNote={createNote}
          onUpdateNote={updateNote}
          onDeleteNote={deleteNote}
        />
      )}
    </>
  )
}
