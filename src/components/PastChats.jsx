import { useEffect, useMemo, useState } from 'react'
import { LOGS_API, LOGS_REPO } from '../config.js'
import { Markdown } from './Pane.jsx'
import { ago } from '../useBackend.js'
import { chatId } from '../chatId.js'
import LangTag from './LangTag.jsx'

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

// Chats the admin hid: ids in hidden.json (missing file = nothing hidden).
async function loadHidden() {
  try {
    const r = await fetch(`${LOGS_API}/datasets/${LOGS_REPO}/resolve/main/hidden.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return new Set()
    const d = await r.json()
    return new Set(Array.isArray(d.ids) ? d.ids : [])
  } catch { return new Set() }
}

async function adminCall(body) {
  const r = await fetch('/.netlify/functions/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  let d = {}
  try { d = await r.json() } catch { /* not JSON */ }
  if (!r.ok) throw Object.assign(new Error(d.error || `server answered ${r.status}`), { status: r.status })
  return d
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
        <span className="flex items-center gap-2"><span className={highlight ? 'text-lime' : ''}>{label}</span><LangTag text={side?.text} /></span>
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

function HideBtn({ hidden, busy, onClick, label }) {
  return (
    <button type="button" disabled={busy} onClick={onClick}
      className={`cursor-pointer rounded-md border bg-transparent px-3 py-1 font-mono text-xs transition disabled:cursor-wait disabled:opacity-50 ${hidden ? 'border-lime-deep text-lime hover:bg-lime-deep' : 'border-[#5a2a24] text-red hover:bg-[#1a0f0d]'}`}>
      {busy ? '…' : hidden ? `unhide${label}` : `hide${label}`}
    </button>
  )
}

// One conversation (or one one-shot message): every turn in order, user on the right, both replies side by side.
function ConvCard({ conv, n, admin, hidden, pending, toggle }) {
  const { turns, latest, key } = conv
  const multi = turns.length > 1
  const ids = turns.map(t => t._id)
  const allHidden = ids.every(id => hidden.has(id))
  return (
    <article className={`flex flex-col overflow-hidden rounded-[14px] border bg-raise ${admin && allHidden ? 'border-[#5a2a24] opacity-60' : 'border-line-2'}`}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-panel px-4 py-2.5">
        <span className="font-display text-[15px] font-bold text-text">#{n}</span>
        {multi ? <Flag tone="lime">multi-turn · {turns.length} turns</Flag> : <Flag>one-shot</Flag>}
        <span className="font-mono text-xs text-faint" title={latest}>{ago(latest)}</span>
        {admin && allHidden && <Flag tone="amber">hidden</Flag>}
        {admin && (
          <span className="ml-auto">
            <HideBtn hidden={allHidden} busy={pending === key} label={multi ? ' all' : ''} onClick={() => toggle(ids, !allHidden, key)} />
          </span>
        )}
      </div>
      <div className={`flex flex-col gap-4 p-4 ${multi ? 'chat-scroll max-h-[520px] overflow-y-auto' : ''}`}>
      {turns.map((c, i) => {
        const turnHidden = hidden.has(c._id)
        return (
          <div key={c._id} className={`flex flex-col gap-3 ${i ? 'border-t border-line pt-4' : ''} ${admin && turnHidden && !allHidden ? 'opacity-50' : ''}`}>
            {(multi || c.original_got_instruction || c.stopped_by_user) && (
              <div className="flex flex-wrap items-center gap-2">
                {multi && <span className="font-mono text-[11px] text-faint">turn {(c.turn ?? i) + 1}</span>}
                {c.original_got_instruction && <Flag>original got instruction</Flag>}
                {c.stopped_by_user && <Flag tone="amber">stopped</Flag>}
                {admin && multi && turnHidden && !allHidden && <Flag tone="amber">hidden</Flag>}
                {admin && multi && (
                  <span className="ml-auto"><HideBtn hidden={turnHidden} busy={pending === c._id} label="" onClick={() => toggle([c._id], !turnHidden, c._id)} /></span>
                )}
              </div>
            )}
            <p className="m-0 max-w-[85%] self-end rounded-[14px] rounded-tr-[4px] border border-lime-deep bg-[#16210f] px-3.5 py-2 text-[15px] text-text">{c.message}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Reply label="qwen3-4b (original)" side={c.original} />
              <Reply label="ours (CWH+-D)" side={c.ours} highlight />
            </div>
          </div>
        )
      })}
      </div>
    </article>
  )
}

export default function PastChats({ admin = false }) {
  const [sessions, setSessions] = useState(null)       // file paths, newest first
  const [loadedUpTo, setLoadedUpTo] = useState(0)
  const [chats, setChats] = useState([])
  const [state, setState] = useState('loading')         // loading | ready | private | error
  const [errMsg, setErrMsg] = useState('')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(SHOW_PER_PAGE)
  const [hidden, setHidden] = useState(() => new Set())
  const [view, setView] = useState('all')                // admin: all | hidden
  const [pending, setPending] = useState(null)           // id being hidden/unhidden
  const [adminErr, setAdminErr] = useState('')

  const toggle = async (ids, hide, key) => {
    setPending(key); setAdminErr('')
    try {
      const d = await adminCall({ action: hide ? 'hide' : 'unhide', ids })
      setHidden(new Set(d.ids))
    } catch (e) {
      setAdminErr(e.message)
    } finally { setPending(null) }
  }

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
        const [all, hid] = await Promise.all([listSessions(), loadHidden()])
        if (alive) setHidden(hid)
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

  // Turns of one conversation share a conversation_id; one-shot messages are their own group. Newest conversation first.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const groups = new Map()
    for (const c of chats) {
      if (!c._id) c._id = chatId(c)
      if (admin ? view === 'hidden' && !hidden.has(c._id) : hidden.has(c._id)) continue
      const key = c.conversation_id ? `c:${c.conversation_id}` : `s:${c._id}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(c)
    }
    const hit = c => [c.message, c.original?.text, c.ours?.text].some(t => (t || '').toLowerCase().includes(q))
    return [...groups.entries()]
      .map(([key, turns]) => {
        turns.sort((a, b) => (a.turn ?? 0) - (b.turn ?? 0) || (a.time || '').localeCompare(b.time || ''))
        return { key, turns, latest: turns.reduce((m, t) => ((t.time || '') > m ? t.time : m), '') }
      })
      .filter(g => !q || g.turns.some(hit))
      .sort((a, b) => b.latest.localeCompare(a.latest))
  }, [chats, query, hidden, admin, view])


  return (
    <section className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 pt-12 pb-20 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <a href="#" className="font-mono text-xs text-muted no-underline hover:text-lime">← back to the demo</a>
          <h1 className="m-0 font-display text-[34px] font-bold tracking-[-.02em]">{admin ? 'Admin · past chats' : 'Past chats'}</h1>
          <p className="m-0 text-[15px] text-muted">
            {admin ? `Hidden chats disappear from Past chats; the raw logs keep them. ${hidden.size} hidden.` : 'What people asked the demo, and what both models answered. Newest first.'}
          </p>
        </div>
        {state === 'ready' && (
          <div className="flex w-full flex-wrap items-center gap-3 whitespace-nowrap sm:w-auto">
            <label htmlFor="q" className="sr-only">Search chats</label>
            <input
              id="q" value={query} onChange={e => { setQuery(e.target.value); setShown(SHOW_PER_PAGE) }} placeholder="search…"
              className="w-full rounded-[9px] sm:w-[220px] border border-line-2 bg-raise px-3 py-2 font-mono text-[13px] text-text outline-none placeholder:text-faint focus:border-lime-deep"
            />
            <span className="font-mono text-xs text-faint">{filtered.length} chat{filtered.length === 1 ? '' : 's'}</span>
            {admin && (
              <>
                <button type="button" onClick={() => { setView(v => (v === 'all' ? 'hidden' : 'all')); setShown(SHOW_PER_PAGE) }}
                  className="cursor-pointer rounded-md border border-line-2 bg-transparent px-3 py-1.5 font-mono text-xs text-muted hover:border-lime-deep hover:text-lime">
                  {view === 'all' ? 'show hidden only' : 'show all'}
                </button>
              </>
            )}
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
      {adminErr && <div className="rounded-[10px] border border-[#5a2a24] bg-[#1a0f0d] px-4 py-2.5 font-mono text-sm text-red" role="alert">{adminErr}</div>}
      {state === 'ready' && !chats.length && <p className="m-0 font-mono text-sm text-faint">no chats yet.</p>}

      <div className="flex flex-col gap-8">
        {filtered.slice(0, shown).map((conv, i) => (
          <ConvCard key={conv.key} conv={conv} n={i + 1} admin={admin} hidden={hidden} pending={pending} toggle={toggle} />
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
