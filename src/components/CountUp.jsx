import { useEffect, useRef, useState } from 'react'

const fmt = (v, { decimals = 0, sep = false }) => {
  const s = v.toFixed(decimals)
  return sep ? Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : s
}

// Counts from `from` to `to` once the number scrolls into view (instantly for reduced-motion users).
export default function CountUp({ count, prefix = '', suffix = '', duration = 1600 }) {
  const ref = useRef(null)
  const [value, setValue] = useState(count.from)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValue(count.to); return }
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const tick = now => {
        const k = Math.min(1, (now - t0) / duration)
        const eased = 1 - Math.pow(1 - k, 4)                         // fast start, gentle landing
        setValue(count.from + (count.to - count.from) * eased)
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [count.from, count.to, duration])
  return (
    <span ref={ref} className="tabular-nums" aria-label={`${prefix}${fmt(count.to, count)}${suffix}`}>
      <span aria-hidden="true">{prefix}{fmt(value, count)}{suffix}</span>
    </span>
  )
}
