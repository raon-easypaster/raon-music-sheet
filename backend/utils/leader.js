const Team = require('../models/Team')
const Assignment = require('../models/Assignment')

// 콘티를 이끄는 사람(인도자) 권한: 실시간 곡 넘기기(진행), 콘티 확정·확정 해제
// - 개인 콘티: 만든 본인
// - 팀 콘티: 팀장, 또는 이 콘티에 '인도'로 배정된 팀원(거절하지 않은 경우)
const LEAD_ROLE = /인도/

const sameId = (a, b) => !!a && !!b && String(a._id || a) === String(b._id || b)

async function canLead(user, setlist) {
  if (!user || !setlist) return false
  if (!setlist.team) return sameId(setlist.user, user._id)
  const team = await Team.findOne({ _id: setlist.team, members: user._id }, 'owner')
  if (!team) return false
  if (sameId(team.owner, user._id)) return true
  const assigned = await Assignment.find({ setlist: setlist._id, user: user._id, status: { $ne: 'declined' } }, 'role').lean()
  return assigned.some((a) => LEAD_ROLE.test(a.role))
}

// 화면에 보여 줄 '진행할 수 있는 사람' 설명
async function leaderSummary(setlist) {
  if (!setlist.team) return { owner: true, leads: [] }
  const assigned = await Assignment.find({ setlist: setlist._id, status: { $ne: 'declined' } }, 'role user')
    .populate('user', 'email')
    .lean()
  return {
    owner: true,
    leads: assigned.filter((a) => LEAD_ROLE.test(a.role) && a.user).map((a) => ({ _id: a.user._id, email: a.user.email })),
  }
}

module.exports = { canLead, leaderSummary, sameId }
