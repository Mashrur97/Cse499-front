import { useEffect, useMemo, useState } from 'react'
import { LOGS_API, LOGS_REPO } from '../config.js'
import { Markdown } from './Pane.jsx'
import { ago } from '../useBackend.js'

const SESSIONS_PER_PAGE = 6          // one log file per Kaggle session; newest first
const SHOW_PER_PAGE = 30

// Lists the session files in the public logs dataset, newest first.
async function listSessions() {
  const r = await fetch(`${LOGS_API}/api/datasets/${LOGS_REPO}/tree/main/chats`, { cache: 'no-store' })
  if (r.status === 401 || r.status === 403 || r.status === 404) throw Object.assign(new Error('private'), { code: 'private' })
  if (!r.ok) throw new Error(`HF answered ${r.status}`)
  const files = await r.json()
  return files.filter(f => f.type === 'file' && f.path.endsWith('.jsonl')).map(f => f.path).sort().reverse()
}

async function loadSession(path) {
  const r = await fetch(`${LOGS_API}/datasets/${LOGS_REPO}/resolve/main/${path}?t=${Date.now()}`, { cache: 'no-store' })
  if (!r.ok) return []
  const out = []
  for (const line of (await r.text()).split('\n')) {
    if (!line.trim()) continue
    try { out.push(JSON.parse(line)) } catch { /* skip a half-written line */ }
  }
  return out
}

function Flag({ children, tone = 'faint' }) {
  const cls = tone === 'amber' ? 'border-[#5b4321] text-amber' : tone === 'lime' ? 'border-lime-deep text-lime' : 'border-line-2 text-faint'
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${cls}`}>{children}</span>
}

function Reply({ label, side, highlight }) {
  const [open, setOpen] = useState(false)
  const long = (side?.text || '').length > 420
  const text = !long || open ? side?.text || '' : side.text.slice(0, 420) + '…'
  return (
    <div className={`flex min-w-0 flex-col gap-2 rounded-[10px] border bg-panel p-3.5 ${highlight ? 'border-lime-deep' : 'border-line'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-faint">
        <span className={highlight ? 'text-lime' : ''}>{label}</span>
        <span className={side?.hit_limit ? 'text-amber' : ''}>{side?.tokens ?? 0} tok{side?.hit_limit ? ' · limit hit' : ''}</span>
      </div>
      <div className={`text-[14.5px] leading-[1.6] ${highlight ? 'text-text' : 'text-soft'}`}>
        {text ? <Markdown text={text} /> : <span className="text-faint">(no reply)</span>}
      </div>
      {long && (
        <button type="button" onClick={() => setOpen(o => !o)} className="cursor-pointer self-start border-0 bg-transparent p-0 font-mono text-xs text-muted hover:text-lime">
          {open ? 'show less' : 'show more'}
        </button>
      )}
    </div>
  )
}

export default function PastChats() {
  const [sessions, setSessions] = useState(null)       // file paths, newest first
  const [loadedUpTo, setLoadedUpTo] = useState(0)
  const [chats, setChats] = useState([])
  const [state, setState] = useState('loading')         // loading | ready | private | error
  const [errMsg, setErrMsg] = useState('')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(SHOW_PER_PAGE)

  const loadMoreSessions = async (all, from) => {
    const batch = all.slice(from, from + SESSIONS_PER_PAGE)
    const parts = await Promise.all(batch.map(loadSession))
    setChats(cs => [...cs, ...parts.flat()].sort((a, b) => (b.time || '').localeCompare(a.time || '')))
    setLoadedUpTo(from + batch.length)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const all = await listSessions()
        if (!alive) return
        setSessions(all)
        await loadMoreSessions(all, 0)
        if (alive) setState('ready')
      } catch (e) {
        if (!alive) return
        if (e.code === 'private') setState('private')
        else { setState('error'); setErrMsg(e.message) }
      }
    })()
    return () => { alive = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? chats.filter(c => [c.message, c.original?.text, c.ours?.text].some(t => (t || '').toLowerCase().includes(q))) : chats
  }, [chats, query])

  return (
    <section className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-12 pb-20 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <a href="#" className="font-mono text-xs text-muted no-underline hover:text-lime">← back to the demo</a>
          <h1 className="m-0 font-display text-[34px] font-bold tracking-[-.02em]">Past chats</h1>
          <p className="m-0 text-[15px] text-muted">What people asked the demo, and what both models answered. Newest first.</p>
        </div>
        {state === 'ready' && (
          <div className="flex items-center gap-3">
            <label htmlFor="q" className="sr-only">Search chats</label>
            <input
              id="q" value={query} onChange={e => { setQuery(e.target.value); setShown(SHOW_PER_PAGE) }} placeholder="search…"
              className="w-[220px] max-w-full rounded-[9px] border border-line-2 bg-raise px-3 py-2 font-mono text-[13px] text-text outline-none placeholder:text-faint focus:border-lime-deep"
            />
            <span className="font-mono text-xs text-faint">{filtered.length} chats</span>
          </div>
        )}
      </div>

      {state === 'loading' && <p className="m-0 font-mono text-sm text-faint">loading chats from Hugging Face…</p>}
      {state === 'private' && (
        <div className="rounded-[14px] border border-line-2 bg-raise px-5 py-4 text-[15px] text-muted">
          <span className="font-mono text-amber">history not public yet.</span> The chat log dataset is private, so this page can't read it.
        </div>
      )}
      {state === 'error' && (
        <div className="rounded-[14px] border border-[#5a2a24] bg-[#1a0f0d] px-5 py-3 font-mono text-sm text-red" role="alert">couldn't load chats: {errMsg}</div>
      )}
      {state === 'ready' && !chats.length && <p className="m-0 font-mono text-sm text-faint">no chats yet.</p>}

      <div className="flex flex-col gap-4">
        {filtered.slice(0, shown).map((c, i) => (
          <article key={`${c.time}-${i}`} className="flex flex-col gap-3 rounded-[14px] border border-line bg-raise p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-faint" title={c.time}>{ago(c.time)}</span>
              {c.original_got_instruction && <Flag>original got instruction</Flag>}
              {c.stopped_by_user && <Flag tone="amber">stopped</Flag>}
              {c.turn > 0 && <Flag tone="lime">turn {c.turn + 1}</Flag>}
            </div>
            <p className="m-0 self-start rounded-[12px] rounded-bl-[4px] bg-line px-3.5 py-2 text-[15px] text-text">{c.message}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Reply label="qwen3-4b (original)" side={c.original} />
              <Reply label="ours (CWH+-D)" side={c.ours} highlight />
            </div>
          </article>
        ))}
      </div>

      {state === 'ready' && (shown < filtered.length || (sessions && loadedUpTo < sessions.length)) && (
        <button
          type="button"
          onClick={() => shown < filtered.length ? setShown(s => s + SHOW_PER_PAGE) : loadMoreSessions(sessions, loadedUpTo)}
          className="cursor-pointer self-center rounded-[9px] border border-line-2 bg-transparent px-5 py-2.5 font-mono text-[13px] text-muted transition hover:border-lime-deep hover:text-lime"
        >load more</button>
      )}
    </section>
  )
}
