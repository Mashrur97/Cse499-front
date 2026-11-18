import { useEffect, useState } from 'react'

const LINE1 = ['One', 'question.', 'Two', 'models.']
const LINE2 = 'One speaks Banglish.'
const REDUCE = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Line 1: words rise in one after another. Line 2: typed out like a model reply, with the terminal cursor.
export default function HeroTitle() {
  const [typed, setTyped] = useState(REDUCE ? LINE2.length : 0)
  const [cursor, setCursor] = useState(!REDUCE)
  useEffect(() => {
    if (REDUCE) return
    let i = 0, t
    const start = setTimeout(function step() {
      i += 1; setTyped(i)
      if (i < LINE2.length) t = setTimeout(step, 55 + Math.random() * 45)
      else t = setTimeout(() => setCursor(false), 2600)
    }, 950)
    return () => { clearTimeout(start); clearTimeout(t) }
  }, [])

  return (
    <h1 aria-label={`${LINE1.join(' ')} ${LINE2}`}
      className="m-0 max-w-[860px] font-display text-[40px] leading-[1.04] font-bold tracking-[-.03em] sm:text-[56px] lg:text-[64px]">
      <span aria-hidden="true">
        {LINE1.map((w, i) => (
          <span key={w} className={REDUCE ? 'inline-block' : 'hero-word inline-block'} style={{ animationDelay: `${120 + i * 140}ms` }}>
            {w}{i < LINE1.length - 1 ? ' ' : ''}
          </span>
        ))}
        <br />
        <span className="text-lime">
          {LINE2.slice(0, typed)}
          {cursor && <span className="cursor hero-cursor" />}
          {/* the untyped rest stays invisible so the layout doesn't jump while typing */}
          <span className="invisible">{LINE2.slice(typed)}</span>
        </span>
      </span>
    </h1>
  )
}
