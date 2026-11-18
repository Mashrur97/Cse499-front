import { useEffect, useState } from 'react'
import { useBackend, ago } from './useBackend.js'
import { EXAMPLES, STATS, MAX_CHARS } from './config.js'
import Pane from './components/Pane.jsx'
import Aurora from './components/Aurora.jsx'
import PastChats from './components/PastChats.jsx'
import CountUp from './components/CountUp.jsx'

function StatusPill({ link }) {
  const on = link.state === 'online'
  const label = link.state === 'checking' ? 'checking…' : on ? 'online' : 'offline'
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-[13px] ${on ? 'border-lime-deep text-lime' : 'border-line-2 text-faint'}`}>
      <span className={`h-[7px] w-[7px] rounded-full ${on ? 'pulse-dot bg-lime' : 'bg-faint'}`} />
      <span className="hidden sm:inline">{'gpu0 + gpu1 '}</span>{label}
    </span>
  )
}

function useHashPage() {
  const get = () => (window.location.hash === '#history' ? 'history' : 'demo')
  const [page, setPage] = useState(get)
  useEffect(() => {
    const on = () => {
      const p = get(); setPage(p)
      if (p === 'history') window.scrollTo(0, 0)
      else requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView())
    }
    window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on)
  }, [])
  return page
}

export default function App() {
  const page = useHashPage()
  const { link, reply, phase, queuePos, error, busy, ask, stop } = useBackend()
  const [msg, setMsg] = useState('')
  const [baseSys, setBaseSys] = useState(false)
  const [showCert, setShowCert] = useState(false)
  const offline = link.state !== 'online'
  const streaming = phase === 'streaming'
  const stopped = phase === 'stopped'

  const send = text => { const t = (text ?? msg).trim(); if (!t || busy || offline) return; setMsg(t); ask(t, baseSys) }
  const onSubmit = e => { e.preventDefault(); send() }

  const waitingNote =
    phase === 'connecting' ? 'connecting to the GPUs…' :
    phase === 'queued' ? `in queue · position ${queuePos}` : null
  const placeholder = offline ? 'offline' : waitingNote || 'replies appear here'

  return (
    <div className="min-h-screen bg-ink">
      {/* ── nav ── */}
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-4 py-4 sm:px-8 sm:py-5">
          <a href="#top" className="shrink-0 font-mono text-[15px] text-lime no-underline">banglish-4b<span className="hidden text-faint sm:inline"> / demo</span></a>
          <nav className="flex items-center gap-4 font-mono text-[13px] sm:gap-6">
            <a href="#try" className="hidden text-muted no-underline hover:text-lime sm:inline">try_it</a>
            <a href="#results" className="hidden text-muted no-underline hover:text-lime sm:inline">results</a>
            <a href="#how" className="hidden text-muted no-underline hover:text-lime sm:inline">how_it_works</a>
            <a href="#history" className={`no-underline hover:text-lime ${page === 'history' ? 'text-lime' : 'text-muted'}`}>past_chats</a>
            <StatusPill link={link} />
          </nav>
        </div>
      </header>

      {page === 'history' ? <PastChats /> : (
      <>
      {/* ── hero ── */}
      <section id="top" className="relative overflow-hidden">
        <Aurora />
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-16 pb-20 sm:px-8 sm:pt-24 sm:pb-24">
          <span className="font-mono text-[13px] text-faint">// nsu cse 499 · qwen3-4b, before and after our training</span>
          <h1 className="m-0 max-w-[860px] font-display text-[40px] leading-[1.04] font-bold tracking-[-.03em] sm:text-[56px] lg:text-[64px]">
            One question. Two models.<br /><span className="text-lime">One speaks Banglish.</span>
          </h1>
          <p className="m-0 max-w-[600px] text-[17px] leading-[1.6] text-muted">
            Ask anything in Banglish. The original Qwen3-4B and our fine-tuned version answer side by side, live, on two GPUs.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a href="#try" className="rounded-[9px] bg-lime px-5 py-3 text-[15px] font-semibold text-ink no-underline transition hover:bg-lime-2">Try it ↓</a>
            <a href="#results" className="rounded-[9px] border border-line-2 px-5 py-3 font-mono text-[14px] text-muted no-underline transition hover:border-lime-deep hover:text-lime">results</a>
          </div>
        </div>
      </section>

      {/* ── live demo ── */}
      <section id="try" className="mx-auto flex max-w-[1180px] scroll-mt-6 flex-col gap-4 px-4 pb-20 sm:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="m-0 font-display text-[26px] font-bold">Live demo</h2>
          <span className="font-mono text-xs text-faint">same message · same settings · greedy</span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Pane gpu="gpu0" name="qwen3-4b (original)" data={reply.original} streaming={streaming} stopped={stopped} offline={offline} placeholder={placeholder} showCertainty={showCert} />
          <Pane gpu="gpu1" name="ours (CWH+-D)" highlight data={reply.ours} streaming={streaming} stopped={stopped} offline={offline} placeholder={placeholder} showCertainty={showCert} />
        </div>

        {offline && link.state !== 'checking' && (
          <div className="rounded-[14px] border border-line-2 bg-raise px-5 py-4 text-[15px] leading-relaxed text-muted" role="status">
            <span className="font-mono text-amber">backend offline.</span> The models run on a free GPU session we start for demos
            {link.updated ? <>; last seen online <span className="text-text">{ago(link.updated)}</span></> : null}. This page switches on by itself
            as soon as it's running (checks every minute).
          </div>
        )}
        {error && (
          <div className="rounded-[14px] border border-[#5a2a24] bg-[#1a0f0d] px-5 py-3 font-mono text-sm text-red" role="alert">error: {error}</div>
        )}

        <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line-2 bg-raise py-2 pr-2 pl-4">
          <div className="flex min-w-0 flex-[999_1_240px] items-center gap-3">
            <span className="font-mono text-base text-lime" aria-hidden="true">&gt;</span>
            <label htmlFor="msg" className="sr-only">Your message (Banglish)</label>
            <input
              id="msg" value={msg} maxLength={MAX_CHARS} onChange={e => setMsg(e.target.value)} disabled={offline}
              placeholder="Ask anything in Banglish… e.g. ki obostha bhai?" autoComplete="off"
              className="min-w-0 flex-1 border-0 bg-transparent py-3 font-mono text-[15px] text-text outline-none placeholder:text-faint disabled:opacity-50"
            />
          </div>
          {busy ? (
            <button
              key="stop" type="button" onClick={e => { e.preventDefault(); stop() }}
              className="flex flex-[1_0_auto] cursor-pointer items-center justify-center gap-2 rounded-[9px] border border-[#5a2a24] bg-[#1a0f0d] px-5 py-3 font-sans text-[15px] font-semibold text-red transition hover:border-red"
            >
              <span className="h-3 w-3 rounded-[2px] bg-red" aria-hidden="true" />Stop
            </button>
          ) : (
            <button
              key="run" type="submit" disabled={offline || !msg.trim()}
              className="flex-[1_0_auto] cursor-pointer rounded-[9px] border-0 bg-lime px-5 py-3 font-sans text-[15px] font-semibold text-ink transition hover:bg-lime-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Run both ⏎
            </button>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {EXAMPLES.map(ex => (
            <button
              key={ex.id} type="button" onClick={() => send(ex.text)} disabled={busy || offline} title={ex.text}
              className="cursor-pointer rounded-md border border-line-2 bg-transparent px-3 py-2 font-mono text-[13px] text-muted transition hover:border-lime-deep hover:text-lime disabled:cursor-not-allowed disabled:opacity-40"
            >{ex.id}</button>
          ))}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:ml-auto">
            <label className="flex cursor-pointer items-center gap-2 font-mono text-[13px] text-muted">
              <input type="checkbox" checked={baseSys} onChange={e => setBaseSys(e.target.checked)} className="h-4 w-4 accent-lime" />
              --give-original-system-prompt
            </label>
            <label className="flex cursor-pointer items-center gap-2 font-mono text-[13px] text-muted">
              <input type="checkbox" checked={showCert} onChange={e => setShowCert(e.target.checked)} className="h-4 w-4 accent-lime" />
              --show-certainty
            </label>
          </div>
        </div>
        <p className="m-0 text-[13px] leading-relaxed text-faint">
          Both run greedy (always the most likely next word), so the same message gives the same reply.
          Messages and replies are saved anonymously for our research and shown in <a href="#history" className="text-muted underline decoration-line-2 underline-offset-2 hover:text-lime">past chats</a>.
          {showCert && <> Certainty = how sure each model was about its wording, <span className="text-muted">not</span> whether the answer is right.</>}
        </p>
      </section>

      {/* ── results ── */}
      <section id="results" className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] scroll-mt-6 flex-col gap-5 px-4 py-16 sm:px-8">
          <h2 className="m-0 font-display text-[26px] font-bold">Results</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {STATS.map(s => (
              <div key={s.key} className="flex min-w-0 flex-col gap-1 rounded-[10px] border border-line bg-raise px-4 py-4">
                <span className="font-mono text-xs text-faint">{s.key}</span>
                <span className="font-display text-[22px] font-bold sm:text-[30px]"><CountUp count={s.count} prefix={s.prefix} suffix={s.suffix} /></span>
                <span className="text-xs text-muted">{s.note}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── how it works ── */}
      <section id="how" className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pb-20 sm:px-8">
        <h2 className="m-0 font-display text-[26px] font-bold">How it works</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ['01 data', '172k Banglish rows', 'Real Banglish chat, Wikipedia-grounded Q&A and premise-checking examples, written with Gemini as the teacher.'],
          ['02 train', 'QLoRA on 2 × T4', 'A small add-on (0.8% extra weights) on Qwen3-4B. Ten controlled variants; the winner picked by a rule fixed in advance.'],
          ['03 ship', 'Offline, 2.5 GB', '4-bit GGUF on Android: 3.4 tok/s on a Snapdragon 855+, 6-7 on an 870. No internet needed.'],
        ].map(([k, t, d]) => (
          <div key={k} className="flex flex-col gap-2 rounded-xl border border-line p-5">
            <span className="font-mono text-xs text-lime">{k}</span>
            <span className="font-display text-[22px] font-bold">{t}</span>
            <span className="text-[15px] leading-[1.55] text-muted">{d}</span>
          </div>
        ))}
        </div>
      </section>

      </>
      )}

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-3 px-4 py-6 font-mono text-xs text-faint sm:px-8">
          <span>NSU CSE 499 · Mashrur and team</span>
          <span>original: Qwen3-4B-Instruct-2507 · ours: + QLoRA adapter (CWH+-D)</span>
        </div>
      </footer>
    </div>
  )
}
