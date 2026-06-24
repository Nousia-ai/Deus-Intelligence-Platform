"use client"

import { useActionState } from "react"
import { signIn } from "./actions"
import { motion } from "framer-motion"
import { Lock, Mail, Loader2 } from "lucide-react"

const initialState = { error: null as string | null }

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-sm"
    >
      {/* Logo */}
      <div className="flex justify-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/deus-logo.svg"
          alt="Deus Stores"
          className="h-10 w-auto opacity-90"
        />
      </div>

      {/* Card */}
      <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 backdrop-blur-sm">
        <div className="mb-6 text-center">
          <h1 className="text-[17px] font-semibold text-white/90 tracking-tight">
            Acceso a la plataforma
          </h1>
          <p className="text-[12px] text-white/35 mt-1">
            Deus Intelligence Platform
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.07em]"
            >
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                className="w-full pl-9 pr-3 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-lg text-[13px] text-white/85 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.07em]"
            >
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2.5 bg-white/[0.06] border border-white/[0.1] rounded-lg text-[13px] text-white/85 placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 transition-all"
              />
            </div>
          </div>

          {/* Error */}
          {state.error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
            >
              {state.error}
            </motion.p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[13px] font-semibold py-2.5 rounded-lg transition-all duration-150 mt-2"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Verificando…
              </>
            ) : (
              "Iniciar sesión"
            )}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="text-center text-[10px] text-white/18 mt-6">
        © 2026 Nousia AI · Acceso restringido
      </p>
    </motion.div>
  )
}
