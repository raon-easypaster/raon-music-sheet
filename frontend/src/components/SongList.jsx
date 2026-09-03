import { useState } from 'react'
import SongViewer from './SongViewer'

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
               'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

const SORT_OPTIONS = [
  { value: 'default', label: '등록순' },
  { value: 'title',   label: '제목순' },
  { value: 'artist',  label: '아티스트순' },
  { value: 'key',     label: '코드순' },
  { value: 'bpm',     label: 'BPM순' },
]

const KEY_ORDER = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
                   'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

function sortSongs(songs, by) {
  if (by === 'default') return songs
  return [...songs].sort((a, b) => {
    if (by === 'title')  return (a.title  || '').localeCompare(b.title  || '', 'ko')
    if (by === 'artist') return (a.artist || '').localeCompare(b.artist || '', 'ko')
    if (by === 'key')    return KEY_ORDER.indexOf(a.key || '') - KEY_ORDER.indexOf(b.key || '')
    if (by === 'bpm')    return (a.bpm || 0) - (b.bpm || 0)
    return 0
  })
}

export default function SongList({ songs, onDelete, onUpdate }) {
  const [viewing,      setViewing]      = useState(null)
  const [editing,      setEditing]      = useState(null)
  const [editForm,     setEditForm]     = useState({})
  const [editExpanded, setEditExpanded] = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [editError,    setEditError]    = useState('')
  const [search,       setSearch]       = useState('')
  const [sortBy,       setSortBy]       = useState('default')

  function openEdit(song) {
    setEditing(song)
    setEditForm({
      title:         song.title         || '',
      artist:        song.artist        || '',
      key:           song.key           || '',
      bpm:           song.bpm           || '',
      capo:          song.capo          ?? 0,
      youtubeUrl:    song.youtubeUrl    || '',
      mrUrl:         song.mrUrl         || '',
      sheetImageUrl: song.sheetImageUrl || '',
      sheetPdfUrl:   song.sheetPdfUrl   || '',
      structure:     song.structure     || '',
      notes:         song.notes         || '',
    })
    setEditExpanded(false)
    setEditError('')
  }

  function closeEdit() { setEditing(null); setEditForm({}) }

  async function handleEditSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setEditError('')
    try {
      const payload = { ...editForm }
      if (payload.bpm) payload.bpm = Number(payload.bpm)
      payload.capo = Number(payload.capo) || 0
      await onUpdate(editing._id, payload)
      closeEdit()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  function set(field) {
    return e => setEditForm(f => ({ ...f, [field]: e.target.value }))
  }

  const filtered = songs.filter(s =>
    [s.title, s.artist, s.key].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  )
  const sorted = sortSongs(filtered, sortBy)

  return (
    <>
      <div className="card panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>
            전체 곡 목록
            <span className="muted" style={{ fontSize: 14, fontWeight: 400, marginLeft: 6 }}>
              ({search ? `${filtered.length}/` : ''}{songs.length}곡)
            </span>
          </h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="search"
              placeholder="제목·아티스트·코드 검색"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '7px 12px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, width: 190 }}
            />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13 }}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {sorted.length === 0 && (
          <p className="muted">
            {search ? `"${search}" 검색 결과가 없습니다` : '등록된 곡이 없습니다'}
          </p>
        )}

        {sorted.map((song) => (
          <div key={song._id} className="item-row">
            <div className="song-info">
              <strong>{song.title}</strong>
              <span className="muted">{song.artist}</span>
              <div className="badge-row">
                {song.key           && <span className="badge badge-key">{song.key}</span>}
                {song.capo > 0      && <span className="badge" style={{ background: '#fef9c3', color: '#854d0e' }}>카포 {song.capo}</span>}
                {song.bpm > 0       && <span className="badge badge-bpm">{song.bpm} BPM</span>}
                {song.youtubeUrl    && <span className="badge badge-link">YT</span>}
                {song.sheetImageUrl && <span className="badge badge-link">악보</span>}
                {song.sheetPdfUrl   && <span className="badge badge-link">PDF</span>}
              </div>
            </div>
            <div className="song-actions">
              <button className="secondary" onClick={() => setViewing(song)}>보기</button>
              <button className="secondary" onClick={() => openEdit(song)}>수정</button>
              <button onClick={() => onDelete(song._id)}>삭제</button>
            </div>
          </div>
        ))}

        <SongViewer song={viewing} onClose={() => setViewing(null)} />
      </div>

      {editing && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <h2 style={{ marginTop: 0 }}>곡 수정</h2>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                type="text" placeholder="곡 제목 *"
                value={editForm.title} onChange={set('title')} required
              />
              <input
                type="text" placeholder="아티스트 / 원곡자"
                value={editForm.artist} onChange={set('artist')}
              />
              <div className="row-fields">
                <select value={editForm.key} onChange={set('key')}>
                  <option value="">키 선택</option>
                  {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
                <input
                  type="number" placeholder="BPM"
                  value={editForm.bpm} onChange={set('bpm')} min="1" max="300"
                />
                <select value={editForm.capo} onChange={set('capo')}>
                  <option value={0}>카포 없음</option>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>카포 {n}프렛</option>)}
                </select>
              </div>

              <button type="button" className="secondary toggle-btn" onClick={() => setEditExpanded(v => !v)}>
                {editExpanded ? '▲ 링크·악보 접기' : '▼ 링크·악보 펼치기'}
              </button>

              {editExpanded && (
                <div className="expanded-fields">
                  <input type="url" placeholder="YouTube URL (예배곡 영상)" value={editForm.youtubeUrl} onChange={set('youtubeUrl')} />
                  <input type="url" placeholder="MR / 반주 URL" value={editForm.mrUrl} onChange={set('mrUrl')} />
                  <input type="url" placeholder="악보 이미지 URL" value={editForm.sheetImageUrl} onChange={set('sheetImageUrl')} />
                  <input type="url" placeholder="악보 PDF URL" value={editForm.sheetPdfUrl} onChange={set('sheetPdfUrl')} />
                  <input type="text" placeholder="송폼 구조 (예: Intro - Verse - Chorus - Bridge)" value={editForm.structure} onChange={set('structure')} />
                  <textarea placeholder="메모 (연주 포인트, 전조 등)" value={editForm.notes} onChange={set('notes')} rows={3} />
                </div>
              )}

              {editError && <p className="error-text">{editError}</p>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" className="secondary" onClick={closeEdit}>취소</button>
                <button type="submit" disabled={submitting}>{submitting ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
