import { useEffect, useRef, useState } from 'react'

const fmt = (v, { decimals = 0, sep = false }) => {
  const s = v.toFixed(decimals)
  return sep ? Number(s).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : s
}

// Renders a stat made of parts; number parts count from `from` to `to` once the stat scrolls into view
// (each after its own `delay`). Reduced-motion users see the final values at once.
export default function CountUp({ parts, duration = 2600 }) {
  const ref = useRef(null)
  const nums = parts.filter(p => typeof p === 'object')
  const [values, setValues] = useState(() => nums.map(n => n.from))
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setValues(nums.map(n => n.to)); return }
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now()
      const tick = now => {
        let running = false
        setValues(nums.map(n => {
          const k = Math.min(1, Math.max(0, (now - t0 - (n.delay || 0)) / duration))
          if (k < 1) running = true
          return n.from + (n.to - n.from) * (1 - Math.pow(1 - k, 4))     // fast start, gentle landing
        }))
        if (running) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [duration]) // eslint-disable-line react-hooks/exhaustive-deps

  let i = 0
  const final = parts.map(p => (typeof p === 'object' ? fmt(p.to, p) : p)).join('')
  return (
    <span ref={ref} className="tabular-nums" aria-label={final}>
      <span aria-hidden="true">{parts.map((p, k) => (typeof p === 'object' ? <span key={k}>{fmt(values[i++], p)}</span> : <span key={k}>{p}</span>))}</span>
    </span>
  )
}
