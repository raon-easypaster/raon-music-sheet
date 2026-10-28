import { TEMPOS, TIME_SIGNATURES, TARGETS, TRAITS, THEMES, SEASONS, USAGE_FILTERS, EMPTY_FILTERS, NO_THEME, activeFilterCount } from '../utils/songMeta'

// 상세 검색 (빠르기·박자·주제·절기·대상·특성·부른 기록). 곡 목록과 곡 선택 창이 함께 쓴다
export default function SongFilterBar({ filters, onChange, open, onToggle, songs = [] }) {
  const count = activeFilterCount(filters)
  // 추천 태그 외에 곡에 실제로 붙어 있는 태그도 고를 수 있게
  const usedTags = [...new Set(songs.flatMap((s) => s.themes || []))]
  const otherTags = usedTags.filter((t) => !THEMES.includes(t) && !SEASONS.includes(t)).sort((a, b) => a.localeCompare(b, 'ko'))
  const set = (field) => (e) => onChange({ ...filters, [field]: e.target.value })

  return (
    <div className="filter-bar">
      <button type="button" className={count ? 'filter-toggle on' : 'filter-toggle'} aria-expanded={open} onClick={onToggle}>
        상세 검색{count ? ` (${count})` : ''} {open ? '▲' : '▼'}
      </button>
      {count > 0 && (
        <button type="button" className="filter-clear" onClick={() => onChange(EMPTY_FILTERS)}>조건 지우기</button>
      )}
      {open && (
        <div className="filter-grid">
          <select value={filters.tempo} onChange={set('tempo')} aria-label="빠르기">
            <option value="">빠르기 전체</option>
            {TEMPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.timeSignature} onChange={set('timeSignature')} aria-label="박자">
            <option value="">박자 전체</option>
            {TIME_SIGNATURES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.tag} onChange={set('tag')} aria-label="주제·절기">
            <option value="">주제·절기 전체</option>
            <option value={NO_THEME}>주제 없는 곡</option>
            <optgroup label="주제">{THEMES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
            <optgroup label="절기">{SEASONS.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
            {otherTags.length > 0 && <optgroup label="직접 넣은 태그">{otherTags.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>}
          </select>
          <select value={filters.target} onChange={set('target')} aria-label="찬양의 대상">
            <option value="">대상 전체</option>
            {TARGETS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.trait} onChange={set('trait')} aria-label="곡 특성">
            <option value="">특성 전체</option>
            {TRAITS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filters.usage} onChange={set('usage')} aria-label="부른 기록">
            <option value="">부른 기록 전체</option>
            {USAGE_FILTERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}
