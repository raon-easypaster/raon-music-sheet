const Team = require('../models/Team')
const Song = require('../models/Song')
const Setlist = require('../models/Setlist')
const User = require('../models/User')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const { generateTempPassword } = require('../utils/tempPassword')

const TEMP_PASSWORD_TTL_MS = 24 * 60 * 60 * 1000

exports.createTeam = async (req, res) => {
  try {
    const { name } = req.body
    if (!name) return res.status(400).json({ message: '팀 이름은 필수입니다' })

    const team = await Team.create({ name, owner: req.user._id, members: [req.user._id] })
    res.status(201).json(team)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.getMyTeams = async (req, res) => {
  try {
    const teams = await Team.find({ members: req.user._id }).populate('owner', 'email').populate('members', 'email')
    res.json(teams)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.joinTeam = async (req, res) => {
  try {
    const { inviteCode } = req.body
    if (!inviteCode) return res.status(400).json({ message: '초대 코드가 필요합니다' })

    const team = await Team.findOne({ inviteCode: inviteCode.toUpperCase() })
    if (!team) return res.status(404).json({ message: '유효하지 않은 초대 코드입니다' })

    const alreadyMember = team.members.some((m) => m.toString() === req.user._id.toString())
    if (!alreadyMember) {
      team.members.push(req.user._id)
      await team.save()
    }

    await team.populate('owner', 'email')
    await team.populate('members', 'email')
    res.json(team)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.getTeamById = async (req, res) => {
  try {
    const team = await Team.findOne({ _id: req.params.id, members: req.user._id })
      .populate('owner', 'email')
      .populate('members', 'email')
    if (!team) return res.status(404).json({ message: '팀을 찾을 수 없습니다' })
    res.json(team)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.leaveTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
    if (!team) return res.status(404).json({ message: '팀을 찾을 수 없습니다' })

    if (team.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: '팀장은 팀을 나갈 수 없습니다. 팀을 삭제하세요.' })
    }

    team.members = team.members.filter((m) => m.toString() !== req.user._id.toString())
    await team.save()
    res.json({ message: '팀에서 나왔습니다' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.deleteTeam = async (req, res) => {
  try {
    const team = await Team.findOne({ _id: req.params.id, owner: req.user._id })
    if (!team) return res.status(404).json({ message: '팀을 찾을 수 없거나 권한이 없습니다' })

    // 팀 곡·콘티는 지우지 않고 각각 만든 사람의 개인 공간으로 돌려보낸다
    await Song.updateMany({ team: team._id }, { team: null })
    await Setlist.updateMany({ team: team._id }, { team: null })

    await team.deleteOne()
    res.json({ message: '팀이 삭제되었습니다. 팀 곡·콘티는 각자 만든 사람의 개인 공간으로 옮겨졌습니다' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// 내 개인 곡·콘티를 모두 이 팀의 공유 공간으로 옮긴다
exports.moveMyItemsToTeam = async (req, res) => {
  try {
    const team = await Team.findOne({ _id: req.params.id, members: req.user._id })
    if (!team) return res.status(404).json({ message: '팀을 찾을 수 없습니다' })

    const mine = { user: req.user._id, team: null }
    const songs = await Song.updateMany(mine, { team: team._id })
    const setlists = await Setlist.updateMany(mine, { team: team._id })

    res.json({
      songs: songs.modifiedCount,
      setlists: setlists.modifiedCount,
      message: `곡 ${songs.modifiedCount}개, 콘티 ${setlists.modifiedCount}개를 '${team.name}' 팀으로 옮겼습니다`,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// 팀장이 팀원의 비밀번호를 임시 비밀번호로 초기화한다. 임시 비밀번호는 이 응답에서 한 번만 보여 준다
exports.resetMemberPassword = async (req, res) => {
  try {
    const { id, userId } = req.params
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: '잘못된 요청입니다' })
    }

    const team = await Team.findOne({ _id: id, owner: req.user._id })
    if (!team) return res.status(403).json({ message: '팀장만 팀원 비밀번호를 초기화할 수 있습니다' })

    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: '내 비밀번호는 비밀번호 변경에서 바꿔 주세요' })
    }
    if (!team.members.some((m) => m.toString() === userId)) {
      return res.status(404).json({ message: '이 팀의 팀원이 아닙니다' })
    }

    const member = await User.findById(userId)
    if (!member) return res.status(404).json({ message: '팀원을 찾을 수 없습니다' })

    const tempPassword = generateTempPassword()
    member.password = await bcrypt.hash(tempPassword, await bcrypt.genSalt(10))
    member.mustChangePassword = true
    member.tempPasswordExpiresAt = new Date(Date.now() + TEMP_PASSWORD_TTL_MS)
    await member.save()

    res.json({ email: member.email, tempPassword })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
