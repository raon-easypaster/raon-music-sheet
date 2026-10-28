import { useMemo, useState } from 'react'
import { THEMES, SEASONS } from '../utils/songMeta'

// 주제 관리: 이 작업 공간에서 쓰는 주제와 곡 수, 이름 바꾸기·지우기 (모든 곡에 한 번에 반영)
export default function ThemeManager({ songs, onRename, onClose }) {
  const [editing, setEditing] = useState(null)   // 이름을 바꾸는 중인 주제
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const counts = useMemo(() => {
    const map = new Map()
    for (const s of songs) for (const t of s.themes || []) map.set(t, (map.get(t) || 0) + 1)
    return [...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko'))
  }, [songs])

  const kind = (t) => (SEASONS.includes(t) ? '절기' : THEMES.includes(t) ? '추천' : '직접 넣음')

  async function run(from, to) {
    setBusy(true)
    setMsg('')
    try {
      const { updated } = await onRename(from, to)
      setMsg(to ? `'${from}' → '${to}' (${updated}곡 바꿈)` : `'${from}' 주제를 ${updated}곡에서 뺐습니다`)
      setEditing(null)
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  function saveName(from) {
    const to = name.trim().replace(/^#/, '')
    if (!to || to === from) return setEditing(null)
    const merge = counts.some(([t]) => t === to)
    if (merge && !window.confirm(`'${to}' 주제가 이미 있습니다. '${from}' 곡들을 '${to}'로 합칠까요?`)) return
    run(from, to)
  }

  function remove(from, count) {
    if (!window.confirm(`'${from}' 주제를 ${count}곡에서 모두 뺄까요? (곡은 지워지지 않습니다)`)) return
    run(from, '')
  }

  return (
    <div className="theme-manager">
      <div className="theme-manager-head">
        <b>주제 관리</b>
        <span className="muted">이름을 바꾸거나 지우면 이 공간의 모든 곡에 한 번에 반영됩니다.</span>
        <button type="button" className="secondary" onClick={onClose}>닫기</button>
      </div>
      {msg && <p className="ok-text">{msg}</p>}
      {counts.length === 0 ? (
        <p className="muted">아직 주제가 들어간 곡이 없습니다. 곡의 <b>수정</b>이나 태그를 눌러 주제를 넣어 보세요.</p>
      ) : (
        <ul>
          {counts.map(([t, count]) => (
            <li key={t}>
              {editing === t ? (
                <span className="theme-rename">
                  <input
                    type="text"
                    value={name}
                    maxLength={20}
                    autoFocus
                    onFocus={(e) => e.target.select()}
                    aria-label={`'${t}'의 새 이름`}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveName(t) } if (e.key === 'Escape') setEditing(null) }}
                  />
                  <button type="button" onClick={() => saveName(t)} disabled={busy}>저장</button>
                  <button type="button" className="secondary" onClick={() => setEditing(null)}>취소</button>
                </span>
              ) : (
                <>
                  <span className="theme-name">
                    <b>#{t}</b> <span className="muted">{count}곡 · {kind(t)}</span>
                  </span>
                  <span className="theme-actions">
                    <button type="button" className="secondary" disabled={busy} onClick={() => { setEditing(t); setName(t) }}>이름 바꾸기</button>
                    <button type="button" className="secondary" disabled={busy} onClick={() => remove(t, count)}>지우기</button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
