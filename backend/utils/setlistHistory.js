// 콘티 수정 이력: 바뀌기 전·후 내용을 비교해 '2번 곡 Key C → D 변경'처럼 읽기 쉬운 내역을 만든다
const { effectiveSheets } = require('./sheets')

const KIND_LABEL = {
  slot: '찬양 자리', prayer: '기도', word: '말씀', announce: '광고',
  offering: '헌금', blessing: '축도', other: '기타', song: '찬양',
}

const str = (v) => (v === undefined || v === null ? '' : String(v))
const idOf = (v) => str(v?._id || v)

// 이력에 남기고 복원할 때 쓰는 콘티 내용
function snapshot(setlist) {
  return {
    name: str(setlist.name),
    venue: str(setlist.venue),
    gigDate: setlist.gigDate ? new Date(setlist.gigDate).toISOString() : null,
    notes: str(setlist.notes),
    serviceType: str(setlist.serviceType),
    startTime: str(setlist.startTime),
    songs: (setlist.songs || []).map(idOf),
    items: (setlist.items || []).map((it) => ({
      kind: it.kind,
      song: it.song ? idOf(it.song) : null,
      title: str(it.title),
      minutes: Number(it.minutes) || 0,
      note: str(it.note),
    })),
    songSettings: (setlist.songSettings || []).map((s) => ({
      song: idOf(s.song),
      key: str(s.key),
      notes: str(s.notes),
      sheetId: str(s.sheetId),
    })),
    status: setlist.status || 'draft',
  }
}

const dayText = (iso) => {
  if (!iso) return '없음'
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${Number(m)}월 ${Number(d)}일`
}
const orNone = (v) => v || '없음'

// before, after: snapshot() 결과. songs: Map(곡 id → { title, key, sheets… })
function describeChanges(before, after, songs) {
  const out = []
  const title = (id) => `‘${songs.get(id)?.title || '삭제된 곡'}’`
  const setting = (snap, id) => snap.songSettings.find((s) => s.song === id) || { key: '', notes: '', sheetId: '' }
  const effKey = (snap, id) => setting(snap, id).key || songs.get(id)?.key || ''
  const sheetName = (id, sheetId) => {
    if (!sheetId) return '자동(Key에 맞춤)'
    const sheet = songs.get(id) && effectiveSheets(songs.get(id)).find((s) => s.id === sheetId)
    if (!sheet) return '지워진 악보'
    return `${sheet.key ? `${sheet.key} 악보` : 'Key 미확인 악보'}${sheet.label ? `(${sheet.label})` : ''}`
  }

  if (before.name !== after.name) out.push(`콘티 이름 ‘${before.name}’ → ‘${after.name}’`)
  if (before.gigDate?.slice(0, 10) !== after.gigDate?.slice(0, 10)) out.push(`예배 날짜 ${dayText(before.gigDate)} → ${dayText(after.gigDate)}`)
  if (before.startTime !== after.startTime) out.push(`시작 시각 ${orNone(before.startTime)} → ${orNone(after.startTime)}`)
  if (before.serviceType !== after.serviceType) out.push(`예배 종류 ${orNone(before.serviceType)} → ${orNone(after.serviceType)}`)
  if (before.venue !== after.venue) out.push(`장소 ${orNone(before.venue)} → ${orNone(after.venue)}`)
  if (before.notes !== after.notes) out.push('콘티 메모 변경')

  // 곡 추가·삭제·순서
  const had = new Set(before.songs)
  const has = new Set(after.songs)
  after.songs.forEach((id, i) => { if (!had.has(id)) out.push(`${title(id)} 추가 (${i + 1}번 곡)`) })
  before.songs.forEach((id) => { if (!has.has(id)) out.push(`${title(id)} 삭제`) })
  const keptBefore = before.songs.filter((id) => has.has(id))
  const keptAfter = after.songs.filter((id) => had.has(id))
  if (keptBefore.join() !== keptAfter.join()) {
    out.push(`곡 순서 변경 → ${after.songs.map((id, i) => `${i + 1}.${songs.get(id)?.title || '?'}`).join(' ')}`)
  }

  // 곡마다 이 콘티에서만 쓰는 Key·메모·악보 선택
  after.songs.forEach((id, i) => {
    if (!had.has(id)) return
    const no = `${i + 1}번 곡 ${title(id)}`
    const [kb, ka] = [effKey(before, id), effKey(after, id)]
    if (kb !== ka) out.push(`${no} Key ${orNone(kb)} → ${orNone(ka)}`)
    if (setting(before, id).notes !== setting(after, id).notes) out.push(`${no} 메모 변경`)
    const [sb, sa] = [setting(before, id).sheetId, setting(after, id).sheetId]
    if (sb !== sa) out.push(`${no} 악보 선택 ${sheetName(id, sb)} → ${sheetName(id, sa)}`)
  })

  // 예배 순서 (곡이 아닌 항목, 곡 항목의 시간·메모)
  const label = (it) => (it.kind === 'song' ? title(it.song) : `‘${it.title || KIND_LABEL[it.kind] || it.kind}’`)
  const sig = (it) => (it.kind === 'song' ? `song|${it.song}` : `${it.kind}|${it.title}`)
  const beforeItems = new Map(before.items.map((it) => [sig(it), it]))
  const afterItems = new Map(after.items.map((it) => [sig(it), it]))
  for (const [k, it] of afterItems) {
    if (it.kind === 'song') continue
    if (!beforeItems.has(k)) out.push(`예배 순서 ${label(it)} 추가`)
  }
  for (const [k, it] of beforeItems) {
    if (it.kind === 'song') continue
    if (!afterItems.has(k)) out.push(`예배 순서 ${label(it)} 삭제`)
  }
  for (const [k, a] of afterItems) {
    const b = beforeItems.get(k)
    if (!b) continue
    if (b.minutes !== a.minutes) out.push(`${label(a)} 시간 ${b.minutes}분 → ${a.minutes}분`)
    if (b.note !== a.note) out.push(`${label(a)} 순서 메모 변경`)
  }
  const nonSong = (items) => items.map(sig).join('>')
  if (
    before.items.length && after.items.length &&
    nonSong(before.items.filter((it) => afterItems.has(sig(it)))) !== nonSong(after.items.filter((it) => beforeItems.has(sig(it)))) &&
    keptBefore.join() === keptAfter.join()
  ) {
    out.push('예배 순서 자리 변경')
  }

  if (before.status !== after.status) out.push(after.status === 'confirmed' ? '콘티 확정' : '확정 해제 (작성 중으로)')
  return out
}

module.exports = { snapshot, describeChanges, KIND_LABEL }
