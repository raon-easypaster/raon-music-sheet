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
