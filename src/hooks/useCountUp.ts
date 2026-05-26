"use client"

import { useEffect, useRef, useState } from "react"

interface UseCountUpOptions {
  start?: number
  end: number
  duration?: number
  delay?: number
  decimals?: number
  easing?: (t: number) => number
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

export function useCountUp({
  start = 0,
  end,
  duration = 1200,
  delay = 0,
  decimals = 0,
  easing = easeOutExpo,
}: UseCountUpOptions) {
  const [value, setValue] = useState(start)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const prevEndRef = useRef<number>(end)

  useEffect(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)

    const startValue = prevEndRef.current === end ? start : value
    prevEndRef.current = end

    const startAnimation = () => {
      startTimeRef.current = null

      const animate = (timestamp: number) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp
        const elapsed = timestamp - startTimeRef.current
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easing(progress)
        const current = startValue + (end - startValue) * easedProgress

        setValue(parseFloat(current.toFixed(decimals)))

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate)
        } else {
          setValue(end)
        }
      }

      frameRef.current = requestAnimationFrame(animate)
    }

    if (delay > 0) {
      const timer = setTimeout(startAnimation, delay)
      return () => {
        clearTimeout(timer)
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
      }
    } else {
      startAnimation()
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
      }
    }
  }, [end, duration, delay, decimals, easing, start])

  return value
}
