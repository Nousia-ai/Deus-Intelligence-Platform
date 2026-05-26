"use client"

import { useEffect, useRef, useState } from "react"

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

/**
 * Animates a numeric value from its current position to `end`.
 * Uses a ref to track the live position so the animation always starts
 * from wherever it is — no stale-closure restarts from 0.
 */
export function useCountUp({
  end,
  duration = 1200,
  delay = 0,
  decimals = 0,
}: {
  end: number
  duration?: number
  delay?: number
  decimals?: number
}) {
  const [value, setValue] = useState(0)
  const rafRef   = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Tracks the actual current display value independently of React state —
  // avoids stale-closure issues when `end` changes mid-animation.
  const currentRef = useRef(0)

  useEffect(() => {
    // Cancel any in-flight animation
    if (rafRef.current)   { cancelAnimationFrame(rafRef.current);   rafRef.current   = null }
    if (timerRef.current) { clearTimeout(timerRef.current);          timerRef.current = null }

    const from = currentRef.current
    const to   = end

    // Guard: already at the target — don't restart the animation.
    // This is the critical protection against spurious re-runs in production.
    if (from === to) return

    const run = () => {
      const startTime = performance.now()

      const tick = (now: number) => {
        const elapsed  = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased    = easeOutExpo(progress)
        const current  = from + (to - from) * eased
        const rounded  = parseFloat(current.toFixed(decimals))

        currentRef.current = rounded
        setValue(rounded)

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          // Snap to exact target to avoid floating-point drift
          currentRef.current = to
          setValue(to)
          rafRef.current = null
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    if (delay > 0) {
      timerRef.current = setTimeout(run, delay)
    } else {
      run()
    }

    return () => {
      if (rafRef.current)   cancelAnimationFrame(rafRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [end, duration, delay, decimals])

  return value
}
