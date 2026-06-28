"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Send, Bot, User, Sparkles, RefreshCw } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { SessionPanel, type ChatSession } from "./SessionPanel"

interface Message {
  role: "user" | "assistant"
  content: string
  error?: boolean
}

// ── Welcome suggestions ───────────────────────────────────────────────────────

const WELCOME_SUGGESTIONS = [
  "¿Cuánto vendimos en 2025 vs 2024?",
  "¿Qué sucursal tiene el mejor margen?",
  "¿Cuáles son los top 10 productos del año?",
  "¿Qué hay en alerta roja en inventario?",
  "¿Cuánto revenue sacrificamos por descuentos?",
  "¿Cómo van las tendencias por día de la semana?",
]

// ── Loading texts ─────────────────────────────────────────────────────────────

const LOADING_TEXTS = [
  "Consultando datos...",
  "Analizando resultados...",
  "Preparando respuesta...",
]

// ── Suggestion parser ─────────────────────────────────────────────────────────

function parseSuggestions(content: string): { text: string; suggestions: string[] } {
  const lines = content.trimEnd().split("\n")
  const suggestions: string[] = []
  let cutIdx = lines.length

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (line.startsWith("¿") && line.endsWith("?")) {
      suggestions.unshift(line)
      cutIdx = i
    } else if (line === "" && suggestions.length > 0) {
      cutIdx = i
    } else {
      break
    }
  }

  if (suggestions.length === 0) return { text: content, suggestions: [] }
  return { text: lines.slice(0, cutIdx).join("\n").trimEnd(), suggestions }
}

// ── Session API helpers ───────────────────────────────────────────────────────

async function apiCreateSession(title: string): Promise<ChatSession | null> {
  try {
    const res = await fetch("/api/chat/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    return res.ok ? res.json() : null
  } catch { return null }
}

async function apiSaveMessages(sessionId: string, messages: Message[]) {
  try {
    await fetch(`/api/chat/sessions/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    })
  } catch { /* non-critical */ }
}

async function apiLoadMessages(sessionId: string): Promise<Message[]> {
  try {
    const res = await fetch(`/api/chat/sessions/${sessionId}`)
    if (!res.ok) return []
    const rows: { role: string; content: string; error?: boolean }[] = await res.json()
    return rows.map((r) => ({ role: r.role as "user" | "assistant", content: r.content, error: r.error }))
  } catch { return [] }
}

async function apiListSessions(): Promise<ChatSession[]> {
  try {
    const res = await fetch("/api/chat/sessions")
    return res.ok ? res.json() : []
  } catch { return [] }
}

async function apiDeleteSession(sessionId: string) {
  try {
    await fetch(`/api/chat/sessions/${sessionId}`, { method: "DELETE" })
  } catch { /* non-critical */ }
}

async function apiRenameSession(sessionId: string, title: string) {
  try {
    await fetch(`/api/chat/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
  } catch { /* non-critical */ }
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [loadingText, setLoadingText] = useState(LOADING_TEXTS[0])

  // Session state
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loadingSession, setLoadingSession] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const loadingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamingContentRef = useRef("")
  const pendingSessionIdRef = useRef<string | null>(null)

  // Load session list on mount
  useEffect(() => {
    apiListSessions().then(setSessions)
  }, [])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Rotate loading text while streaming
  useEffect(() => {
    if (streaming) {
      let idx = 0
      loadingIntervalRef.current = setInterval(() => {
        idx = (idx + 1) % LOADING_TEXTS.length
        setLoadingText(LOADING_TEXTS[idx])
      }, 1800)
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current)
      setLoadingText(LOADING_TEXTS[0])
    }
    return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current) }
  }, [streaming])

  // ── Session actions ───────────────────────────────────────────────────────

  const handleSelectSession = useCallback(async (id: string) => {
    if (id === sessionId || streaming) return
    setLoadingSession(true)
    setMessages([])
    setSessionId(id)
    const msgs = await apiLoadMessages(id)
    setMessages(msgs)
    setLoadingSession(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [sessionId, streaming])

  const handleNewChat = useCallback(() => {
    if (streaming) return
    setMessages([])
    setSessionId(null)
    setInput("")
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [streaming])

  const handleDeleteSession = useCallback(async (id: string) => {
    await apiDeleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
    if (id === sessionId) {
      setMessages([])
      setSessionId(null)
    }
  }, [sessionId])

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    await apiRenameSession(id, title)
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, title } : s))
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────────

  const submit = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim()
      if (!msg || streaming) return

      setInput("")
      const userMsg: Message = { role: "user", content: msg }
      const assistantMsg: Message = { role: "assistant", content: "" }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setStreaming(true)
      streamingContentRef.current = ""

      // Create session on first message
      let sid = sessionId
      if (!sid) {
        const title = msg.length > 60 ? msg.slice(0, 60) + "…" : msg
        const session = await apiCreateSession(title)
        if (session) {
          sid = session.id
          setSessionId(sid)
          setSessions((prev) => [session, ...prev])
        }
      }
      pendingSessionIdRef.current = sid

      abortRef.current = new AbortController()

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [...messages, userMsg] }),
          signal: abortRef.current.signal,
        })

        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

        const reader = res.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          setMessages((prev) => {
            const updated = [...prev]
            const newContent = updated[updated.length - 1].content + chunk
            updated[updated.length - 1] = { role: "assistant", content: newContent }
            streamingContentRef.current = newContent
            return updated
          })
        }

        // Save exchange to DB (fire-and-forget)
        const finalContent = streamingContentRef.current
        if (sid && finalContent) {
          apiSaveMessages(sid, [userMsg, { role: "assistant", content: finalContent }])
        }
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") {
          const errMsg = "No pude obtener una respuesta en este momento. Verifica tu conexión e intenta de nuevo."
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: "assistant", content: errMsg, error: true }
            return updated
          })
          if (sid) {
            apiSaveMessages(sid, [userMsg, { role: "assistant", content: errMsg, error: true }])
          }
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
        setTimeout(() => inputRef.current?.focus(), 50)
      }
    },
    [input, messages, streaming, sessionId]
  )

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")
    if (!lastUser) return
    setMessages((prev) => prev.slice(0, -2))
    submit(lastUser.content)
  }, [messages, submit])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Sessions panel ── */}
      <SessionPanel
        sessions={sessions}
        currentId={sessionId}
        onSelect={handleSelectSession}
        onNew={handleNewChat}
        onDelete={handleDeleteSession}
        onRename={handleRenameSession}
      />

      {/* ── Chat area ── */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-black/[0.06] bg-[#FDFCF9] flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold text-[#1a1714] leading-none">
              Asistente Deus
            </h1>
            <p className="text-[11px] text-[#9a9690] mt-0.5">
              Pregunta sobre ventas, inventario, sucursales y más
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-semibold text-[#9a9690] tracking-wide uppercase">
              GPT-4o mini
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
          {loadingSession ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#b5b1ab] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
                  />
                ))}
              </div>
            </div>
          ) : isEmpty ? (
            <Welcome onSuggest={submit} />
          ) : (
            messages.map((msg, i) => {
              const isLast = i === messages.length - 1
              return (
                <MessageBubble
                  key={i}
                  message={msg}
                  isLast={isLast}
                  streaming={streaming && isLast}
                  loadingText={loadingText}
                  onSuggest={submit}
                  onRetry={retry}
                />
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pb-4 pt-2 border-t border-black/[0.06] bg-[#FDFCF9]">
          <div className="flex items-end gap-2 bg-white border border-black/[0.09] rounded-xl px-3 py-2.5 shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all duration-150">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta algo sobre Deus Store…"
              rows={1}
              disabled={streaming || loadingSession}
              className="flex-1 resize-none bg-transparent text-[13px] text-[#1a1714] placeholder:text-[#b5b1ab] focus:outline-none leading-relaxed max-h-32 overflow-y-auto disabled:opacity-50"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={() => submit()}
              disabled={!input.trim() || streaming || loadingSession}
              className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-600 text-white disabled:opacity-30 hover:bg-indigo-700 transition-colors duration-150"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[10px] text-[#c0bbb5] text-center mt-2">
            Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Welcome screen ────────────────────────────────────────────────────────────

function Welcome({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] px-4">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 mb-5">
        <Sparkles className="w-7 h-7 text-indigo-500" />
      </div>
      <h2 className="text-[18px] font-semibold text-[#1a1714] mb-1.5 tracking-tight">
        Hola, Germán
      </h2>
      <p className="text-[13px] text-[#9a9690] text-center max-w-xs mb-8 leading-relaxed">
        Pregúntame lo que necesites sobre Deus Store. Tengo acceso a ventas, inventario,
        sucursales y tendencias históricas.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {WELCOME_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="text-left text-[12px] text-[#4a4742] bg-white border border-black/[0.07] rounded-lg px-3.5 py-2.5 hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-700 transition-all duration-150 leading-snug"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({
  message, isLast, streaming, loadingText, onSuggest, onRetry,
}: {
  message: Message
  isLast: boolean
  streaming: boolean
  loadingText: string
  onSuggest: (text: string) => void
  onRetry: () => void
}) {
  const isUser = message.role === "user"
  const { text, suggestions } = isUser
    ? { text: message.content, suggestions: [] }
    : parseSuggestions(message.content)

  const showSuggestions = !isUser && !streaming && suggestions.length > 0

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 ${
          isUser ? "bg-indigo-600" : "bg-[#EEECE8]"
        }`}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5 text-white" />
        ) : (
          <Bot className="w-3.5 h-3.5 text-[#7a7670]" />
        )}
      </div>

      <div className={`flex flex-col gap-2 ${isUser ? "items-end" : "items-start"} max-w-[75%]`}>
        <div
          className={`rounded-xl px-4 py-3 text-[13px] leading-relaxed w-full ${
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : message.error
              ? "bg-red-50 border border-red-200 text-red-700 rounded-tl-sm"
              : "bg-white border border-black/[0.07] text-[#1a1714] rounded-tl-sm shadow-sm"
          }`}
        >
          {streaming && isLast && !message.content ? (
            <LoadingIndicator text={loadingText} />
          ) : isUser ? (
            <span className="whitespace-pre-wrap break-words">{message.content}</span>
          ) : (
            <MessageText content={text} />
          )}
          {streaming && isLast && message.content && (
            <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle opacity-70" />
          )}
        </div>

        {message.error && !streaming && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 text-[11px] text-[#7a7670] hover:text-indigo-600 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Intentar de nuevo
          </button>
        )}

        {showSuggestions && (
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggest(s)}
                className="text-[11px] text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1 hover:bg-indigo-100 hover:border-indigo-300 transition-all duration-150 leading-none"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Loading indicator ─────────────────────────────────────────────────────────

function LoadingIndicator({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-[#9a9690]">
      <div className="flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#b5b1ab] animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
      <span className="text-[12px] transition-all duration-500">{text}</span>
    </div>
  )
}

// ── Message text with Markdown ────────────────────────────────────────────────

function MessageText({ content }: { content: string }) {
  if (!content) return null
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="text-[12px] border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-black/10">{children}</thead>,
        th: ({ children }) => (
          <th className="text-left font-semibold px-3 py-1.5 text-[#4a4742] whitespace-nowrap">{children}</th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-1.5 border-b border-black/[0.05] align-top">{children}</td>
        ),
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 my-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 my-1">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
        code: ({ children }) => (
          <code className="bg-black/[0.06] rounded px-1 py-0.5 text-[11px] font-mono">{children}</code>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
