// Where the Kaggle notebook publishes its current public link (refreshed every 10 minutes while it runs).
export const LINK_URL =
  import.meta.env.VITE_LINK_URL ||
  'https://huggingface.co/datasets/mashrur991/banglish-demo-link/resolve/main/link.json'

export const STALE_MIN = 25        // no heartbeat for this long = treat the backend as offline
export const POLL_MS = 60_000      // how often to re-check the link file
export const MAX_CHARS = 600       // the backend cuts longer messages

export const EXAMPLES = [
  { id: 'tagore_trap', text: 'Rabindranath Tagore kon shale Olympic e gold medal jitechilen?' },
  { id: 'dollar_rate', text: 'ajke dollar er rate koto?' },
  { id: 'ki_obostha', text: 'ki obostha bhai?' },
  { id: 'jatiyo_kobi', text: 'Bangladesh er jatiyo kobi ke?' },
  { id: 'abba_hits', text: 'abba band er koekta hit gaan er naam bolo' },
  { id: 'slow_phone', text: 'Bhai amar phone ta onek slow hoye gese, ki korbo?' },
]

// Results from our evaluation (186 knowledge questions; see the project guide)
export const STATS = [
  // parts: plain strings stay still; {from, to, decimals, delay} pieces count when the box scrolls into view
  { key: 'knowledge_bn', parts: [{ from: 0, to: 69.4, decimals: 1 }, ' → ', { from: 0, to: 81.7, decimals: 1 }, '%'], note: 'questions right in Banglish' },
  { key: 'p_value', parts: [{ from: 1, to: 0.0008, decimals: 4 }], note: 'vs the original (McNemar)' },
  { key: 'train_rows', parts: [{ from: 0, to: 172128, decimals: 0, sep: true }], note: 'Banglish examples' },
  { key: 'phone_size', parts: [{ from: 0, to: 2.5, decimals: 1 }, ' GB'], note: 'runs offline' },
]

// Past chats: the Kaggle backend uploads every chat to this HF dataset (must be PUBLIC for the site to read it).
export const LOGS_REPO = import.meta.env.VITE_LOGS_REPO || 'mashrur991/banglish-demo-logs'
export const LOGS_API = import.meta.env.VITE_LOGS_API || 'https://huggingface.co'
