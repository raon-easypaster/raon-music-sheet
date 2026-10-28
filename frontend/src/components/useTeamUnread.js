import { useCallback, useEffect, useState } from 'react'
import { getUnread } from '../api/teamExtras'

// "팀 소식" 탭 배지: 안 읽은 글 수 + 답하지 않은 내 배정 수
// teamId가 없으면(개인 공간) 0. refreshKey가 바뀔 때(예: 탭 이동)마다 다시 확인한다
export default function useTeamUnread(teamId, refreshKey) {
  const [state, setState] = useState({ teamId: '', unreadCount: 0, pendingAssignments: 0 })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!teamId) return undefined
    let alive = true
    getUnread(teamId)
      .then((d) => {
        if (alive) setState({ teamId, unreadCount: d.unreadCount || 0, pendingAssignments: d.pendingAssignments || 0 })
      })
      .catch(() => { /* 배지는 못 불러와도 다른 화면에는 지장 없음 */ })
    return () => { alive = false }
  }, [teamId, refreshKey, version])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])
  const current = teamId && state.teamId === teamId ? state : { unreadCount: 0, pendingAssignments: 0 }
  return { ...current, total: current.unreadCount + current.pendingAssignments, refresh }
}
