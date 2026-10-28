// 곡의 악보(여러 Key·여러 장)와 콘티 Key에 맞는 악보 고르기
// 서버 backend/utils/sheets.js와 같은 규칙이다. 한쪽을 바꾸면 다른 쪽도 함께 고친다.

export const LEGACY_SHEET = 'legacy'
export const LEGACY_IMAGE_PAGE = 'legacy-img'

const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' }
export function normalizeKey(key) {
  const m = String(key || '').trim().match(/^([A-Ga-g])([#b♯♭]?)(m|min|minor)?$/)
  if (!m) return String(key || '').trim()
  let root = m[1].toUpperCase() + (m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2])
  root = FLAT_TO_SHARP[root] || root
  return root + (m[3] ? 'm' : '')
}
export const keysEqual = (a, b) => !!a && !!b && normalizeKey(a) === normalizeKey(b)

export const newSheetId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

// 곡에 실제로 쓰는 악보 목록. sheets가 비어 있으면 예전 칸(사진 주소·PDF 주소)을 'Key 미확인' 악보로 본다
export function effectiveSheets(song) {
  if (song?.sheets?.length) return song.sheets
  const out = []
  if (song?.sheetImageUrl) {
    out.push({ id: LEGACY_SHEET, key: '', label: '', pages: [{ id: LEGACY_IMAGE_PAGE, type: 'image', url: song.sheetImageUrl }] })
  }
  if (song?.sheetPdfUrl) {
    out.push({ id: 'legacy-pdf', key: '', label: 'PDF', pages: [{ id: 'legacy-pdf', type: 'pdf', url: song.sheetPdfUrl }] })
  }
  return out
}

// keyState: match | mismatch | unknown(악보 Key 미확인) | nokey(콘티 Key 없음) | none(악보 없음)
export function pickSheet(sheets, wantKey, chosenId) {
  if (!sheets.length) return { sheet: null, keyState: 'none', chosen: false }
  const state = (sheet) => {
    if (!wantKey) return 'nokey'
    if (!sheet.key) return 'unknown'
    return keysEqual(sheet.key, wantKey) ? 'match' : 'mismatch'
  }
  const chosen = chosenId && sheets.find((s) => s.id === chosenId)
  if (chosen) return { sheet: chosen, keyState: state(chosen), chosen: true }
  const match = wantKey && sheets.find((s) => keysEqual(s.key, wantKey))
  const sheet = match || sheets[0]
  return { sheet, keyState: state(sheet), chosen: false }
}

// 콘티 안의 곡 하나: 부를 Key와 고른 악보
export function songSheetChoice(song, setting) {
  const key = setting?.key || song.key || ''
  const sheets = effectiveSheets(song)
  return { key, sheets, ...pickSheet(sheets, key, setting?.sheetId) }
}

export const sheetName = (sheet) =>
  sheet ? `${sheet.key ? `${sheet.key} 악보` : 'Key 미확인 악보'}${sheet.label ? ` (${sheet.label})` : ''}` : ''

// 화면에 보여 줄 Key 비교 문장 (일치하거나 비교할 것이 없으면 '')
export function keyStateText({ keyState, key, sheet }) {
  if (keyState === 'mismatch') return `이번 Key는 ${key}, 등록 악보는 ${sheet.key}입니다`
  if (keyState === 'unknown') return `악보 Key 미확인 (이번 Key ${key})`
  return ''
}

// 악보 페이지 수 (PDF는 열어 봐야 알 수 있어 1장으로 센다)
export const pageCount = (sheet) => sheet?.pages?.length || 0
