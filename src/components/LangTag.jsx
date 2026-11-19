import { detectLang, ON_TARGET } from '../lang.js'

// Small tag naming the reply's language: lime when it is Banglish (the target), red for anything else.
export default function LangTag({ text }) {
  const lang = detectLang(text)
  if (!lang) return null
  const ok = lang === ON_TARGET
  return (
    <span
      title={`Detected from the reply's characters and common words. The target is Banglish (Bangla in English letters).`}
      className={`rounded border px-1.5 py-px font-mono text-[10.5px] leading-[1.5] ${ok ? 'border-lime-deep text-lime' : 'border-[#7a2f27] bg-[#2a1210] text-red'}`}
    >{ok ? '✓ ' : '✕ '}{lang}</span>
  )
}
