import { useMemo } from 'react'
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
  const groups = useMemo(() => groupByMonth(setlists), [setlists])

  return (
    <div className="card panel">
      <h2>콘티 목록</h2>

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
