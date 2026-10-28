import { KIND_LABEL, timeline, formatMinutes } from '../utils/serviceOrder'

// 공유 화면의 예배 순서표 (찬양을 누르면 그 곡으로 이동)
export default function PublicServiceOrder({ setlist, currentIdx, onSelectSong, onClose }) {
  const songs = setlist.songs || []
  const rows = (setlist.items || []).map((it, i) => ({ ...it, key: i, song: it.songIndex >= 0 ? String(it.songIndex) : null }))
  const byIndex = new Map(songs.map((s, i) => [String(i), s]))
  const times = timeline(rows, setlist.startTime, byIndex)

  return (
    <div className="public-order">
      <div className="public-order-head">
        <b>예배 순서</b>
        <span>
          {[setlist.serviceType, setlist.startTime && `${setlist.startTime} 시작`, `총 ${formatMinutes(times.total)}`].filter(Boolean).join(' · ')}
        </span>
        <button type="button" className="secondary" onClick={onClose}>닫기</button>
      </div>
      <ol>
        {rows.map((row, i) => {
          const song = row.kind === 'song' ? byIndex.get(row.song) : null
          const isCurrent = song && row.songIndex === currentIdx
          return (
            <li key={row.key} className={`order-row kind-${row.kind}${isCurrent ? ' current' : ''}`}
              onClick={song ? () => { onSelectSong(row.songIndex); onClose() } : undefined}
              style={song ? { cursor: 'pointer' } : undefined}>
              <span className="order-time">{times.list[i].at && <b>{times.list[i].at}</b>}<span>{times.list[i].minutes}분</span></span>
              <span className={`kind-tag kind-tag-${row.kind}`}>{KIND_LABEL[row.kind]}</span>
              <span className="public-order-title">
                {song ? <>{song.title}{song.key && <b> · {song.key}</b>}</> : row.title}
                {row.note && <small> — {row.note}</small>}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
