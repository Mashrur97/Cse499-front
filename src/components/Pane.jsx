import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ breaks: true, gfm: true })

function Markdown({ text }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text || '')), [text])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}

// One model's reply: header strip, streamed text, certainty bar and stats.
export default function Pane({ gpu, name, highlight, data, streaming, stopped, offline, placeholder, showCertainty }) {
  const { text, tokens, done, hit_limit, certainty, tok_per_s } = data
  const writing = streaming && !done && !!text
  const statusText = offline ? 'offline' : stopped && !done && text ? `${tokens} tok · stopped by you` : hit_limit ? `${tokens} tok · limit hit` : done ? `${tokens} tok · stopped` : writing ? `${tokens} tok · writing` : 'ready'
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
            <Markdown text={text} />
            {writing && <span className="cursor" aria-hidden="true" />}
          </>
        ) : (
          <p className="m-0 font-mono text-sm text-faint">{placeholder}</p>
        )}
      </div>

      <footer className="px-[18px] pb-4">
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
