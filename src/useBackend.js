import { useCallback, useEffect, useRef, useState } from 'react'
import { Client } from '@gradio/client'
import { LINK_URL, POLL_MS, STALE_MIN, MAX_CHARS } from './config.js'

const EMPTY = { text: '', tokens: 0, done: false, hit_limit: false, certainty: null, tok_per_s: null }

// Finds the live Kaggle backend (v5) through link.json. Chat mode holds a conversation via /chat_stream; one-shot uses /stream.
// Each model only sees its OWN earlier replies (plus the shared user messages).
export function useBackend() {
  const [link, setLink] = useState({ state: 'checking', url: null, updated: null })
  const [turns, setTurns] = useState([])            // [{ user, original, ours }]
  const [mode, setModeState] = useState('chat')     // chat: each model sees its own history | single: every message starts fresh
  const convId = useRef(newId())
  const [phase, setPhase] = useState('idle')        // idle | connecting | queued | streaming | done | error
  const [queuePos, setQueuePos] = useState(null)
  const [error, setError] = useState(null)
  const client = useRef({ url: null, promise: null })
  const current = useRef(null)                      // { job, finish } of the running request, for Stop

  const check = useCallback(async () => {
    try {
      const r = await fetch(`${LINK_URL}?t=${Date.now()}`, { cache: 'no-store' })
      if (!r.ok) throw new Error(String(r.status))
      const info = await r.json()
      const fresh = info.updated && (Date.now() - new Date(info.updated)) / 60000 < STALE_MIN
      if (info.status === 'online' && info.url && fresh) setLink({ state: 'online', url: info.url, updated: info.updated })
      else setLink({ state: 'offline', url: null, updated: info.updated || null })
    } catch {
      setLink(l => (l.state === 'online' ? l : { state: 'offline', url: null, updated: null }))
    }
  }, [])

  useEffect(() => { check(); const t = setInterval(check, POLL_MS); return () => clearInterval(t) }, [check])


  const getClient = useCallback(url => {
    if (client.current.url !== url) {
      client.current = { url, promise: Client.connect(url, { events: ['data', 'status'] }) }
      client.current.promise.catch(() => { client.current = { url: null, promise: null } })
    }
    return client.current.promise
  }, [])

  const setLast = upd => setTurns(ts => ts.length ? [...ts.slice(0, -1), { ...ts[ts.length - 1], ...upd }] : ts)

  const ask = useCallback(async (text, baseSys) => {
    const msg = (text || '').trim().slice(0, MAX_CHARS)
    if (!msg || link.state !== 'online') return
    const prior = mode === 'chat' ? turns : []         // one-shot: no history
    const history = { original: [], ours: [] }
    for (const t of prior) {
      if (!t.original.text && !t.ours.text) continue          // a failed turn adds nothing
      history.original.push({ role: 'user', content: t.user }, { role: 'assistant', content: t.original.text })
      history.ours.push({ role: 'user', content: t.user }, { role: 'assistant', content: t.ours.text })
    }
    const turnIndex = prior.length
    setError(null); setQueuePos(null); setPhase('connecting')
    setTurns(ts => [...(mode === 'chat' ? ts : []), { user: msg, original: EMPTY, ours: EMPTY }])
    try {
      const c = await getClient(link.url)
      // Backend v5: chat mode -> /chat_stream with history; one-shot -> /stream (logged as a single message).
      const multi = mode === 'chat'
      const job = multi
        ? c.submit('/chat_stream', {
            user_text: msg, base_sys: !!baseSys, history_json: JSON.stringify(history),
            conversation_id: convId.current, turn: turnIndex,
          })
        : c.submit('/stream', { user_text: msg, base_sys: !!baseSys })
      const stopped = await new Promise((resolve, reject) => {
        current.current = { job, finish: () => resolve(true) }
        // Consume in the background and settle on "complete": never `break` out of this loop (the client hangs on return()).
        ;(async () => {
          for await (const ev of job) {
            if (current.current?.job !== job) continue   // stopped or replaced: ignore late events
            if (ev.type === 'data') {
              const d = ev.data?.[0]
              if (d?.error) { reject(new Error(d.error)); continue }
              if (d?.original) { setPhase('streaming'); setLast({ original: d.original, ours: d.ours }) }
            } else if (ev.type === 'status') {
              if (ev.stage === 'pending' && typeof ev.position === 'number' && ev.position > 0) { setPhase('queued'); setQueuePos(ev.position) }
              else if (ev.stage === 'generating') setPhase('streaming')
              else if (ev.stage === 'error') reject(new Error(ev.message || 'The backend reported an error.'))
              else if (ev.stage === 'complete') resolve(false)
            }
          }
        })().catch(reject)
      })
      current.current = null
      setPhase(stopped ? 'stopped' : 'done')
    } catch (e) {
      current.current = null
      setPhase('error'); setError(e?.message || 'Could not reach the backend.')
      client.current = { url: null, promise: null }
      check()
    }
  }, [link, getClient, check, turns, mode])

  const clearChat = useCallback(() => { if (current.current) return; setTurns([]); setError(null); setPhase('idle'); convId.current = newId() }, [])
  const setMode = useCallback(m => { if (current.current) return; setModeState(m); clearChat() }, [clearChat])

  // Stop: cancel on the server too (frees the GPUs for the next visitor), keep what was written so far.
  const stop = useCallback(() => {
    const cur = current.current
    if (!cur) return
    current.current = null                           // from now on, late events from this job are ignored
    cur.finish()                                     // settle first, so the cancel's own error can't count as a failure
    try { Promise.resolve(cur.job.cancel()).catch(() => {}) } catch { /* already finished */ }
  }, [])

  const busy = phase === 'connecting' || phase === 'queued' || phase === 'streaming'
  return { link, turns, phase, queuePos, error, busy, ask, stop, clearChat, mode, setMode }
}

function newId() {
  try { return crypto.randomUUID() } catch { return `c-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
}

export function ago(iso) {
  if (!iso) return null
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))
  if (m < 60) return `${m} min ago`
  if (m < 2880) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} days ago`
}
