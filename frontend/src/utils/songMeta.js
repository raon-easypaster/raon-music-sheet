// 곡 분류 항목·상세 검색·사용 횟수·콘티 점검 — 곡 목록, 곡 선택 창, 콘티 화면이 함께 쓴다
import { isoToDateInput, toDateInput, addDays } from './dates'

export const TEMPOS = ['느림', '보통', '빠름']
export const TIME_SIGNATURES = ['4/4', '3/4', '6/8', '12/8', '2/4']
export const TARGETS = ['하나님', '예수님', '성령님', '사람에 대한 권면', '공동체']
export const TRAITS = ['경배', '찬양', '고백', '선포', '감사', '결단', '회개', '기도', '치유·위로', '축복', '파송']
export const THEMES = ['예배', '은혜', '사랑', '십자가', '보혈', '부활', '믿음', '소망', '헌신', '선교', '평안', '말씀', '교회', '하나님 나라', '재림']
export const SEASONS = ['대림절', '성탄절', '송구영신', '신년', '사순절', '종려주일', '고난주간', '부활절', '성령강림절', '맥추감사절', '추수감사절', '어린이주일', '어버이주일', '종교개혁주일']

// 이 곡들에 쓰인 태그 중 추천 목록에 없는 것 (직접 넣은 주제) — 가나다순
export function customThemes(songs = []) {
  const set = new Set(songs.flatMap((s) => s.themes || []))
  return [...set].filter((t) => !THEMES.includes(t) && !SEASONS.includes(t)).sort((a, b) => a.localeCompare(b, 'ko'))
}

// 곡 길이를 모를 때 예배 시간 계산에 쓰는 값
export const DEFAULT_SONG_MINUTES = 4

export function tempoFromBpm(bpm) {
  const n = Number(bpm) || 0
  if (!n) return ''
  if (n < 80) return '느림'
  if (n <= 110) return '보통'
  return '빠름'
}

const META_DEFAULTS = { tempo: '', timeSignature: '', themes: [], target: '', traits: [], hymnNumber: '', scripture: '', lyricist: '', composer: '', durationMin: '' }

// 수정 창에 넣을 분류 값
export const metaFormValues = (song = {}) =>
  Object.fromEntries(Object.entries(META_DEFAULTS).map(([k, d]) => [k, Array.isArray(d) ? [...(song[k] || [])] : (song[k] || d)]))

export const EMPTY_META = metaFormValues()

// 곡마다 부른 기록 → Map(id → { total, recent, last }) — recent = 최근 3개월
export function usageStats(setlists, today = toDateInput(new Date())) {
  const since = addDays(today, -91)
  const map = new Map()
  for (const sl of setlists) {
    const date = isoToDateInput(sl.gigDate)
    if (!date || date > today) continue
    for (const s of sl.songs || []) {
      const id = typeof s === 'string' ? s : s._id
      const u = map.get(id) || { total: 0, recent: 0, last: '' }
      u.total += 1
      if (date >= since) u.recent += 1
      if (date > u.last) u.last = date
      map.set(id, u)
    }
  }
  return map
}

// 상세 검색 조건 (빈 값은 조건 없음)
// 주제·절기 태그가 하나도 없는 곡 (상세 검색의 특별한 값)
export const NO_THEME = '__none'
export const hasNoTheme = (s) => !(s.themes || []).length

export const EMPTY_FILTERS = { tempo: '', timeSignature: '', tag: '', target: '', trait: '', usage: '' }

export const USAGE_FILTERS = [
  { value: 'never', label: '아직 안 부른 곡' },
  { value: 'stale', label: '3개월 넘게 안 부른 곡' },
  { value: 'recent', label: '최근 3개월에 부른 곡' },
]

export function applyMetaFilters(songs, f, usage, today = toDateInput(new Date())) {
  const since = addDays(today, -91)
  return songs.filter((s) => {
    if (f.tempo && (s.tempo || tempoFromBpm(s.bpm)) !== f.tempo) return false
    if (f.timeSignature && s.timeSignature !== f.timeSignature) return false
    if (f.tag === NO_THEME) { if ((s.themes || []).length) return false }
    else if (f.tag && !(s.themes || []).includes(f.tag)) return false
    if (f.target && s.target !== f.target) return false
    if (f.trait && !(s.traits || []).includes(f.trait)) return false
    if (f.usage) {
      const u = usage?.get(s._id)
      if (f.usage === 'never' && u) return false
      if (f.usage === 'stale' && (!u || u.last >= since)) return false
      if (f.usage === 'recent' && !u?.recent) return false
    }
    return true
  })
}

export const activeFilterCount = (f) => Object.values(f).filter(Boolean).length

// 많이 부른 순 / 오래 안 부른 순
export function sortByUsage(songs, usage, by) {
  const get = (s) => usage.get(s._id) || { total: 0, recent: 0, last: '' }
  return [...songs].sort((a, b) => {
    const ua = get(a), ub = get(b)
    if (by === 'most') return ub.recent - ua.recent || ub.total - ua.total || (a.title || '').localeCompare(b.title || '', 'ko')
    // 오래 안 부른 순: 부른 적 있는 곡 중 마지막 날이 오래된 순, 안 부른 곡은 맨 뒤
    if (!ua.last !== !ub.last) return ua.last ? -1 : 1
    return ua.last.localeCompare(ub.last) || (a.title || '').localeCompare(b.title || '', 'ko')
  })
}

export function usageText(u) {
  if (!u) return '아직 부른 기록 없음'
  return `최근 3개월 ${u.recent}회 · 전체 ${u.total}회`
}

// 콘티 자동 점검 — 저장은 막지 않고 알려만 준다
// songs: 콘티 곡(콘티에서 바꾼 Key 반영), usage: 이 콘티를 뺀 부른 기록
export function checkSetlist(songs, usage) {
  const warnings = []
  if (songs.length === 0) return warnings

  const fresh = songs.filter((s) => !usage.get(s._id))
  if (fresh.length >= 2) {
    warnings.push(`처음 부르는 곡이 ${fresh.length}곡이에요 (${fresh.map((s) => s.title).join(', ')}). 팀이 익숙하지 않을 수 있어요.`)
  }

  const keys = [...new Set(songs.map((s) => s.key).filter(Boolean))]
  if (keys.length >= 3) warnings.push(`Key가 ${keys.length}종류예요 (${keys.join(', ')}). 전조가 많으면 흐름이 끊길 수 있어요.`)

  const seasons = [...new Set(songs.flatMap((s) => (s.themes || []).filter((t) => SEASONS.includes(t))))]
  if (seasons.length >= 2) warnings.push(`여러 절기 곡이 섞여 있어요 (${seasons.join(', ')}).`)

  const tempos = songs.map((s) => s.tempo || tempoFromBpm(s.bpm))
  if (songs.length >= 3 && tempos.every((t) => t === '빠름')) warnings.push('모든 곡이 빠른 곡이에요. 중간에 느린 곡을 넣어 보세요.')
  if (songs.length >= 3 && tempos.every((t) => t === '느림')) warnings.push('모든 곡이 느린 곡이에요.')

  if (songs.length >= 2 && songs.every((s) => s.target === '사람에 대한 권면')) {
    warnings.push('모든 곡이 "사람에 대한 권면" 곡이에요. 하나님을 향한 찬양을 함께 넣어 보세요.')
  }
  return warnings
}
