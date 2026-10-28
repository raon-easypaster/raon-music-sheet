import { useState } from 'react'
import { TEMPOS, TIME_SIGNATURES, TARGETS, TRAITS, THEMES, SEASONS, tempoFromBpm } from '../utils/songMeta'

// 곡 분류 입력 (곡 추가·곡 수정 창이 함께 쓴다)
// value: 폼 전체 값(bpm 포함), onChange(patch)
export default function SongMetaFields({ value, onChange }) {
  const [custom, setCustom] = useState('')
  const themes = value.themes || []
  const traits = value.traits || []
  const autoTempo = tempoFromBpm(value.bpm)

  const toggle = (field, list, item) =>
    onChange({ [field]: list.includes(item) ? list.filter((t) => t !== item) : [...list, item] })

  function addCustom() {
    const tag = custom.trim().replace(/^#/, '').slice(0, 20)
    if (tag && !themes.includes(tag)) onChange({ themes: [...themes, tag] })
    setCustom('')
  }

  const extraTags = themes.filter((t) => !THEMES.includes(t) && !SEASONS.includes(t))

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

      <div className="meta-label">주제</div>
      <div className="tag-chips">
        {THEMES.map((t) => (
          <button key={t} type="button" className={themes.includes(t) ? 'on' : ''} aria-pressed={themes.includes(t)}
            onClick={() => toggle('themes', themes, t)}>{t}</button>
        ))}
      </div>
      <div className="meta-label">절기</div>
      <div className="tag-chips season">
        {SEASONS.map((t) => (
          <button key={t} type="button" className={themes.includes(t) ? 'on' : ''} aria-pressed={themes.includes(t)}
            onClick={() => toggle('themes', themes, t)}>{t}</button>
        ))}
      </div>
      <div className="tag-chips">
        {extraTags.map((t) => (
          <button key={t} type="button" className="on" title="눌러서 빼기" onClick={() => toggle('themes', themes, t)}>#{t} ✕</button>
        ))}
        <input
          className="tag-input"
          type="text"
          placeholder="태그 직접 입력 후 Enter"
          value={custom}
          maxLength={20}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          onBlur={addCustom}
        />
      </div>

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
