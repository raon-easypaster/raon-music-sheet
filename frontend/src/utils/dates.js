// 콘티 날짜 계산·표시 (날짜는 'YYYY-MM-DD' 문자열로 주고받는다)

const pad = (n) => String(n).padStart(2, '0')
export const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// 기준일 이후(기준일 포함)의 가장 가까운 주일
export function nextSunday(from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return toDateInput(d)
}

// 서버의 ISO 날짜 → 'YYYY-MM-DD' (시간대 때문에 하루 밀리지 않게 UTC 기준으로 자른다)
export const isoToDateInput = (iso) => (iso ? String(iso).slice(0, 10) : '')

export function formatKoreanDate(iso, withWeekday = true) {
  if (!iso) return ''
  const [y, m, d] = isoToDateInput(iso).split('-').map(Number)
  const day = ['일', '월', '화', '수', '목', '금', '토'][new Date(y, m - 1, d).getDay()]
  return `${m}월 ${d}일${withWeekday ? ` (${day})` : ''}`
}

export const monthLabel = (iso) => {
  const [y, m] = isoToDateInput(iso).split('-').map(Number)
  return `${y}년 ${m}월`
}

export function addDays(dateInput, days) {
  const [y, m, d] = dateInput.split('-').map(Number)
  return toDateInput(new Date(y, m - 1, d + days))
}
