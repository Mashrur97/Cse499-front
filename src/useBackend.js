import { useCallback, useEffect, useRef, useState } from 'react'
import { Client } from '@gradio/client'
import { LINK_URL, POLL_MS, STALE_MIN, MAX_CHARS } from './config.js'

const EMPTY = { text: '', tokens: 0, done: false, hit_limit: false, certainty: null, tok_per_s: null }

// Finds the live Kaggle backend through link.json and streams both models' replies from its /stream endpoint.
export function useBackend() {
  const [link, setLink] = useState({ state: 'checking', url: null, updated: null })
  const [reply, setReply] = useState({ original: EMPTY, ours: EMPTY })
  const [phase, setPhase] = useState('idle')        // idle | connecting | queued | streaming | done | error
  const [queuePos, setQueuePos] = useState(null)
  const [error, setError] = useState(null)
  const client = useRef({ url: null, promise: null })

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

  const ask = useCallback(async (text, baseSys) => {
    const msg = (text || '').trim().slice(0, MAX_CHARS)
    if (!msg || link.state !== 'online') return
    setError(null); setQueuePos(null); setReply({ original: EMPTY, ours: EMPTY }); setPhase('connecting')
    try {
      const c = await getClient(link.url)
      const job = c.submit('/stream', { user_text: msg, base_sys: !!baseSys })
      await new Promise((resolve, reject) => {
        // Consume in the background and settle on "complete": never `break` out of this loop (the client hangs on return()).
        ;(async () => {
          for await (const ev of job) {
            if (ev.type === 'data') {
              const d = ev.data?.[0]
              if (d?.error) { reject(new Error(d.error)); continue }
              if (d?.original) { setPhase('streaming'); setReply({ original: d.original, ours: d.ours }) }
            } else if (ev.type === 'status') {
              if (ev.stage === 'pending' && typeof ev.position === 'number' && ev.position > 0) { setPhase('queued'); setQueuePos(ev.position) }
              else if (ev.stage === 'generating') setPhase('streaming')
              else if (ev.stage === 'error') reject(new Error(ev.message || 'The backend reported an error.'))
              else if (ev.stage === 'complete') resolve()
            }
          }
        })().catch(reject)
      })
      setPhase('done')
    } catch (e) {
      setPhase('error'); setError(e?.message || 'Could not reach the backend.')
      client.current = { url: null, promise: null }
      check()
    }
  }, [link, getClient, check])

  const busy = phase === 'connecting' || phase === 'queued' || phase === 'streaming'
  return { link, reply, phase, queuePos, error, busy, ask }
}

export function ago(iso) {
  if (!iso) return null
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000))
  if (m < 60) return `${m} min ago`
  if (m < 2880) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} days ago`
}
