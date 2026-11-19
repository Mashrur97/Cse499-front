import { useEffect, useMemo, useRef, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import LangTag from './LangTag.jsx'

marked.setOptions({ breaks: true, gfm: true })

// Math (the original model writes LaTeX: \[ … \], $$ … $$, \( … \)). Formulas are pulled out before Markdown
// (which would eat the backslashes), rendered with KaTeX (trust off, so its output is safe), and put back after sanitizing.
// An unclosed formula (still streaming) stays as plain text until its closing bracket arrives.
const MATH = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)|^[ \t]*\[[ \t]*\n([\s\S]*?\\[a-zA-Z][\s\S]*?)\n[ \t]*\][ \t]*$/gm
function renderMath(text) {
  const out = []
  const src = text.replace(MATH, (m, a, b, c, d) => {
    const tex = a ?? b ?? c ?? d
    const display = c === undefined
    try {
      out.push(katex.renderToString(tex.trim(), { displayMode: display, throwOnError: false, strict: 'ignore', trust: false }))
      return display ? `\n\nKXMATH${out.length - 1}END\n\n` : `KXMATH${out.length - 1}END`
    } catch { return m }
  })
  return { src, out }
}

export function Markdown({ text }) {
  const html = useMemo(() => {
    const { src, out } = renderMath((text || '').replace(/\ufffd+\s*$/, ''))   // older logs: half a character at the cut
    const safe = DOMPurify.sanitize(marked.parse(src))
    return out.length ? safe.replace(/KXMATH(\d+)END/g, (m, i) => out[+i] ?? m) : safe
  }, [text])
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

const EMPTY = { text: '', tokens: 0, done: false, hit_limit: false, certainty: null, tok_per_s: null }

// The newest reply streams in with smooth typing; earlier turns are static.
function LiveReply({ text, writing }) {
  const shown = useSmoothText(text || '')
  return (
    <>
      <Markdown text={shown} />
      {(writing || shown.length < (text || '').length) && <span className="cursor" aria-hidden="true" />}
    </>
  )
}

// One model's side of the conversation: header strip, the thread, stats for the latest reply.
export default function Pane({ gpu, name, side, highlight, turns, streaming, stopped, offline, placeholder, showCertainty }) {
  const last = turns.length ? turns[turns.length - 1][side] : EMPTY
  const { text, tokens, done, hit_limit, certainty, tok_per_s } = last
  const writing = streaming && !done && !!text
  const statusText = offline ? '' : stopped && !done && text ? `${tokens} tok · stopped by you` : hit_limit ? `${tokens} tok · limit hit` : done ? `${tokens} tok · stopped` : writing ? `${tokens} tok · writing` : ''
  const statusColor = offline ? 'text-faint' : hit_limit ? 'text-amber' : 'text-faint'
  const pct = certainty == null ? 0 : Math.round(certainty * 100)
  const who = side === 'ours' ? 'ours' : 'qwen3-4b'

  // keep the newest message in view while it streams, unless the reader scrolled up
  const box = useRef(null), pinned = useRef(true)
  const onScroll = () => { const el = box.current; if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }
  useEffect(() => { const el = box.current; if (el && pinned.current) el.scrollTop = el.scrollHeight })

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

      <div
        ref={box} onScroll={onScroll} aria-live="polite"
        className={`chat-scroll h-[300px] overflow-y-auto px-4 py-4 text-[15.5px] leading-[1.6] sm:h-[340px] ${highlight ? 'text-text' : 'text-soft'}`}
      >
        {turns.length ? (
          <div className="flex flex-col gap-4">
            {turns.map((t, i) => {
              const isLast = i === turns.length - 1
              const r = t[side]
              return (
                <div key={i} className="flex flex-col gap-3">
                  <div className="flex max-w-[85%] flex-col items-end gap-1 self-end">
                    <span className="font-mono text-[11px] text-faint">you</span>
                    <div className="rounded-[14px] rounded-tr-[4px] border border-lime-deep bg-[#16210f] px-3.5 py-2 text-[15px] text-text">{t.user}</div>
                  </div>
                  <div className="flex max-w-[92%] min-w-0 flex-col items-start gap-1 self-start">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-[11px] ${highlight ? 'text-lime' : 'text-faint'}`}>{who}</span>
                      {r.text && !(isLast && writing) && <LangTag text={r.text} />}
                    </div>
                    <div className="min-w-0 max-w-full rounded-[14px] rounded-tl-[4px] border border-line bg-raise px-3.5 py-2.5">
                      {isLast ? (r.text ? <LiveReply text={r.text} writing={writing} /> : <span className="typing" aria-label="waiting for the reply"><i /><i /><i /></span>)
                              : (r.text ? <Markdown text={r.text} /> : <span className="font-mono text-sm text-faint">(no reply)</span>)}
                      {!isLast && r.hit_limit && <span className="mt-1 block font-mono text-xs text-amber">limit hit</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-faint">{placeholder}</span>
          </div>
        )}
      </div>

      <footer className={`border-t border-line px-[18px] py-3 ${tokens || showCertainty ? '' : 'invisible'}`}>
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
