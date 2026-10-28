import { useState } from 'react'
import { TEMPOS, TIME_SIGNATURES, TARGETS, TRAITS, THEMES, SEASONS, tempoFromBpm } from '../utils/songMeta'

// 곡 분류 입력 (곡 추가·곡 수정 창이 함께 쓴다)
// value: 폼 전체 값(bpm 포함), onChange(patch)
// hideThemes: 주제·절기를 창 위쪽에 따로 보여 줄 때
export default function SongMetaFields({ value, onChange, hideThemes = false }) {
  const themes = value.themes || []
  const traits = value.traits || []
  const autoTempo = tempoFromBpm(value.bpm)

  const toggle = (field, list, item) =>
    onChange({ [field]: list.includes(item) ? list.filter((t) => t !== item) : [...list, item] })

  return (
    <div className="meta-fields">
      <div className="row-fields">
        <label className="meta-label">
          빠르기
          <select value={value.tempo || ''} onChange={(e) => onChange({ tempo: e.target.value })}>
            <option value="">{autoTempo ? `BPM으로 자동 (${autoTempo})` : '선택 안 함'}</option>
            {TEMPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="meta-label">
          박자
          <select value={value.timeSignature || ''} onChange={(e) => onChange({ timeSignature: e.target.value })}>
            <option value="">선택 안 함</option>
            {TIME_SIGNATURES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="meta-label">
          곡 길이(분)
          <input type="number" min="0" max="60" placeholder="4" value={value.durationMin || ''}
            onChange={(e) => onChange({ durationMin: e.target.value })} />
        </label>
      </div>

      <label className="meta-label">
        찬양의 대상
        <select value={value.target || ''} onChange={(e) => onChange({ target: e.target.value })}>
          <option value="">선택 안 함</option>
          {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>

      <div className="meta-label">곡 특성</div>
      <div className="tag-chips">
        {TRAITS.map((t) => (
          <button key={t} type="button" className={traits.includes(t) ? 'on' : ''} aria-pressed={traits.includes(t)}
            onClick={() => toggle('traits', traits, t)}>{t}</button>
        ))}
      </div>

      {!hideThemes && <ThemePicker value={themes} onChange={(list) => onChange({ themes: list })} />}

      <div className="row-fields">
        <input type="text" placeholder="찬송가 번호 (예: 새찬송가 305장)" maxLength={20}
          value={value.hymnNumber || ''} onChange={(e) => onChange({ hymnNumber: e.target.value })} />
        <input type="text" placeholder="성경구절 (예: 시편 23편)" maxLength={100}
          value={value.scripture || ''} onChange={(e) => onChange({ scripture: e.target.value })} />
      </div>
      <div className="row-fields">
        <input type="text" placeholder="작사" maxLength={60}
          value={value.lyricist || ''} onChange={(e) => onChange({ lyricist: e.target.value })} />
        <input type="text" placeholder="작곡" maxLength={60}
          value={value.composer || ''} onChange={(e) => onChange({ composer: e.target.value })} />
      </div>
    </div>
  )
}

// 주제·절기 태그 고르기 (추천 태그 + 우리가 넣은 주제 + 새 주제 직접 입력)
// suggestions: 다른 곡에 직접 넣어 둔 주제 (버튼으로 다시 고를 수 있게)
export function ThemePicker({ value = [], onChange, suggestions = [] }) {
  const [custom, setCustom] = useState('')
  const themes = value
  const toggle = (t) => onChange(themes.includes(t) ? themes.filter((x) => x !== t) : [...themes, t])

  function addCustom() {
    const tag = custom.trim().replace(/^#/, '').slice(0, 20)
    if (tag && !themes.includes(tag)) onChange([...themes, tag])
    setCustom('')
  }

  const ours = [...new Set([...suggestions, ...themes.filter((t) => !THEMES.includes(t) && !SEASONS.includes(t))])]

  return (
    <div className="theme-picker">
      <div className="meta-label">주제</div>
      <div className="tag-chips">
        {THEMES.map((t) => (
          <button key={t} type="button" className={themes.includes(t) ? 'on' : ''} aria-pressed={themes.includes(t)}
            onClick={() => toggle(t)}>{t}</button>
        ))}
      </div>
      <div className="meta-label">절기</div>
      <div className="tag-chips season">
        {SEASONS.map((t) => (
          <button key={t} type="button" className={themes.includes(t) ? 'on' : ''} aria-pressed={themes.includes(t)}
            onClick={() => toggle(t)}>{t}</button>
        ))}
      </div>
      {ours.length > 0 && (
        <>
          <div className="meta-label">우리가 넣은 주제</div>
          <div className="tag-chips">
            {ours.map((t) => (
              <button key={t} type="button" className={themes.includes(t) ? 'on' : ''} aria-pressed={themes.includes(t)}
                onClick={() => toggle(t)}>{t}</button>
            ))}
          </div>
        </>
      )}
      <div className="tag-chips new-theme">
        <input
          className="tag-input"
          type="text"
          placeholder="목록에 없는 주제 직접 입력"
          aria-label="새 주제"
          value={custom}
          maxLength={20}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
        />
        <button type="button" className="secondary" onClick={addCustom} disabled={!custom.trim()}>+ 주제 추가</button>
      </div>
    </div>
  )
}
