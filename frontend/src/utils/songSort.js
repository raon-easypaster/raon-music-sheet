// 곡 목록 탭과 콘티의 곡 선택 창이 같은 기준으로 검색·정렬하도록 함께 쓰는 함수

export const KEY_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
                          'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

// 코드가 없는 곡은 코드순 정렬에서 맨 뒤로
const keyRank = (key) => {
  const i = KEY_ORDER.indexOf(key || '')
  return i === -1 ? KEY_ORDER.length : i
}

export function sortSongs(songs, by) {
  if (by === 'default') return songs
  return [...songs].sort((a, b) => {
    if (by === 'title')  return (a.title  || '').localeCompare(b.title  || '', 'ko')
    if (by === 'artist') return (a.artist || '').localeCompare(b.artist || '', 'ko')
    if (by === 'key')    return keyRank(a.key) - keyRank(b.key) || (a.title || '').localeCompare(b.title || '', 'ko')
    if (by === 'bpm')    return (a.bpm || 0) - (b.bpm || 0)
    return 0
  })
}

// 제목·아티스트·코드 중 하나라도 검색어를 포함하면 보여 준다
export function filterSongs(songs, search) {
  const q = search.trim().toLowerCase()
  if (!q) return songs
  return songs.filter((s) => [s.title, s.artist, s.key].some((v) => v?.toLowerCase().includes(q)))
}

// Key별 곡 수 → [['C', 3], ['D', 5], ..., ['none', 2]] (Key 순서대로, Key 없는 곡은 맨 뒤 'none')
export function countByKey(songs) {
  const counts = new Map()
  for (const song of songs) {
    const key = song.key || ''
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const known = KEY_ORDER.filter((k) => counts.has(k)).map((k) => [k, counts.get(k)])
  const others = [...counts].filter(([k]) => k && !KEY_ORDER.includes(k))
  return counts.has('') ? [...known, ...others, ['none', counts.get('')]] : [...known, ...others]
}

// countByKey의 Key 값으로 곡 거르기 ('' = 전체, 'none' = Key 없는 곡)
export function filterByKey(songs, key) {
  if (!key) return songs
  return songs.filter((s) => (key === 'none' ? !s.key : s.key === key))
}
