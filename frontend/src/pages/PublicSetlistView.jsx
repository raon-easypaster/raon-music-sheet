import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicSetlist } from '../api/setlists'
import SongViewer from '../components/SongViewer'

export default function PublicSetlistView() {
  const { token } = useParams()
  const [setlist, setSetlist] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewingSong, setViewingSong] = useState(null)

  useEffect(() => {
    getPublicSetlist(token)
      .then(setSetlist)
      .catch(err => setError(err.message || '유효하지 않은 링크입니다'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="dashboard">
      <div className="card panel">불러오는 중...</div>
    </div>
  )

  if (error) return (
    <div className="dashboard">
      <div className="card panel" style={{ textAlign: 'center', padding: 40 }}>
        <h2>😕</h2>
        <p>{error}</p>
      </div>
    </div>
  )

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h1>RAON music sheet</h1>
          <p className="muted">찬양팀 악보 & 콘티 관리</p>
        </div>
      </header>

      <div className="card panel">
        <h2>{setlist.name}</h2>
        <p className="muted" style={{ marginBottom: 16 }}>총 {setlist.songs.length}곡</p>

        <ul className="item-list">
          {setlist.songs.map((song, idx) => (
            <li key={song._id} className="item-row">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <span className="song-order">{idx + 1}.</span>
                  <strong>{song.title}</strong>
                  {song.artist && <span className="muted"> — {song.artist}</span>}
                  <div className="badge-row">
                    {song.key && <span className="badge badge-key">{song.key}</span>}
                    {song.bpm > 0 && <span className="badge badge-bpm">{song.bpm} BPM</span>}
                    {song.youtubeUrl && <span className="badge badge-link">YT</span>}
                    {song.sheetImageUrl && <span className="badge badge-link">악보</span>}
                    {song.sheetPdfUrl && <span className="badge badge-link">PDF</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className="secondary"
                  style={{ fontSize: 13 }}
                  onClick={() => setViewingSong(song)}
                >
                  보기
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {viewingSong && (
        <SongViewer song={viewingSong} onClose={() => setViewingSong(null)} />
      )}
    </div>
  )
}
