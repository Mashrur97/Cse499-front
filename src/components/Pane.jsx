import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

export function Markdown({ text }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || '')), [text])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}

// Smooth typing: the backend sends text in bursts (~5 per second); reveal it character by character instead,
// faster when far behind so it never lags much. Reduced-motion users see text immediately.
const REDUCE = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
function useSmoothText(target) {
  const [shown, setShown] = useState(target)
  const len = useRef(target.length)
  useEffect(() => {
    if (REDUCE || !target.startsWith(shown.slice(0, len.current)) || target.length < len.current) {
      len.current = REDUCE ? target.length : 0                       // new reply (or reduced motion): restart / show all
      setShown(REDUCE ? target : '')
      if (REDUCE) return
    }
    let raf = 0, last = performance.now()
    const tick = now => {
      const behind = target.length - len.current
      if (behind <= 0) return
      const dt = Math.min(64, now - last); last = now
      const cps = Math.max(45, behind * 3.5)                          // chars per second: steady, speeds up when behind
      len.current = Math.min(target.length, len.current + Math.max(1, Math.round(cps * dt / 1000)))
      setShown(target.slice(0, len.current))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target]) // eslint-disable-line react-hooks/exhaustive-deps
  return shown
}

// One model's reply: header strip, streamed text, certainty bar and stats.
export default function Pane({ gpu, name, highlight, data, streaming, stopped, offline, placeholder, showCertainty }) {
  const { text, tokens, done, hit_limit, certainty, tok_per_s } = data
  const shown = useSmoothText(text || '')
  const catchingUp = shown.length < (text || '').length
  const writing = (streaming && !done && !!text) || catchingUp
  const statusText = offline ? '' : stopped && !done && text ? `${tokens} tok · stopped by you` : hit_limit ? `${tokens} tok · limit hit` : done ? `${tokens} tok · stopped` : writing ? `${tokens} tok · writing` : ''
  const statusColor = offline ? 'text-faint' : hit_limit ? 'text-amber' : 'text-faint'
  const pct = certainty == null ? 0 : Math.round(certainty * 100)

  return (
    <section
      aria-label={name}
      className={`flex min-w-0 flex-col overflow-hidden rounded-[14px] border bg-panel ${
        highlight ? 'border-lime-deep shadow-[0_0_0_1px_rgba(182,243,106,.08),0_20px_60px_rgba(182,243,106,.06)]' : 'border-line'
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 font-mono text-xs text-faint">
        <span className={highlight ? 'text-lime' : ''}>{gpu} · {name}</span>
        <span className={statusColor}>{statusText}</span>
      </header>

      <div className={`min-h-[220px] flex-1 px-[18px] py-4 text-[16px] leading-[1.65] ${highlight ? 'text-text' : 'text-soft'}`} aria-live="polite">
        {text ? (
          <>
            <Markdown text={shown} />
            {writing && <span className="cursor" aria-hidden="true" />}
          </>
        ) : (
          <div className="flex h-full min-h-[188px] items-center justify-center">
            <span className="text-sm text-faint">{placeholder}</span>
          </div>
        )}
      </div>

      <footer className={`px-[18px] pb-4 ${tokens || showCertainty ? '' : 'invisible'}`}>
        {showCertainty && (
          <div className="mb-1.5 h-1 rounded-sm bg-line">
            <div className={`h-1 rounded-sm transition-[width] duration-300 ${highlight ? 'bg-lime' : 'bg-amber'}`} style={{ width: `${pct}%` }} />
          </div>
        )}
        <span className="block font-mono text-xs text-faint">
          {showCertainty && (certainty == null ? 'certainty – · ' : `certainty ${pct}% · `)}
          {tok_per_s == null ? '– tok/s' : `${tok_per_s} tok/s`}
        </span>
      </footer>
    </section>
  )
}
