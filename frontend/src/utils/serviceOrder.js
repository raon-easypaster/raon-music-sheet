// 예배 순서(찬양 외 기도·말씀·광고 …) 항목 종류와 시간 계산
import { DEFAULT_SONG_MINUTES } from './songMeta'

export const ITEM_KINDS = [
  { value: 'prayer',   label: '기도',      minutes: 3 },
  { value: 'word',     label: '말씀',      minutes: 30 },
  { value: 'announce', label: '광고',      minutes: 5 },
  { value: 'offering', label: '헌금',      minutes: 3 },
  { value: 'blessing', label: '축도',      minutes: 2 },
  { value: 'slot',     label: '찬양 자리', minutes: DEFAULT_SONG_MINUTES },
  { value: 'other',    label: '기타',      minutes: 5 },
]
export const KIND_LABEL = Object.fromEntries([['song', '찬양'], ...ITEM_KINDS.map((k) => [k.value, k.label])])

export const SERVICE_TYPES = ['주일 1부', '주일 2부', '주일 3부', '청년부', '중고등부', '수요예배', '금요기도회', '새벽기도', '특별집회']

// 콘티를 화면 순서 목록으로: items가 있으면 그대로, 없으면 곡만
export function buildRows(setlist, songsById) {
  const items = setlist?.items || []
  if (items.length) {
    return items
      .filter((it) => it.kind !== 'song' || songsById.has(String(it.song)))
      .map((it, i) => ({ ...it, key: it._id || `i${i}`, song: it.song ? String(it.song) : null }))
  }
  return [...songsById.keys()].map((id) => ({ key: id, kind: 'song', song: id, title: '', minutes: 0, note: '' }))
}

// 저장용 (화면 전용 값은 뺀다)
export const toPayload = (rows) =>
  rows.map(({ kind, song, title, minutes, note }) => ({ kind, song: kind === 'song' ? song : null, title, minutes: Number(minutes) || 0, note }))

export function rowMinutes(row, song) {
  if (row.minutes > 0) return row.minutes
  if (row.kind === 'song') return song?.durationMin || DEFAULT_SONG_MINUTES
  return ITEM_KINDS.find((k) => k.value === row.kind)?.minutes || 0
}

// 'HH:MM' + 분 → 'HH:MM'
export function addMinutes(hhmm, minutes) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const total = (h * 60 + m + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// 각 항목의 시작 시각과 총 시간
export function timeline(rows, startTime, songsById) {
  let elapsed = 0
  const list = rows.map((row) => {
    const minutes = rowMinutes(row, songsById.get(row.song))
    const at = startTime ? addMinutes(startTime, elapsed) : ''
    elapsed += minutes
    return { minutes, at }
  })
  return { list, total: elapsed, end: startTime ? addMinutes(startTime, elapsed) : '' }
}

export const formatMinutes = (n) => (n >= 60 ? `${Math.floor(n / 60)}시간${n % 60 ? ` ${n % 60}분` : ''}` : `${n}분`)
