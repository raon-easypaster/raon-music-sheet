import { useState } from 'react'
import TeamPosts from './TeamPosts'
import MyAssignments from './MyAssignments'
import UnavailableDays from './UnavailableDays'
import AttendanceBook from './AttendanceBook'
import './teamExtras.css'

const SECTIONS = ['공지 · 기도제목', '내 배정', '못 나오는 날', '출석']

// "팀 소식" 탭: 팀 작업 공간에서만 쓴다
// props: team(Dashboard의 현재 팀, members·owner가 채워진 것), currentUserId, pendingAssignments(배지 숫자), onChanged(배지 새로고침)
export default function TeamNews({ team, currentUserId, pendingAssignments = 0, onChanged }) {
  const [section, setSection] = useState(0)

  if (!team) {
    return (
      <div className="card panel tx">
        <h2>팀 소식</h2>
        <p className="muted">
          팀에서 쓰는 기능입니다. 화면 위 <strong>작업 공간</strong>에서 팀을 고르면 공지·기도제목, 예배 배정,
          못 나오는 날, 출석 체크를 함께 쓸 수 있습니다.
        </p>
      </div>
    )
  }

  return (
    <div className="card panel tx">
      <h2>팀 소식 <span className="muted tx-team-name">{team.name}</span></h2>
      <div className="tx-segment tx-sections" role="tablist">
        {SECTIONS.map((name, i) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={section === i}
            className={section === i ? 'active' : ''}
            onClick={() => setSection(i)}
          >
            {name}
            {i === 1 && pendingAssignments > 0 && <span className="tx-dot">{pendingAssignments}</span>}
          </button>
        ))}
      </div>

      {section === 0 && <TeamPosts key={team._id} team={team} currentUserId={currentUserId} onSeen={onChanged} />}
      {section === 1 && <MyAssignments key={team._id} teamId={team._id} onChanged={onChanged} />}
      {section === 2 && <UnavailableDays key={team._id} teamId={team._id} currentUserId={currentUserId} />}
      {section === 3 && <AttendanceBook key={team._id} team={team} currentUserId={currentUserId} />}
    </div>
  )
}
