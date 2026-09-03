import { useState } from 'react'
import SongViewer from './SongViewer'

export default function SongList({ songs, onDelete }) {
  const [viewing, setViewing] = useState(null)

  return (
    <div className="card panel">
      <h2>전체 곡 목록</h2>

      {songs.length === 0 && <p className="muted">등록된 곡이 없습니다</p>}

      {songs.map((song) => (
        <div key={song._id} className="item-row">
          <div className="song-info">
            <strong>{song.title}</strong>
            <span className="muted">{song.artist}</span>
            <div className="badge-row">
              {song.key && <span className="badge badge-key">{song.key}</span>}
              {song.bpm > 0 && <span className="badge badge-bpm">{song.bpm} BPM</span>}
              {song.youtubeUrl && <span className="badge badge-link">YT</span>}
              {song.sheetImageUrl && <span className="badge badge-link">악보</span>}
              {song.sheetPdfUrl && <span className="badge badge-link">PDF</span>}
            </div>
          </div>
          <div className="song-actions">
            <button className="secondary" onClick={() => setViewing(song)}>보기</button>
            <button onClick={() => onDelete(song._id)}>삭제</button>
          </div>
        </div>
      ))}

      <SongViewer song={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
