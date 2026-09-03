import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPublicSetlist, getPublicCurrentSong, setPublicCurrentSong } from '../api/setlists'

function getYoutubeEmbedId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch { return null }
}

export default function PublicSetlistView() {
  const { token } = useParams()
  const [setlist, setSetlist] = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPublicSetlist(token)
      .then(data => setSetlist(data))
      .catch(err => setError(err.message || '유효하지 않은 링크입니다'))
      .finally(() => setLoading(false))
  }, [token])

  // 3초마다 현재 곡 인덱스 동기화
  useEffect(() => {
    if (!setlist) return
    const poll = async () => {
      try {
        const { index } = await getPublicCurrentSong(token)
        setCurrentIdx(index)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [token, setlist])

  async function handleSelectSong(idx) {
    setCurrentIdx(idx)
    try { await setPublicCurrentSong(token, idx) } catch {}
  }

  if (loading) return (
    <div className="dashboard">
      <div className="card panel">불러오는 중...</div>
    </div>
  )

  if (error) return (
    <div className="dashboard">
      <div className="card panel" style={{ textAlign: 'center', padding: 40 }}>
        <h2>😕</h2><p>{error}</p>
      </div>
    </div>
  )

  const song = setlist.songs[currentIdx] || setlist.songs[0]

  return (
    <div className="dashboard">
      <header className="topbar">
        <div>
          <h1>RAON music sheet</h1>
          <p className="muted">{setlist.name}</p>
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>🔴 실시간 동기화 중</span>
      </header>

      <div className="share-grid" style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}>
        {/* 곡 목록 */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700 }}>
            곡 목록 <span style={{ fontWeight: 400, color: '#94a3b8' }}>{setlist.songs.length}곡</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {setlist.songs.map((s, idx) => (
              <li
                key={s._id}
                onClick={() => handleSelectSong(idx)}
                style={{
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: idx === currentIdx ? '#f0fdf4' : 'transparent',
                  borderLeft: `3px solid ${idx === currentIdx ? '#15803d' : 'transparent'}`,
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: idx === currentIdx ? 700 : 400, color: idx === currentIdx ? '#14532d' : '#1e293b' }}>
                  <span style={{ color: '#94a3b8', marginRight: 5, fontSize: 11 }}>{idx + 1}</span>
                  {s.title}
                </div>
                {(s.key || s.bpm > 0) && (
                  <div style={{ marginTop: 3 }}>
                    {s.key && <span className="badge badge-key" style={{ fontSize: 10 }}>{s.key}</span>}
                    {s.bpm > 0 && <span className="badge badge-bpm" style={{ fontSize: 10, marginLeft: 3 }}>{s.bpm}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 현재 곡 악보 */}
        {song ? <SongContent song={song} /> : (
          <div className="card panel"><p className="muted">곡이 없습니다</p></div>
        )}
      </div>
    </div>
  )
}

function SongContent({ song }) {
  const youtubeId = getYoutubeEmbedId(song.youtubeUrl)

  return (
    <div className="card panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>{song.title}</h2>
          {song.artist && <p className="muted" style={{ margin: '4px 0 0' }}>{song.artist}</p>}
        </div>
        <div className="badge-row">
          {song.key && <span className="badge badge-key">🎵 {song.key}</span>}
          {song.bpm > 0 && <span className="badge badge-bpm">♩ {song.bpm} BPM</span>}
        </div>
      </div>

      {song.notes && (
        <div className="viewer-notes" style={{ marginBottom: 16 }}>
          <strong>메모</strong>
          <p style={{ margin: '4px 0 0' }}>{song.notes}</p>
        </div>
      )}

      {song.sheetImageUrl && (
        <div className="viewer-section">
          <h3>악보</h3>
          <img src={song.sheetImageUrl} alt="악보" className="sheet-image" />
        </div>
      )}

      {youtubeId && (
        <div className="viewer-section">
          <h3>YouTube</h3>
          <div className="youtube-wrap">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="YouTube"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {song.mrUrl && (
        <div className="viewer-section">
          <h3>MR / 반주</h3>
          <a href={song.mrUrl} target="_blank" rel="noopener noreferrer" className="link-btn">🎧 MR 열기</a>
        </div>
      )}

      {song.sheetPdfUrl && (
        <div className="viewer-section">
          <h3>악보 (PDF)</h3>
          <a href={song.sheetPdfUrl} target="_blank" rel="noopener noreferrer" className="link-btn">📄 PDF 열기</a>
        </div>
      )}

      {!youtubeId && !song.mrUrl && !song.sheetImageUrl && !song.sheetPdfUrl && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 24 }}>등록된 악보·링크가 없습니다</p>
      )}
    </div>
  )
}
