function getYoutubeEmbedId(url) {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1)
    return u.searchParams.get('v')
  } catch {
    return null
  }
}

export default function SongViewer({ song, onClose }) {
  if (!song) return null

  const youtubeId = getYoutubeEmbedId(song.youtubeUrl)

  return (
    <div className="viewer-overlay" onClick={onClose}>
      <div className="viewer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="viewer-header">
          <div>
            <h2>{song.title}</h2>
            <p className="muted">{song.artist}</p>
          </div>
          <div className="viewer-badges">
            {song.key && <span className="badge badge-key">🎵 {song.key}</span>}
            {song.bpm > 0 && <span className="badge badge-bpm">♩ {song.bpm} BPM</span>}
          </div>
          <button className="secondary" onClick={onClose}>닫기</button>
        </div>

        {song.notes && (
          <div className="viewer-notes">
            <strong>메모</strong>
            <p>{song.notes}</p>
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
            <a href={song.mrUrl} target="_blank" rel="noopener noreferrer" className="link-btn">
              🎧 MR 열기
            </a>
          </div>
        )}

        {song.sheetImageUrl && (
          <div className="viewer-section">
            <h3>악보 (이미지)</h3>
            <img src={song.sheetImageUrl} alt="악보" className="sheet-image" />
          </div>
        )}

        {song.sheetPdfUrl && (
          <div className="viewer-section">
            <h3>악보 (PDF)</h3>
            <a href={song.sheetPdfUrl} target="_blank" rel="noopener noreferrer" className="link-btn">
              📄 PDF 열기
            </a>
          </div>
        )}

        {!youtubeId && !song.mrUrl && !song.sheetImageUrl && !song.sheetPdfUrl && (
          <p className="muted" style={{ textAlign: 'center', marginTop: '1rem' }}>
            등록된 악보·링크가 없습니다
          </p>
        )}
      </div>
    </div>
  )
}
