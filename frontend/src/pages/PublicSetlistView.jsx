import { useEffect, useRef, useState } from 'react'
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
  const [setlist,    setSetlist]    = useState(null)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [error,      setError]      = useState('')
  const [loading,    setLoading]    = useState(true)

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

  const songs = setlist.songs
  const song  = songs[currentIdx] || songs[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg, #f8fafc)' }}>
      {/* 헤더 */}
      <header className="topbar" style={{ flexShrink: 0 }}>
        <div>
          <h1>RAON music sheet</h1>
          <p className="muted">{setlist.name}</p>
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>🔴 실시간 동기화 중</span>
      </header>

      {/* 데스크톱: 2컬럼 / 모바일: 스택 */}
      <div className="share-layout" style={{ flex: 1, minHeight: 0 }}>
        {/* 사이드 곡 목록 (데스크톱에서만 보임) */}
        <aside className="share-sidebar">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', fontSize: 13, fontWeight: 700 }}>
            곡 목록 <span style={{ fontWeight: 400, color: '#94a3b8' }}>{songs.length}곡</span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, overflowY: 'auto' }}>
            {songs.map((s, idx) => (
              <li
                key={s._id}
                onClick={() => handleSelectSong(idx)}
                style={{
                  padding: '12px 14px', cursor: 'pointer',
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
                    {s.key   && <span className="badge badge-key" style={{ fontSize: 10 }}>{s.key}</span>}
                    {s.bpm > 0 && <span className="badge badge-bpm" style={{ fontSize: 10, marginLeft: 3 }}>{s.bpm}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* 메인 콘텐츠 */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {song
            ? <SongContent song={song} />
            : <div className="card panel"><p className="muted">곡이 없습니다</p></div>
          }
        </main>
      </div>

      {/* 모바일 하단 슬라이더 */}
      <MobileSongSlider
        songs={songs}
        currentIdx={currentIdx}
        onSelect={handleSelectSong}
      />

      <style>{`
        .share-layout {
          display: flex;
          gap: 16px;
          padding: 16px;
        }
        .share-sidebar {
          width: 200px;
          flex-shrink: 0;
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          align-self: flex-start;
          max-height: calc(100dvh - 120px);
          display: flex;
          flex-direction: column;
        }
        .share-sidebar ul { flex: 1; overflow-y: auto; }
        .mobile-song-bar { display: none; }

        @media (max-width: 640px) {
          .share-layout { padding: 8px; gap: 0; flex-direction: column; }
          .share-sidebar { display: none; }
          .share-layout main { padding: 0; overflow-y: visible; }
          .mobile-song-bar { display: flex; }
        }
      `}</style>
    </div>
  )
}

/* ── 모바일 하단 곡 슬라이더 ─────────────────────────────── */
function MobileSongSlider({ songs, currentIdx, onSelect }) {
  const sliderRef = useRef(null)

  // 현재 곡이 바뀌면 자동으로 해당 항목이 보이도록 스크롤
  useEffect(() => {
    const el = sliderRef.current?.querySelector(`[data-idx="${currentIdx}"]`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [currentIdx])

  function prev() { if (currentIdx > 0) onSelect(currentIdx - 1) }
  function next() { if (currentIdx < songs.length - 1) onSelect(currentIdx + 1) }

  return (
    <div
      className="mobile-song-bar"
      style={{
        flexShrink: 0,
        background: '#fff',
        borderTop: '1px solid #e2e8f0',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* ← 이전 */}
      <button
        onClick={prev}
        disabled={currentIdx === 0}
        style={{
          flexShrink: 0, width: 44, border: 'none', background: 'transparent',
          fontSize: 20, color: currentIdx === 0 ? '#cbd5e1' : '#15803d', cursor: 'pointer',
        }}
      >‹</button>

      {/* 가로 스크롤 곡 목록 */}
      <div
        ref={sliderRef}
        style={{
          flex: 1, overflowX: 'auto', display: 'flex', gap: 6,
          alignItems: 'center', padding: '10px 4px',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {songs.map((s, idx) => (
          <button
            key={s._id}
            data-idx={idx}
            onClick={() => onSelect(idx)}
            style={{
              flexShrink: 0,
              padding: '7px 14px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: idx === currentIdx ? 700 : 400,
              background: idx === currentIdx ? '#15803d' : '#f1f5f9',
              color: idx === currentIdx ? '#fff' : '#374151',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ opacity: 0.6, marginRight: 4, fontSize: 11 }}>{idx + 1}</span>
            {s.title}
            {s.key && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>{s.key}</span>
            )}
          </button>
        ))}
      </div>

      {/* → 다음 */}
      <button
        onClick={next}
        disabled={currentIdx === songs.length - 1}
        style={{
          flexShrink: 0, width: 44, border: 'none', background: 'transparent',
          fontSize: 20, color: currentIdx === songs.length - 1 ? '#cbd5e1' : '#15803d', cursor: 'pointer',
        }}
      >›</button>
    </div>
  )
}

/* ── 악보 콘텐츠 (줌 컨트롤 포함) ──────────────────────────── */
function SongContent({ song }) {
  const [scale, setScale] = useState(1)
  const youtubeId = getYoutubeEmbedId(song.youtubeUrl)

  // 곡이 바뀌면 줌 초기화
  useEffect(() => { setScale(1) }, [song._id])

  return (
    <div className="card panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{song.title}</h2>
          {song.artist && <p className="muted" style={{ margin: '4px 0 0' }}>{song.artist}</p>}
        </div>
        <div className="badge-row">
          {song.key    && <span className="badge badge-key">🎵 {song.key}</span>}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0 }}>악보</h3>
            {/* 줌 컨트롤 */}
            <div style={{ display: 'flex', gap: 5, marginLeft: 'auto' }}>
              <button
                className="secondary"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setScale(1)}
                title="화면 맞춤"
              >맞춤</button>
              <button
                className="secondary"
                style={{ fontSize: 16, padding: '4px 10px', lineHeight: 1 }}
                onClick={() => setScale(s => Math.max(0.4, +(s - 0.2).toFixed(1)))}
                title="축소"
              >−</button>
              <span style={{ fontSize: 12, color: '#64748b', minWidth: 36, textAlign: 'center', lineHeight: '32px' }}>
                {Math.round(scale * 100)}%
              </span>
              <button
                className="secondary"
                style={{ fontSize: 16, padding: '4px 10px', lineHeight: 1 }}
                onClick={() => setScale(s => Math.min(3, +(s + 0.2).toFixed(1)))}
                title="확대"
              >+</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh', WebkitOverflowScrolling: 'touch' }}>
            <img
              src={song.sheetImageUrl}
              alt="악보"
              className="sheet-image"
              style={{
                display: 'block',
                width: scale === 1 ? '100%' : `${scale * 100}%`,
                maxWidth: 'none',
                transformOrigin: 'top left',
              }}
            />
          </div>
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
