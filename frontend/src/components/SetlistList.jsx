import { useMemo, useState } from 'react'
import { formatKoreanDate, isoToDateInput, monthLabel } from '../utils/dates'

// 예배 날짜가 있는 콘티는 월별로 묶어 최근 날짜부터, 날짜가 없는 콘티는 맨 아래에 모은다
function groupByMonth(setlists) {
  const dated = setlists
    .filter((s) => s.gigDate)
    .sort((a, b) => isoToDateInput(b.gigDate).localeCompare(isoToDateInput(a.gigDate)))
  const groups = []
  for (const s of dated) {
    const label = monthLabel(s.gigDate)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(s)
    else groups.push({ label, items: [s] })
  }
  const undated = setlists.filter((s) => !s.gigDate)
  if (undated.length) groups.push({ label: '날짜 없음', items: undated })
  return groups
}

export default function SetlistList({
  setlists,
  selectedSetlistId,
  onSelect,
  onDelete,
}) {
  const [typeFilter, setTypeFilter] = useState('')
  // 예배 종류별 콘티 수 (종류를 넣은 콘티가 있을 때만 보여 준다)
  const typeCounts = useMemo(() => {
    const counts = new Map()
    for (const s of setlists) if (s.serviceType) counts.set(s.serviceType, (counts.get(s.serviceType) || 0) + 1)
    return [...counts].sort((a, b) => a[0].localeCompare(b[0], 'ko'))
  }, [setlists])
  const activeType = typeCounts.some(([t]) => t === typeFilter) ? typeFilter : ''
  const shown = useMemo(() => (activeType ? setlists.filter((s) => s.serviceType === activeType) : setlists), [setlists, activeType])
  const groups = useMemo(() => groupByMonth(shown), [shown])

  return (
    <div className="card panel">
      <h2>콘티 목록</h2>

      {typeCounts.length > 0 && (
        <div className="key-chips" role="group" aria-label="예배 종류">
          <button type="button" className={activeType === '' ? 'active' : ''} aria-pressed={activeType === ''} onClick={() => setTypeFilter('')}>
            전체 <span className="chip-count">{setlists.length}</span>
          </button>
          {typeCounts.map(([type, count]) => (
            <button key={type} type="button" className={activeType === type ? 'active' : ''} aria-pressed={activeType === type}
              onClick={() => setTypeFilter(activeType === type ? '' : type)}>
              {type} <span className="chip-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      {setlists.length === 0 ? (
        <p className="muted">등록된 콘티가 없습니다</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="setlist-month">
            <h3 className="setlist-month-label">{group.label}</h3>
            <ul className="item-list">
              {group.items.map((setlist) => (
                <li key={setlist._id} className="item-row">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                    }}
                  >
                    <button
                      className={
                        selectedSetlistId === setlist._id
                          ? 'secondary active setlist-pick'
                          : 'secondary setlist-pick'
                      }
                      onClick={() => onSelect(setlist)}
                    >
                      {setlist.gigDate && <span className="setlist-date">{formatKoreanDate(setlist.gigDate)}</span>}
                      {setlist.serviceType && <span className="setlist-type">{setlist.serviceType}</span>}
                      {setlist.name}
                    </button>

                    <button
                      type="button"
                      className="secondary"
                      onClick={() => onDelete(setlist._id)}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
