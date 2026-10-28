import { useState } from 'react'
import SheetEditor from './SheetEditor'
import SongMetaFields, { ThemePicker } from './SongMetaFields'
import { EMPTY_META, customThemes } from '../utils/songMeta'

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
               'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm']

const EMPTY = { title: '', artist: '', key: '', bpm: '', capo: 0, youtubeUrl: '', mrUrl: '', sheets: [], structure: '', notes: '', ...EMPTY_META }

export default function SongForm({ onCreate, songs = [] }) {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [metaOpen, setMetaOpen] = useState(false)

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
      payload.durationMin = Number(payload.durationMin) || 0
      await onCreate(payload)
      setForm(EMPTY)
      setExpanded(false)
      setMetaOpen(false)
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

      <div className="theme-box">
        <ThemePicker value={form.themes} suggestions={customThemes(songs)} onChange={(themes) => setForm((prev) => ({ ...prev, themes }))} />
      </div>

      <button type="button" className="secondary toggle-btn" onClick={() => setMetaOpen((v) => !v)}>
        {metaOpen ? '▲ 그 밖의 분류 접기' : '▼ 그 밖의 분류 (빠르기·박자·대상·특성 등)'}
      </button>
      {metaOpen && <SongMetaFields hideThemes value={form} onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))} />}

      <button type="button" className="secondary toggle-btn" onClick={() => setExpanded((v) => !v)}>
        {expanded ? '▲ 링크·악보 접기' : `▼ 링크·악보 펼치기${form.sheets.length ? ` (악보 ${form.sheets.length}개)` : ''}`}
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
          <SheetEditor value={form.sheets} title={form.title} onChange={(sheets) => setForm((prev) => ({ ...prev, sheets }))} />
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
