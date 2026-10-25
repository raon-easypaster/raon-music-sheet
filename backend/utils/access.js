const mongoose = require('mongoose')
const Team = require('../models/Team')

// 작업 공간(workspace): team 값이 없으면 "내 개인 공간", 있으면 그 팀의 공유 공간
// 요청한 팀에 소속되어 있지 않으면 null을 반환한다
exports.resolveWorkspace = async (user, teamId) => {
  if (!teamId || teamId === 'personal') {
    return { team: null, filter: { user: user._id, team: null } }
  }
  if (!mongoose.Types.ObjectId.isValid(teamId)) return null

  const team = await Team.findOne({ _id: teamId, members: user._id })
  if (!team) return null

  return { team, filter: { team: team._id } }
}

// 개별 곡·콘티에 접근할 수 있는지: 내가 만든 개인 항목이거나, 내가 속한 팀의 항목
exports.accessFilter = async (user) => {
  const teams = await Team.find({ members: user._id }, '_id')
  return {
    $or: [
      { user: user._id, team: null },
      { team: { $in: teams.map((t) => t._id) } },
    ],
  }
}

// 삭제는 만든 사람 또는 팀장만
exports.canDelete = async (user, doc) => {
  if (doc.user.toString() === user._id.toString()) return true
  if (!doc.team) return false
  const team = await Team.findById(doc.team, 'owner')
  return !!team && team.owner.toString() === user._id.toString()
}

exports.FORBIDDEN_WORKSPACE = '팀을 찾을 수 없거나 팀원이 아닙니다'
