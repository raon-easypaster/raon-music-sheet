import { useEffect, useMemo, useState, useRef } from 'react'

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
  const [shareLink, setShareLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [summaryCopied, setSummaryCopied] = useState(false)

  // drag state
  const dragIndex = useRef(null)
  const [localSongs, setLocalSongs] = useState([])

  useEffect(() => {
    setSelectedSongIds([])
    setError('')
    setShareLink(null)
    if (setlist?.songs) {
      setLocalSongs(setlist.songs.filter(s => typeof s !== 'string'))
    } else {
      setLocalSongs([])
    }
  }, [setlist?._id, setlist?.songs])

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
      const { shareToken } = await onShare(setlist._id)
      const link = `${window.location.origin}/share/${shareToken}`
      setShareLink(link)
    } catch (err) {
      setError(err.message || '링크 생성 실패')
    }
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
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={copySummary}>
            {summaryCopied ? '복사됨!' : '💬 카톡 요약'}
          </button>
          <button type="button" className="secondary" style={{ fontSize: 13 }} onClick={handleShare}>
            🔗 공유 링크
          </button>
        </div>
      </div>

      {shareLink && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, flex: 1, wordBreak: 'break-all', color: '#166534' }}>{shareLink}</span>
          <button type="button" className="secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={copyLink}>
            {copied ? '복사됨!' : '복사'}
          </button>
        </div>
      )}

      <div className="section-block">
        <h3>콘티 순서 <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>(드래그로 순서 변경)</span></h3>

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
                style={{ cursor: 'grab', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: '#cbd5e1', fontSize: 16 }}>⠿</span>
                    <div>
                      <span className="song-order">{idx + 1}.</span>
                      <strong>{song.title}</strong>
                      {song.artist && <span className="muted"> — {song.artist}</span>}
                      <div className="badge-row">
                        {song.key && <span className="badge badge-key">{song.key}</span>}
                        {song.bpm > 0 && <span className="badge badge-bpm">{song.bpm} BPM</span>}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => handleRemoveSong(song._id)}
                    disabled={submitting}
                    style={{ cursor: 'pointer' }}
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
