import { useEffect, useMemo, useState, useRef } from 'react'
import { getPublicCurrentSong, setPublicCurrentSong } from '../api/setlists'

function getYoutubeId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch { return null }
}

export default function SetlistDetail({
  setlist,
  songs,
  onAddSongs,
  onRemoveSong,
  onReorder,
  onShare,
}) {
  const [selectedSongIds, setSelectedSongIds] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [shareLink,     setShareLink]     = useState(null)
  const [shareToken,    setShareToken]    = useState(null)
  const [conductorIdx,  setConductorIdx]  = useState(0)
  const [copied,        setCopied]        = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)
  const [showPlayer,    setShowPlayer]    = useState(false)
  const [playerIdx,     setPlayerIdx]     = useState(0)
  const [practiced,     setPracticed]     = useState({})

  // drag state
  const dragIndex = useRef(null)
  const [localSongs, setLocalSongs] = useState([])

  // 콘티가 바뀌면 공유 상태 초기화
  useEffect(() => {
    setSelectedSongIds([])
    setError('')
    setShareLink(null)
    setShareToken(null)
    setConductorIdx(0)
    setShowPlayer(false)
    setPlayerIdx(0)
    if (setlist?.songs) {
      setLocalSongs(setlist.songs.filter(s => typeof s !== 'string'))
    } else {
      setLocalSongs([])
    }
    // 연습완료 localStorage 복원
    if (setlist?._id) {
      try {
        const saved = localStorage.getItem(`practiced_${setlist._id}`)
        setPracticed(saved ? JSON.parse(saved) : {})
      } catch { setPracticed({}) }
    }
  }, [setlist?._id, setlist?.songs])

  function togglePracticed(songId) {
    if (!setlist?._id) return
    setPracticed(prev => {
      const next = { ...prev, [songId]: !prev[songId] }
      try { localStorage.setItem(`practiced_${setlist._id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const existingSongIds = useMemo(() => {
    if (!setlist?.songs) return []
    return setlist.songs.map((song) => (typeof song === 'string' ? song : song._id))
  }, [setlist])

  const availableSongs = useMemo(() => {
    return songs.filter((song) => !existingSongIds.includes(song._id))
  }, [songs, existingSongIds])

  function toggleSong(songId) {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    )
  }

  async function handleAddSongs() {
    if (!setlist || selectedSongIds.length === 0) return
    setError('')
    setSubmitting(true)
    try {
      await onAddSongs(setlist._id, selectedSongIds)
      setSelectedSongIds([])
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveSong(songId) {
    if (!setlist) return
    setError('')
    setSubmitting(true)
    try {
      await onRemoveSong(setlist._id, songId)
    } catch (err) {
      setError(err.message || 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  // Drag-and-drop handlers
  function handleDragStart(idx) {
    dragIndex.current = idx
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    if (dragIndex.current === null || dragIndex.current === idx) return
    const updated = [...localSongs]
    const [moved] = updated.splice(dragIndex.current, 1)
    updated.splice(idx, 0, moved)
    dragIndex.current = idx
    setLocalSongs(updated)
  }

  async function handleDrop() {
    if (!setlist || !onReorder) return
    dragIndex.current = null
    try {
      await onReorder(setlist._id, localSongs.map(s => s._id))
    } catch (err) {
      setError(err.message || 'Reorder failed')
    }
  }

  async function handleShare() {
    if (!onShare) return
    try {
      const { shareToken: token } = await onShare(setlist._id)
      const link = `${window.location.origin}/share/${token}`
      setShareLink(link)
      setShareToken(token)
    } catch (err) {
      setError(err.message || '링크 생성 실패')
    }
  }

  // 공유 중일 때 현재 진행 인덱스 폴링 (3초)
  useEffect(() => {
    if (!shareToken) return
    const poll = async () => {
      try {
        const { index } = await getPublicCurrentSong(shareToken)
        setConductorIdx(index)
      } catch {}
    }
    poll()
    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [shareToken])

  async function conductGo(idx) {
    if (!shareToken || idx < 0 || idx >= localSongs.length) return
    setConductorIdx(idx)
    try { await setPublicCurrentSong(shareToken, idx) } catch {}
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function copySummary() {
    if (!setlist) return
    const lines = [`📋 ${setlist.name}`, '']
    localSongs.forEach((s, i) => {
      let line = `${i + 1}. ${s.title}`
      if (s.artist) line += ` (${s.artist})`
      if (s.key) line += ` | Key ${s.key}`
      if (s.bpm > 0) line += ` | BPM ${s.bpm}`
      if (s.structure) line += `\n   ${s.structure}`
      lines.push(line)
    })
    if (shareLink) { lines.push(''); lines.push(`🔗 ${shareLink}`) }
    navigator.clipboard.writeText(lines.join('\n'))
    setSummaryCopied(true)
    setTimeout(() => setSummaryCopied(false), 2000)
  }

  if (!setlist) {
    return (
      <div className="card panel">
        <h2>콘티 상세</h2>
        <p className="muted">콘티를 선택하세요</p>
      </div>
    )
  }

  return (
    <div className="card panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>{setlist.name}</h2>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {localSongs.some(s => s.youtubeUrl) && (
            <button
              type="button"
              style={{ fontSize: 13, background: showPlayer ? '#0f172a' : '#1e293b', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { setShowPlayer(v => !v); setPlayerIdx(0) }}
            >
              {showPlayer ? '■ 재생 닫기' : '▶ 연속재생'}
            </button>
          )}
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={copySummary}>
            {summaryCopied ? '복사됨!' : '💬 카톡 요약'}
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={handleShare}>
            🔗 공유 링크
          </button>
        </div>
      </div>

      {/* 연속재생 패널 */}
      {showPlayer && localSongs.length > 0 && (() => {
        const ps = localSongs[playerIdx]
        const vid = getYoutubeId(ps?.youtubeUrl)
        return (
          <div style={{ background: '#0f172a', borderRadius: 14, padding: 14, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{playerIdx + 1}/{localSongs.length}</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{ps?.title}</span>
              {ps?.key && <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', color: '#86efac', padding: '2px 6px', borderRadius: 6 }}>Key {ps.key}{ps.capo > 0 ? ` · 카포 ${ps.capo}` : ''}</span>}
              {ps?.bpm > 0 && <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', color: '#fbbf24', padding: '2px 6px', borderRadius: 6 }}>{ps.bpm} BPM</span>}
            </div>
            {vid ? (
              <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 8, overflow: 'hidden' }}>
                <iframe
                  key={vid}
                  src={`https://www.youtube.com/embed/${vid}?autoplay=1`}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#64748b', padding: '20px 0', fontSize: 13 }}>
                이 곡에는 YouTube 링크가 없습니다
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'center' }}>
              <button
                onClick={() => setPlayerIdx(i => Math.max(0, i - 1))}
                disabled={playerIdx === 0}
                style={{ background: 'rgba(255,255,255,0.1)', color: playerIdx === 0 ? '#475569' : '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}
              >‹ 이전</button>
              <button
                onClick={() => setPlayerIdx(i => Math.min(localSongs.length - 1, i + 1))}
                disabled={playerIdx === localSongs.length - 1}
                style={{ background: 'rgba(255,255,255,0.2)', color: playerIdx === localSongs.length - 1 ? '#475569' : '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer' }}
              >다음 ›</button>
            </div>
          </div>
        )
      })()}

      {shareLink && (
        <>
          {/* 링크 표시줄 */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, flex: 1, wordBreak: 'break-all', color: '#166534' }}>{shareLink}</span>
            <button type="button" className="secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={copyLink}>
              {copied ? '복사됨!' : '복사'}
            </button>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 10px', background: '#64748b', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => window.open(shareLink, '_blank')}
            >
              🔗 미리보기
            </button>
            <button
              type="button"
              style={{ fontSize: 12, padding: '4px 10px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => { navigator.clipboard.writeText(`${shareLink}?view=sheet`) }}
              title="악보 슬라이드 모드로 바로 열리는 링크 복사"
            >
              📄 악보링크
            </button>
          </div>

          {/* 진행 컨트롤러 */}
          {localSongs.length > 0 && (
            <div style={{ background: '#14532d', borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={() => conductGo(conductorIdx - 1)}
                disabled={conductorIdx === 0}
                style={{ width: 44, height: 44, border: 'none', borderRadius: 8, background: conductorIdx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 22, cursor: conductorIdx === 0 ? 'default' : 'pointer', flexShrink: 0 }}
              >‹</button>

              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginBottom: 2 }}>
                  🔴 실시간 진행 중 · {conductorIdx + 1} / {localSongs.length}곡
                </div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {localSongs[conductorIdx]?.title || '—'}
                </div>
                {localSongs[conductorIdx]?.key && (
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>
                    Key {localSongs[conductorIdx].key}
                    {localSongs[conductorIdx].bpm > 0 && ` · ${localSongs[conductorIdx].bpm} BPM`}
                  </div>
                )}
              </div>

              <button
                onClick={() => conductGo(conductorIdx + 1)}
                disabled={conductorIdx === localSongs.length - 1}
                style={{ width: 44, height: 44, border: 'none', borderRadius: 8, background: conductorIdx === localSongs.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)', color: '#fff', fontSize: 22, cursor: conductorIdx === localSongs.length - 1 ? 'default' : 'pointer', flexShrink: 0 }}
              >›</button>
            </div>
          )}
        </>
      )}

      <div className="section-block">
        <h3>콘티 순서 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(드래그로 순서 변경)</span></h3>

        {/* 연습 진행도 */}
        {localSongs.length > 0 && (
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
            연습 완료 {localSongs.filter(s => practiced[s._id]).length} / {localSongs.length}곡
            {localSongs.filter(s => practiced[s._id]).length === localSongs.length && localSongs.length > 0 && (
              <span style={{ marginLeft: 6, color: '#15803d', fontWeight: 700 }}>🎉 전곡 완료!</span>
            )}
          </div>
        )}

        {localSongs.length ? (
          <ul className="item-list">
            {localSongs.map((song, idx) => (
              <li
                key={song._id}
                className="item-row"
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={handleDrop}
                style={{ cursor: 'grab', userSelect: 'none', opacity: practiced[song._id] ? 0.6 : 1 }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {/* 연습완료 체크박스 */}
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePracticed(song._id) }}
                    style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: 6,
                      border: `2px solid ${practiced[song._id] ? '#15803d' : '#cbd5e1'}`,
                      background: practiced[song._id] ? '#15803d' : 'transparent',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, color: '#fff', lineHeight: 1,
                    }}
                    title="연습 완료 표시"
                  >
                    {practiced[song._id] ? '✓' : ''}
                  </button>

                  {/* 드래그 핸들 */}
                  <span style={{ color: '#cbd5e1', fontSize: 16, flexShrink: 0 }}>⠿</span>

                  {/* 악보 썸네일 */}
                  {song.sheetImageUrl && (
                    <img
                      src={song.sheetImageUrl}
                      alt=""
                      style={{ width: 36, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #e2e8f0', flexShrink: 0 }}
                    />
                  )}

                  {/* 곡 정보 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <span className="song-order">{idx + 1}.</span>
                      <strong>{song.title}</strong>
                      {song.artist && <span className="muted"> — {song.artist}</span>}
                    </div>
                    <div className="badge-row">
                      {song.key && <span className="badge badge-key">{song.key}</span>}
                      {song.capo > 0 && <span className="badge" style={{ background: '#fef9c3', color: '#854d0e' }}>카포 {song.capo}</span>}
                      {song.bpm > 0 && <span className="badge badge-bpm">{song.bpm} BPM</span>}
                    </div>
                    {song.structure && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {song.structure}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleRemoveSong(song._id)}
                    disabled={submitting}
                    style={{ cursor: 'pointer', flexShrink: 0, fontSize: 12 }}
                  >
                    제거
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">콘티에 곡이 없습니다</p>
        )}
      </div>

      <div className="section-block">
        <h3>곡 추가</h3>

        {availableSongs.length === 0 ? (
          <p className="muted">추가할 수 있는 곡이 없습니다</p>
        ) : (
          <>
            <div className="checkbox-list">
              {availableSongs.map((song) => (
                <label key={song._id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedSongIds.includes(song._id)}
                    onChange={() => toggleSong(song._id)}
                  />
                  <span>
                    {song.title}
                    {song.artist && ` — ${song.artist}`}
                    {song.key && <span className="badge badge-key" style={{ marginLeft: 6 }}>{song.key}</span>}
                  </span>
                </label>
              ))}
            </div>

            <button
              onClick={handleAddSongs}
              disabled={submitting || selectedSongIds.length === 0}
            >
              {submitting ? '처리 중...' : '선택한 곡 추가'}
            </button>
          </>
        )}

        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </div>
  )
}
