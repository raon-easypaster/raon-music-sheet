// 곡 분류 항목 정리 — 화면에서 오든 data30.json에서 오든 같은 규칙으로 저장한다

const TEMPOS = ['느림', '보통', '빠름']

// BPM으로 빠르기 짐작 (BPM이 없으면 '')
function tempoFromBpm(bpm) {
  const n = Number(bpm) || 0
  if (!n) return ''
  if (n < 80) return '느림'
  if (n <= 110) return '보통'
  return '빠름'
}

const text = (v, max) => String(v ?? '').trim().slice(0, max)

// 쉼표로 쓴 문자열도 받아 준다. 중복 제거, 개수·길이 제한
function tags(v, maxCount = 20, maxLen = 20) {
  const list = Array.isArray(v) ? v : String(v ?? '').split(',')
  const out = []
  for (const item of list) {
    const t = text(item, maxLen).replace(/^#/, '')
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= maxCount) break
  }
  return out
}

const number = (v, min, max) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : 0
}

// 들어온 분류 값 중 보낸 것만 정리해서 돌려준다
function cleanSongMeta(body) {
  const out = {}
  if (body.tempo !== undefined) out.tempo = TEMPOS.includes(body.tempo) ? body.tempo : ''
  if (body.timeSignature !== undefined) out.timeSignature = text(body.timeSignature, 10)
  if (body.themes !== undefined) out.themes = tags(body.themes)
  if (body.target !== undefined) out.target = text(body.target, 20)
  if (body.traits !== undefined) out.traits = tags(body.traits, 10)
  if (body.hymnNumber !== undefined) out.hymnNumber = text(body.hymnNumber, 20)
  if (body.scripture !== undefined) out.scripture = text(body.scripture, 100)
  if (body.lyricist !== undefined) out.lyricist = text(body.lyricist, 60)
  if (body.composer !== undefined) out.composer = text(body.composer, 60)
  if (body.durationMin !== undefined) out.durationMin = number(body.durationMin, 0, 60)
  return out
}

module.exports = { TEMPOS, tempoFromBpm, cleanSongMeta }
