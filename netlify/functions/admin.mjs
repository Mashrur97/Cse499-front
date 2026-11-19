// Admin for Past chats: hides / unhides chats by keeping their ids in hidden.json in the logs dataset.
// The chat logs themselves are never edited (the running notebook re-uploads its session file, which would undo it).
// Netlify environment variables: ADMIN_PASSWORD, HF_ADMIN_TOKEN (fine-grained, write on the logs dataset only).
import { createHash, timingSafeEqual } from 'node:crypto'

const REPO = process.env.LOGS_REPO || 'mashrur991/banglish-demo-logs'
const HF = process.env.HF_API || 'https://huggingface.co'
const FILE = 'hidden.json'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
const digest = s => createHash('sha256').update(String(s)).digest()
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function readHidden(token) {
  const r = await fetch(`${HF}/datasets/${REPO}/resolve/main/${FILE}?t=${Date.now()}`, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (r.status === 404) return []
  if (!r.ok) throw new Error(`reading ${FILE}: HF answered ${r.status}`)
  const d = await r.json()
  return Array.isArray(d.ids) ? d.ids : []
}

async function writeHidden(token, ids, summary) {
  const content = Buffer.from(JSON.stringify({ ids, updated: new Date().toISOString() }, null, 1)).toString('base64')
  const body = [
    { key: 'header', value: { summary, description: '' } },
    { key: 'file', value: { content, path: FILE, encoding: 'base64' } },
  ].map(l => JSON.stringify(l)).join('\n')
  const r = await fetch(`${HF}/api/datasets/${REPO}/commit/main`, {
    method: 'POST', body,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-ndjson' },
  })
  if (!r.ok) throw new Error(`saving ${FILE}: HF answered ${r.status} ${(await r.text()).slice(0, 200)}`)
}

export default async req => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' })
  const { ADMIN_PASSWORD: pw, HF_ADMIN_TOKEN: token } = process.env
  if (!pw || !token) return json(500, { error: 'Admin is not set up: add ADMIN_PASSWORD and HF_ADMIN_TOKEN in Netlify.' })

  let input
  try { input = await req.json() } catch { return json(400, { error: 'bad request' }) }
  if (!timingSafeEqual(digest(input.password ?? ''), digest(pw))) { await sleep(800); return json(401, { error: 'wrong password' }) }

  const ids = Array.isArray(input.ids) ? input.ids.filter(x => typeof x === 'string' && x.length < 200).slice(0, 500) : []
  try {
    if (input.action === 'check') return json(200, { ok: true })
    if (input.action !== 'hide' && input.action !== 'unhide') return json(400, { error: 'unknown action' })
    if (!ids.length) return json(400, { error: 'no ids' })
    const cur = new Set(await readHidden(token))
    ids.forEach(id => (input.action === 'hide' ? cur.add(id) : cur.delete(id)))
    const next = [...cur].sort()
    await writeHidden(token, next, `${input.action} ${ids.length} chat${ids.length > 1 ? 's' : ''}`)
    return json(200, { ok: true, ids: next })
  } catch (e) {
    return json(502, { error: e.message })
  }
}
