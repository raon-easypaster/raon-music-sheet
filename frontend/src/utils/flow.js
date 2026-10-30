// 콘티별 곡 진행(송폼): 실제로 부르는 순서대로 칸을 늘어놓는다
// 칸 = { part, n(번호, 0=없음), times(반복 1~9), note(짧은 메모), label(직접 입력 칸 이름) }
// 서버 backend/utils/flow.js와 같은 규칙이다. 한쪽을 바꾸면 다른 쪽도 함께 고친다.

export const FLOW_PARTS = {
  intro: { code: 'Intro', name: '인트로' },
  verse: { code: 'V', name: 'Verse', numbered: true },
  pre: { code: 'Pre', name: 'Pre-chorus', numbered: true },
  chorus: { code: 'C', name: '후렴(Chorus)', numbered: true },
  bridge: { code: 'B', name: '브릿지', numbered: true },
  inter: { code: '간주', name: '간주' },
  outro: { code: 'Outro', name: '아웃트로' },
  ending: { code: '엔딩', name: '엔딩' },
  etc: { code: '', name: '직접 입력' },
}
export const FLOW_MAX = 40
export const FLOW_NOTE_MAX = 40
export const FLOW_LABEL_MAX = 12

const int = (v, min, max, dflt) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : dflt
}

export function cleanFlow(raw) {
  if (!Array.isArray(raw)) return []
  const out = []
  for (const it of raw.slice(0, FLOW_MAX)) {
    const part = String(it?.part || '')
    if (!FLOW_PARTS[part]) continue
    const label = part === 'etc' ? String(it.label || '').trim().slice(0, FLOW_LABEL_MAX) : ''
    if (part === 'etc' && !label) continue
    out.push({
      part,
      n: FLOW_PARTS[part].numbered ? int(it.n, 0, 9, 0) : 0,
      times: int(it.times, 1, 9, 1),
      note: String(it.note || '').trim().slice(0, FLOW_NOTE_MAX),
      label,
    })
  }
  return out
}

// 칸 하나의 짧은 이름: V1, C, Pre2 …
export const flowCode = (it) => (it.part === 'etc' ? it.label : `${FLOW_PARTS[it.part]?.code || '?'}${it.n ? it.n : ''}`)

// 'V1 → C ×2 → V2(verse 없이 바로) → C'
export function flowText(flow) {
  return (flow || []).map((it) => `${flowCode(it)}${it.times > 1 ? ` ×${it.times}` : ''}${it.note ? `(${it.note})` : ''}`).join(' → ')
}

// 곡에 적어 둔 송폼 글자(예: 'I-V1-C-V2-C×2-B-C')를 칸으로 바꾼다. 모르는 글자는 '직접 입력' 칸으로 남긴다
const ALIASES = [
  [/^(i|intro|인트로|전주)$/i, 'intro'],
  [/^(v|verse|벌스)(\d)?$/i, 'verse'],
  [/^(\d)절$/, 'verse', true],
  [/^(p|pc|pre|prechorus|프리)(\d)?$/i, 'pre'],
  [/^(c|ch|chorus|후렴)(\d)?$/i, 'chorus'],
  [/^(b|br|bridge|브릿지)(\d)?$/i, 'bridge'],
  [/^(it|int|inter|interlude|간주)$/i, 'inter'],
  [/^(o|out|outro|아웃트로)$/i, 'outro'],
  [/^(e|end|ending|엔딩|마무리)$/i, 'ending'],
]
export function parseStructure(text) {
  const out = []
  for (const raw of String(text || '').replace(/pre[-\s]?chorus/gi, 'prechorus').split(/[\s,\-–—→>/|]+/)) {
    if (!raw) continue
    const alone = raw.match(/^[x×*](\d)$/i) // 'C x2'처럼 띄어 쓴 반복은 앞 칸에 붙인다
    if (alone && out.length) { out[out.length - 1].times = Number(alone[1]); continue }
    const rep = raw.match(/^(.+?)\s*[x×*](\d)$/i)
    const word = rep ? rep[1] : raw
    const times = rep ? Number(rep[2]) : 1
    let item = null
    for (const [re, part, numFirst] of ALIASES) {
      const m = word.match(re)
      if (!m) continue
      item = { part, n: numFirst ? Number(m[1]) : Number(m[2] || 0), times, note: '', label: '' }
      break
    }
    out.push(item || { part: 'etc', n: 0, times, note: '', label: word.slice(0, FLOW_LABEL_MAX) })
  }
  return cleanFlow(out)
}
