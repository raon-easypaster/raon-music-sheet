// 예배 순서(items) 정리 규칙

const ITEM_KINDS = ['song', 'slot', 'prayer', 'word', 'announce', 'offering', 'blessing', 'other']
const MAX_ITEMS = 60

const text = (v, max) => String(v ?? '').trim().slice(0, max)
const minutes = (v) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(180, Math.max(0, n)) : 0
}

// 'HH:MM'만 받는다
function cleanStartTime(v) {
  const t = String(v ?? '').trim()
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : ''
}

// 화면에서 온 순서 목록을 정리. 곡 항목은 allowedSongIds에 있는 곡만, 같은 곡은 한 번만
function cleanItems(raw, allowedSongIds) {
  if (!Array.isArray(raw)) return null
  const allowed = new Set((allowedSongIds || []).map(String))
  const seen = new Set()
  const out = []
  for (const it of raw.slice(0, MAX_ITEMS)) {
    if (!it || !ITEM_KINDS.includes(it.kind)) continue
    const item = { kind: it.kind, title: text(it.title, 60), minutes: minutes(it.minutes), note: text(it.note, 300), song: null }
    if (it.kind === 'song') {
      const id = String(it.song?._id || it.song || '')
      if (!allowed.has(id) || seen.has(id)) continue
      seen.add(id)
      item.song = id
      item.title = ''
    }
    out.push(item)
  }
  return out
}

// 템플릿으로 옮길 때: 곡은 '찬양 자리'로 바꾼다
const toTemplateItems = (items) =>
  (items || []).map((it) => ({
    kind: it.kind === 'song' ? 'slot' : it.kind,
    title: it.kind === 'song' ? '' : it.title,
    minutes: it.minutes,
    note: it.kind === 'song' ? '' : it.note,
    song: null,
  }))

// songs 순서가 바뀌었을 때 items의 곡 자리를 새 순서로 다시 채운다.
// 없어진 곡의 항목은 빼고, items에 없던 곡은 첫 '찬양 자리'에 넣거나 맨 뒤에 붙인다
function syncItemsWithSongs(setlist) {
  if (!setlist.items || setlist.items.length === 0) return
  const order = setlist.songs.map((id) => id.toString())
  const keep = new Set(order)
  const items = setlist.items.filter((it) => it.kind !== 'song' || keep.has(String(it.song)))
  const placed = new Set(items.filter((it) => it.kind === 'song').map((it) => String(it.song)))

  for (const id of order) {
    if (placed.has(id)) continue
    const slot = items.find((it) => it.kind === 'slot')
    if (slot) {
      slot.kind = 'song'
      slot.song = id
      slot.title = ''
    } else {
      items.push({ kind: 'song', song: id, title: '', minutes: 0, note: '' })
    }
  }

  // 곡 자리는 그대로 두고, 그 자리에 들어가는 곡만 songs 순서대로 바꾼다
  let i = 0
  for (const it of items) if (it.kind === 'song') it.song = order[i++]
  setlist.items = items
}

module.exports = { ITEM_KINDS, MAX_ITEMS, cleanItems, cleanStartTime, toTemplateItems, syncItemsWithSongs }
