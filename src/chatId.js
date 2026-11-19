// A stable id for one logged chat: its time plus a short hash of the message (neither changes once logged).
export function chatId(c) {
  let h = 2166136261
  for (const ch of `${c.message || ''}|${c.conversation_id || ''}|${c.turn ?? ''}`) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0
  return `${c.time || ''}|${h.toString(36)}`
}
