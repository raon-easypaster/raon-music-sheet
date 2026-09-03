import { useState } from 'react'

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
               'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

const EMPTY = { title: '', artist: '', key: '', bpm: '', capo: 0, youtubeUrl: '', mrUrl: '', sheetImageUrl: '', sheetPdfUrl: '', structure: '', notes: '' }

export default function SongForm({ onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const payload = { ...form }
      if (payload.bpm) payload.bpm = Number(payload.bpm)
      payload.capo = Number(payload.capo) || 0
      await onCreate(payload)
      setForm(EMPTY)
      setExpanded(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="card form-card" onSubmit={handleSubmit}>
      <h2>곡 추가</h2>

      <div style={{ display: 'flex', gap: 8 }}>
        <input
          style={{ flex: 1, marginBottom: 0 }}
          type="text"
          name="title"
          placeholder="곡 제목 *"
          value={form.title}
          onChange={handleChange}
          required
        />
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent((form.title.trim() || '찬양') + ' 악보')}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0, fontSize: 13, padding: '0 14px',
            background: '#e2e8f0', borderRadius: 10, fontWeight: 600,
            display: 'flex', alignItems: 'center',
            textDecoration: 'none', color: '#1e293b',
          }}
        >
          🔍 구글
        </a>
      </div>

      <input
        type="text"
        name="artist"
        placeholder="아티스트 / 원곡자"
        value={form.artist}
        onChange={handleChange}
      />

      <div className="row-fields">
        <select name="key" value={form.key} onChange={handleChange}>
          <option value="">키 선택</option>
          {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>

        <input
          type="number"
          name="bpm"
          placeholder="BPM"
          value={form.bpm}
          onChange={handleChange}
          min="1"
          max="300"
        />

        <select name="capo" value={form.capo} onChange={handleChange}>
          <option value={0}>카포 없음</option>
          {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>카포 {n}프렛</option>)}
        </select>
      </div>

      <button type="button" className="secondary toggle-btn" onClick={() => setExpanded((v) => !v)}>
        {expanded ? '▲ 링크·악보 접기' : '▼ 링크·악보 펼치기'}
      </button>

      {expanded && (
        <div className="expanded-fields">
          <input
            type="url"
            name="youtubeUrl"
            placeholder="YouTube URL (예배곡 영상)"
            value={form.youtubeUrl}
            onChange={handleChange}
          />
          <input
            type="url"
            name="mrUrl"
            placeholder="MR / 반주 URL"
            value={form.mrUrl}
            onChange={handleChange}
          />
          <input
            type="url"
            name="sheetImageUrl"
            placeholder="악보 이미지 URL"
            value={form.sheetImageUrl}
            onChange={handleChange}
          />
          <input
            type="url"
            name="sheetPdfUrl"
            placeholder="악보 PDF URL"
            value={form.sheetPdfUrl}
            onChange={handleChange}
          />
          <input
            type="text"
            name="structure"
            placeholder="송폼 구조 (예: Intro - Verse - Chorus - Bridge)"
            value={form.structure}
            onChange={handleChange}
          />
          <textarea
            name="notes"
            placeholder="메모 (연주 포인트, 전조 등)"
            value={form.notes}
            onChange={handleChange}
            rows={3}
          />
        </div>
      )}

      <button type="submit" disabled={submitting}>
        {submitting ? '저장 중...' : '곡 저장'}
      </button>

      {error ? <p className="error-text">{error}</p> : null}
    </form>
  )
}
