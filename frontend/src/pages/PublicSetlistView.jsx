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
  const [sheetOnly,  setSheetOnly]  = useState(false)
  const touchStartX = useRef(null)

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
    if (idx < 0 || idx >= (setlist?.songs?.length ?? 0)) return
    setCurrentIdx(idx)
    try { await setPublicCurrentSong(token, idx) } catch {}
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 50) {
      if (delta < 0) handleSelectSong(currentIdx + 1)
      else handleSelectSong(currentIdx - 1)
    }
    touchStartX.current = null
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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setSheetOnly(v => !v)}
            style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600,
              background: sheetOnly ? '#15803d' : '#e2e8f0',
              color: sheetOnly ? '#fff' : '#374151',
            }}
          >
            {sheetOnly ? '📋 전체 보기' : '📄 악보만'}
          </button>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>🔴 실시간 동기화 중</span>
        </div>
      </header>

      {/* 악보만 슬라이드 모드 */}
      {sheetOnly && (
        <div
          style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#111', position: 'relative', overflow: 'hidden' }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* 상단 곡 정보 */}
          <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', zIndex: 10, pointerEvents: 'none' }}>
            <span style={{ background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '5px 14px', borderRadius: 20, fontSize: 13, backdropFilter: 'blur(4px)' }}>
              {currentIdx + 1}/{songs.length} · {song?.title}
              {song?.key && <span style={{ marginLeft: 8, opacity: 0.7 }}>Key {song.key}{song?.capo > 0 ? ` · 카포${song.capo}` : ''}</span>}
            </span>
          </div>

          {/* 악보 이미지 */}
          {song?.sheetImageUrl ? (
            <img
              src={song.sheetImageUrl}
              alt="악보"
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none' }}
              draggable={false}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', gap: 8 }}>
              <div style={{ fontSize: 40 }}>🎵</div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{song?.title}</div>
              <div style={{ fontSize: 13 }}>악보 이미지 없음</div>
            </div>
          )}

          {/* 이전/다음 터치 영역 */}
          <button
            onClick={() => handleSelectSong(currentIdx - 1)}
            disabled={currentIdx === 0}
            style={{
              position: 'absolute', left: 0, top: 0, width: 64, height: '100%',
              background: 'transparent', border: 'none', cursor: currentIdx === 0 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, color: currentIdx === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)',
            }}
          >‹</button>
          <button
            onClick={() => handleSelectSong(currentIdx + 1)}
            disabled={currentIdx === songs.length - 1}
            style={{
              position: 'absolute', right: 0, top: 0, width: 64, height: '100%',
              background: 'transparent', border: 'none', cursor: currentIdx === songs.length - 1 ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, color: currentIdx === songs.length - 1 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)',
            }}
          >›</button>

          {/* 하단 곡 인디케이터 점 */}
          {songs.length <= 12 && (
            <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {songs.map((_, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSong(i)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
                    background: i === currentIdx ? '#fff' : 'rgba(255,255,255,0.3)',
                    transition: 'background 0.2s',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 데스크톱: 2컬럼 / 모바일: 스택 */}
      {!sheetOnly && <div className="share-layout" style={{ flex: 1, minHeight: 0 }}>
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
                    {s.capo > 0 && <span className="badge" style={{ fontSize: 10, marginLeft: 3, background: '#fef9c3', color: '#854d0e' }}>카포{s.capo}</span>}
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
            ? <SongContent
                song={song}
                currentIdx={currentIdx}
                totalSongs={songs.length}
                onPrev={() => handleSelectSong(currentIdx - 1)}
                onNext={() => handleSelectSong(currentIdx + 1)}
              />
            : <div className="card panel"><p className="muted">곡이 없습니다</p></div>
          }
        </main>
      </div>}

      {/* 모바일 하단 슬라이더 (전체 보기 모드에서만) */}
      {!sheetOnly && (
        <MobileSongSlider
          songs={songs}
          currentIdx={currentIdx}
          onSelect={handleSelectSong}
        />
      )}

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

/* ── 악보 콘텐츠 (줌 컨트롤 + 곡 내비게이션 포함) ──────────────────────────── */
function SongContent({ song, currentIdx = 0, totalSongs = 1, onPrev, onNext }) {
  const [scale, setScale]     = useState(1)
  const [fitted, setFitted]   = useState(true)   // true = 세로 맞춤(전체 보기), false = 가로 스케일
  const touchStartX = useRef(null)
  const youtubeId = getYoutubeEmbedId(song.youtubeUrl)

  // 곡이 바뀌면 맞춤 모드로 초기화
  useEffect(() => { setFitted(true); setScale(1) }, [song._id])

  function handleFit()  { setFitted(true);  setScale(1) }
  function handleMinus(){ setFitted(false); setScale(s => Math.max(0.4, +(s - 0.2).toFixed(1))) }
  function handlePlus() { setFitted(false); setScale(s => Math.min(3,   +(s + 0.2).toFixed(1))) }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(delta) > 50) {
      if (delta < 0 && onNext) onNext()
      else if (delta > 0 && onPrev) onPrev()
    }
    touchStartX.current = null
  }

  return (
    <div className="card panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0 }}>{song.title}</h2>
          {song.artist && <p className="muted" style={{ margin: '4px 0 0' }}>{song.artist}</p>}
        </div>
        <div className="badge-row">
          {song.key    && <span className="badge badge-key">🎵 {song.key}</span>}
          {song.capo > 0 && <span className="badge" style={{ background: '#fef9c3', color: '#854d0e' }}>카포 {song.capo}프렛</span>}
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
            <div style={{ display: 'flex', gap: 5, marginLeft: 'auto', alignItems: 'center' }}>
              <button
                className="secondary"
                style={{ fontSize: 12, padding: '4px 10px', fontWeight: fitted ? 700 : 400, background: fitted ? '#15803d' : undefined, color: fitted ? '#fff' : undefined, border: 'none', borderRadius: 8, cursor: 'pointer' }}
                onClick={handleFit}
                title="악보 전체를 세로로 맞춤"
              >맞춤</button>
              <button
                className="secondary"
                style={{ fontSize: 16, padding: '4px 10px', lineHeight: 1 }}
                onClick={handleMinus}
                title="축소"
              >−</button>
              <span style={{ fontSize: 12, color: '#64748b', minWidth: 36, textAlign: 'center', lineHeight: '32px' }}>
                {fitted ? '맞춤' : `${Math.round(scale * 100)}%`}
              </span>
              <button
                className="secondary"
                style={{ fontSize: 16, padding: '4px 10px', lineHeight: 1 }}
                onClick={handlePlus}
                title="확대"
              >+</button>
            </div>
          </div>

          {fitted ? (
            /* 세로 맞춤: 컨테이너 높이에 이미지 전체가 들어오도록 */
            <div
              style={{ position: 'relative', height: 'calc(100dvh - 260px)', minHeight: 200, overflow: 'auto', WebkitOverflowScrolling: 'touch', display: 'flex', justifyContent: 'center' }}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              <img
                src={song.sheetImageUrl}
                alt="악보"
                style={{ height: '100%', width: 'auto', maxWidth: 'none', display: 'block', objectFit: 'contain' }}
                draggable={false}
              />
              {/* 이전 곡 오버레이 */}
              {onPrev && currentIdx > 0 && (
                <button
                  onClick={onPrev}
                  style={{
                    position: 'absolute', left: 0, top: 0, height: '100%', width: 52,
                    background: 'linear-gradient(to right, rgba(0,0,0,0.18), transparent)',
                    border: 'none', cursor: 'pointer', fontSize: 30,
                    color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  title="이전 곡"
                >‹</button>
              )}
              {/* 다음 곡 오버레이 */}
              {onNext && currentIdx < totalSongs - 1 && (
                <button
                  onClick={onNext}
                  style={{
                    position: 'absolute', right: 0, top: 0, height: '100%', width: 52,
                    background: 'linear-gradient(to left, rgba(0,0,0,0.18), transparent)',
                    border: 'none', cursor: 'pointer', fontSize: 30,
                    color: 'rgba(255,255,255,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                  title="다음 곡"
                >›</button>
              )}
              {/* 곡 위치 표시 */}
              {totalSongs > 1 && (
                <div style={{
                  position: 'absolute', bottom: 8, right: 8,
                  background: 'rgba(0,0,0,0.45)', color: '#fff',
                  fontSize: 11, padding: '3px 8px', borderRadius: 10,
                  pointerEvents: 'none',
                }}>
                  {currentIdx + 1} / {totalSongs}
                </div>
              )}
            </div>
          ) : (
            /* 가로 스케일 모드 */
            <div style={{ overflowX: 'auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <img
                src={song.sheetImageUrl}
                alt="악보"
                className="sheet-image"
                style={{ display: 'block', width: `${scale * 100}%`, maxWidth: 'none' }}
              />
            </div>
          )}
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
