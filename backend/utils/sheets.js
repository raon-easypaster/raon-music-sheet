// 곡의 악보(여러 Key·여러 장) 정리와 콘티 Key에 맞는 악보 고르기
// 화면 쪽 frontend/src/utils/sheets.js와 같은 규칙이다. 한쪽을 바꾸면 다른 쪽도 함께 고친다.
const crypto = require('crypto')
const { cleanFlow, flowText } = require('./flow')

const MAX_SHEETS = 10
const MAX_PAGES = 30
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/
const PAGE_TYPES = ['image', 'pdf']

// 예전 방식(sheetImageUrl·sheetPdfUrl 한 칸씩)으로 넣은 악보를 가리키는 고정 번호
const LEGACY_SHEET = 'legacy'
const LEGACY_PDF_SHEET = 'legacy-pdf'
const LEGACY_IMAGE_PAGE = 'legacy-img'
const LEGACY_PDF_PAGE = 'legacy-pdf'

// Db와 C#처럼 이름만 다른 Key는 같은 Key로 본다
const FLAT_TO_SHARP = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' }
function normalizeKey(key) {
  const m = String(key || '').trim().match(/^([A-Ga-g])([#b♯♭]?)(m|min|minor)?$/)
  if (!m) return String(key || '').trim()
  let root = m[1].toUpperCase() + (m[2] === '♯' ? '#' : m[2] === '♭' ? 'b' : m[2])
  root = FLAT_TO_SHARP[root] || root
  return root + (m[3] ? 'm' : '')
}
const keysEqual = (a, b) => !!a && !!b && normalizeKey(a) === normalizeKey(b)

const newId = () => crypto.randomBytes(6).toString('hex')

// 저장해도 되는 악보 주소: 앱에 올린 파일(/api/sheets/…) 또는 http(s) 주소
function cleanUrl(v) {
  const url = String(v || '').trim().slice(0, 2000)
  if (/^\/api\/sheets\/[A-Za-z0-9_-]{20,100}$/.test(url)) return url
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? url : ''
  } catch {
    return ''
  }
}

// 곡에 실제로 쓰는 악보 목록. sheets가 비어 있으면 예전 칸을 악보로 보여 준다 (Key는 미확인)
function effectiveSheets(song) {
  if (song?.sheets?.length) {
    return song.sheets.map((s) => ({
      id: s.id,
      key: s.key || '',
      label: s.label || '',
      pages: (s.pages || []).map((p) => ({ id: p.id, type: p.type, url: p.url })),
    }))
  }
  const out = []
  if (song?.sheetImageUrl) {
    out.push({ id: LEGACY_SHEET, key: '', label: '', pages: [{ id: LEGACY_IMAGE_PAGE, type: 'image', url: song.sheetImageUrl }] })
  }
  if (song?.sheetPdfUrl) {
    out.push({ id: LEGACY_PDF_SHEET, key: '', label: 'PDF', pages: [{ id: LEGACY_PDF_PAGE, type: 'pdf', url: song.sheetPdfUrl }] })
  }
  return out
}

// 화면에서 온 악보 목록 검사 → { sheets } 또는 { error }
function cleanSheets(raw) {
  if (!Array.isArray(raw)) return { error: '악보 형식이 올바르지 않습니다' }
  if (raw.length > MAX_SHEETS) return { error: `악보는 한 곡에 ${MAX_SHEETS}개까지 넣을 수 있습니다` }
  const sheetIds = new Set()
  const pageIds = new Set()
  const sheets = []
  for (const s of raw) {
    if (!s || typeof s !== 'object') return { error: '악보 형식이 올바르지 않습니다' }
    let id = String(s.id || '')
    if (!ID_RE.test(id) || sheetIds.has(id)) id = newId()
    sheetIds.add(id)
    const pages = []
    const rawPages = Array.isArray(s.pages) ? s.pages : []
    if (rawPages.length > MAX_PAGES) return { error: `악보 한 개에는 ${MAX_PAGES}장까지 넣을 수 있습니다` }
    for (const p of rawPages) {
      if (!p || !PAGE_TYPES.includes(p.type)) return { error: '악보 페이지 형식이 올바르지 않습니다' }
      const url = cleanUrl(p.url)
      if (!url) return { error: '악보 주소가 올바르지 않습니다 (https:// 로 시작하는 주소나 앱에 올린 파일만 쓸 수 있습니다)' }
      let pid = String(p.id || '')
      if (!ID_RE.test(pid) || pageIds.has(pid)) pid = newId()
      pageIds.add(pid)
      pages.push({ id: pid, type: p.type, url })
    }
    if (!pages.length) continue // 빈 악보는 저장하지 않는다
    sheets.push({
      id,
      key: normalizeKey(String(s.key || '').slice(0, 10)),
      label: String(s.label || '').trim().slice(0, 30),
      pages,
    })
  }
  return { sheets }
}

// 예전 칸(sheetImageUrl·sheetPdfUrl)은 첫 악보의 첫 사진·첫 PDF를 따라간다 (예전 화면·내보내기용)
function mirrorFields(sheets) {
  const first = sheets[0]
  const image = first?.pages.find((p) => p.type === 'image')
  const pdf = sheets.flatMap((s) => s.pages).find((p) => p.type === 'pdf')
  return { sheetImageUrl: image?.url || '', sheetPdfUrl: pdf?.url || '' }
}

// 콘티 Key(wantKey)에 맞는 악보 고르기. chosenId가 있으면 사용자가 고른 악보
// keyState: match(같음) | mismatch(다름) | unknown(악보 Key 미확인) | nokey(콘티 Key 없음) | none(악보 없음)
function pickSheet(sheets, wantKey, chosenId) {
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

// 연습에 영향을 주는 내용(고른 악보·페이지, Key, 송폼, 콘티 메모)이 바뀌었는지 알아보는 지문
function practiceFingerprint(song, setting) {
  const key = setting?.key || song.key || ''
  const { sheet } = pickSheet(effectiveSheets(song), key, setting?.sheetId)
  const data = JSON.stringify([
    sheet ? [sheet.id, sheet.pages.map((p) => `${p.id}|${p.url}`)] : null,
    normalizeKey(key),
    song.structure || '',
    setting?.notes || '',
    // 진행을 적었을 때만 넣는다 (이 기능 전에 연습한 기록이 '재확인 필요'로 바뀌지 않게)
    ...(setting?.flow?.length ? [flowText(cleanFlow(setting.flow))] : []),
  ])
  return crypto.createHash('sha1').update(data).digest('hex').slice(0, 16)
}

// 필기 페이지 번호: 사진은 페이지 id, PDF는 'id#쪽'. 예전 사진 악보의 필기는 DB에 pageKey 없이(null) 남아 있다
const PAGE_KEY_RE = /^([A-Za-z0-9_-]{1,40})(?:#([1-9]\d{0,2}))?$/
function parsePageKey(raw) {
  if (raw === undefined || raw === null || raw === '') return { pageId: LEGACY_IMAGE_PAGE, pdfPage: 0 }
  const m = String(raw).match(PAGE_KEY_RE)
  if (!m) return null
  return { pageId: m[1], pdfPage: m[2] ? Number(m[2]) : 0 }
}
// DB에 저장하는 값: 예전 사진 페이지는 null (예전 필기와 같은 문서)
const storedPageKey = ({ pageId, pdfPage }) =>
  pageId === LEGACY_IMAGE_PAGE ? null : pdfPage ? `${pageId}#${pdfPage}` : pageId

// 이 곡의 악보에 실제로 있는 페이지인지
function songHasPage(song, { pageId, pdfPage }) {
  const page = effectiveSheets(song).flatMap((s) => s.pages).find((p) => p.id === pageId)
  if (!page) return false
  return page.type === 'pdf' ? pdfPage >= 1 : pdfPage === 0
}

module.exports = {
  MAX_SHEETS,
  MAX_PAGES,
  LEGACY_IMAGE_PAGE,
  normalizeKey,
  keysEqual,
  effectiveSheets,
  cleanSheets,
  mirrorFields,
  pickSheet,
  practiceFingerprint,
  parsePageKey,
  storedPageKey,
  songHasPage,
}
