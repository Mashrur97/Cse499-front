// Which language a reply is in, from its characters and common words. Banglish is the target; everything else is flagged.
// Works on finished replies; very short or unclear text returns null (no tag) rather than a guess.

const words = s => new Set(s.split(/\s+/))
const BN = words(`ami tumi apni amar tomar apnar amra tomra apnara amake tomake apnake achi acho achen ache achhe achis chilo silo chilen
  holo hoy hoye hoyeche hoyechilo hobe hote hoile hole kore koro kori koren korte kora korle korechi korbo korben korche korchi korechilam kortese
  er ekta ekti eta eti ota oti oi tai jodi tobe kintu ebong onek khub shob shobai sob kono keu kothay kotha koto ekhon tahole bhalo valo shathe sathe
  moto jonno theke diye dao dibo debo bolo bolte bolchi jante jani janina janen pare paren pari parbo kemon keno beshi besh kichu kisu ekhane sekhane
  hishebe hisebe porjonto jay jabe jete thake thaken nai nei shudhu sudhu borong moddhe somporko niye dhoro dhorun kaj mone dekha dekhte bujhi bujhte
  bujhao bujhay bujhte lage lagbe chai chao chan dite nite niye shuru shesh sesh abar arekta arek ektu oneke tara tader tar tini uni ora
  hocche hochhe hoccho ghum khabar khao jodio karon tahole emon emni etai otai ager pore agey kothao kokhono shomoy somoy`)
const HI = words(`hai hain kya nahi nahin aur mein hota hoti hote kaise kyun kyon tum aap yeh woh wo bhi raha rahi rahe karna karo karte kuch sab mujhe
  hum apna wala wali isme iska iski uska uski matlab lekin sawal baat samajh samjha samajhne liye jaise pahle pehle koi chahiye sakta sakte
  thik bahut hoga hogi tha thi gaya gayi diya kiya jata jati ko`)
const DE = words(`der die das und ist nicht ich sie ein eine einen einem mit auf für sind wird auch von den dem es wir oder aber wie sehr zu im bei
  nach ihr kann werden diese dieser haben hat über schon noch wenn weil dass sich man`)
const EN = words(`the is are and of to in it you that this for with what can your be have was an on as or there not but if about how which from by
  they we it's let's its has more no so do does would could should these those their them been were will just like there's i'm don't`)

const SCRIPTS = [
  ['Bangla script', /[ঀ-৿]/g], ['Hindi script', /[ऀ-ॿ]/g], ['Chinese', /[㐀-鿿]/g],
  ['Arabic script', /[؀-ۿ]/g], ['Cyrillic', /[Ѐ-ӿ]/g],
]

export function detectLang(text) {
  const t = (text || '')
    .replace(/```[\s\S]*?```/g, ' ')                                      // code
    .replace(/\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)/g, ' ')   // formulas
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/"[^"\n]{0,120}"|“[^”\n]{0,120}”/g, ' ')                      // quoted text (often the user's own words echoed back)
  const latin = (t.match(/[A-Za-zÀ-ɏ]/g) || []).length
  let best = null, bestN = 0
  for (const [name, re] of SCRIPTS) { const n = (t.match(re) || []).length; if (n > bestN) { best = name; bestN = n } }
  if (bestN + latin < 4) return null
  if (bestN / (bestN + latin) > 0.3) return best

  const ws = (t.toLowerCase().match(/[a-zÀ-ɏ']+/g) || [])
  if (ws.length < 2) return null
  const plain = ws.map(w => w.normalize('NFD').replace(/[̀-ͯ]/g, ''))
  let bn = 0, hi = 0, de = 0, en = 0
  for (const w of plain) { if (BN.has(w)) bn++; if (HI.has(w)) hi++; if (DE.has(w)) de++; if (EN.has(w)) en++ }
  const iast = (t.match(/[āīūṭḍṇśṣ]/g) || []).length                       // Hindi transliteration marks
  if (de >= 3 && de > bn && de > hi && de >= en * 0.6) return 'German'
  if (hi + Math.min(iast, 3) >= 3 && hi > bn) return 'Hinglish'
  if (bn >= 1 && bn >= en * 0.5 && bn >= hi) return 'Banglish'
  if (en >= 2 && en > bn * 2) return 'English'
  return null
}

export const ON_TARGET = 'Banglish'
