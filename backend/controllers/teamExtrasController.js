const mongoose = require('mongoose')
const Team = require('../models/Team')
const Setlist = require('../models/Setlist')
const Assignment = require('../models/Assignment')
const { LEAD_ROLE } = require('../utils/leader')
const Unavailability = require('../models/Unavailability')
const TeamPost = require('../models/TeamPost')
const TeamPostSeen = require('../models/TeamPostSeen')
const Attendance = require('../models/Attendance')
const { FORBIDDEN_WORKSPACE } = require('../utils/access')
const { takeAttempt } = require('../utils/rateLimit')

const DAY_MS = 24 * 60 * 60 * 1000
const RATE_WINDOW_MS = 15 * 60 * 1000
const POSTS_PAGE = 50
const MAX_PINNED = 20
const MAX_ASSIGNMENTS_PER_SETLIST = 50
const MAX_FUTURE_UNAVAILABLE = 100
const ROLE_MAX = 20

const isId = (v) => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) && mongoose.isValidObjectId(v)
const sameId = (a, b) => String(a?._id || a) === String(b?._id || b)
const isMember = (team, userId) => team.members.some((m) => sameId(m, userId))
const isOwner = (team, user) => sameId(team.owner, user._id)

// 'YYYY-MM-DD' → 그날 UTC 자정 (콘티 날짜와 같은 방식). 형식이 틀리면 null
function parseDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null
  return d
}

// 오늘 UTC 자정. 한국 시간(UTC+9)은 UTC보다 하루 빠를 수 있으므로 하루 여유를 둔다
const startOfTodayUtc = () => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}
const yesterdayUtc = () => new Date(startOfTodayUtc().getTime() - DAY_MS)

// 문자열 입력 정리. 문자열이 아니면 빈 문자열
const clean = (v) => (typeof v === 'string' ? v.trim() : '')

const fail = (res, status, message) => res.status(status).json({ message })
const serverError = (res, err) => res.status(500).json({ message: err.message })

// /:teamId 로 들어오는 모든 요청: 내가 속한 팀인지 확인하고 req.team에 담는다
exports.loadTeam = async (req, res, next) => {
  try {
    const { teamId } = req.params
    if (!isId(teamId)) return fail(res, 404, FORBIDDEN_WORKSPACE)
    const team = await Team.findOne({ _id: teamId, members: req.user._id })
    if (!team) return fail(res, 404, FORBIDDEN_WORKSPACE)
    req.team = team
    next()
  } catch (err) {
    serverError(res, err)
  }
}

// ───────────── 팀원 배정 ─────────────

async function findTeamSetlist(team, setlistId) {
  if (!isId(setlistId)) return null
  return Setlist.findOne({ _id: setlistId, team: team._id }, 'name gigDate team')
}

exports.listAssignments = async (req, res) => {
  try {
    const setlist = await findTeamSetlist(req.team, req.query.setlist)
    if (!setlist) return fail(res, 404, '이 팀의 콘티를 찾을 수 없습니다')
    const list = await Assignment.find({ team: req.team._id, setlist: setlist._id })
      .populate('user', 'email')
      .sort({ createdAt: 1 })
      .limit(MAX_ASSIGNMENTS_PER_SETLIST)
    res.json(list)
  } catch (err) {
    serverError(res, err)
  }
}

exports.createAssignment = async (req, res) => {
  try {
    const { setlist: setlistId, user: userId } = req.body || {}
    const role = clean(req.body?.role)
    if (!role) return fail(res, 400, '맡을 자리(역할)를 적어 주세요')
    if (role.length > ROLE_MAX) return fail(res, 400, `역할은 ${ROLE_MAX}자 이내로 적어 주세요`)
    if (!isId(userId)) return fail(res, 400, '배정할 팀원을 골라 주세요')
    // '인도' 배정은 실시간 진행·콘티 확정 권한을 주므로 팀장만 할 수 있다
    if (LEAD_ROLE.test(role) && !isOwner(req.team, req.user)) return fail(res, 403, '‘인도’ 배정은 팀장만 할 수 있습니다')

    const setlist = await findTeamSetlist(req.team, setlistId)
    if (!setlist) return fail(res, 404, '이 팀의 콘티를 찾을 수 없습니다')
    if (!isMember(req.team, userId)) return fail(res, 400, '이 팀의 팀원이 아닙니다')

    const count = await Assignment.countDocuments({ setlist: setlist._id })
    if (count >= MAX_ASSIGNMENTS_PER_SETLIST) {
      return fail(res, 400, `한 콘티에는 ${MAX_ASSIGNMENTS_PER_SETLIST}명까지 배정할 수 있습니다`)
    }

    const assignment = await Assignment.create({
      team: req.team._id,
      setlist: setlist._id,
      user: userId,
      role,
      createdBy: req.user._id,
    })
    await assignment.populate('user', 'email')
    res.status(201).json(assignment)
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, '이미 같은 자리에 배정된 팀원입니다')
    serverError(res, err)
  }
}

exports.deleteAssignment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, '배정을 찾을 수 없습니다')
    const assignment = await Assignment.findOne({ _id: req.params.id, team: req.team._id })
    if (!assignment) return fail(res, 404, '배정을 찾을 수 없습니다')
    // 배정한 사람, 배정받은 본인, 팀장만 뺄 수 있다
    const allowed = [assignment.createdBy, assignment.user].some((id) => sameId(id, req.user._id)) || isOwner(req.team, req.user)
    if (!allowed) return fail(res, 403, '배정한 사람이나 본인, 팀장만 뺄 수 있습니다')
    await assignment.deleteOne()
    res.json({ message: '배정을 뺐습니다' })
  } catch (err) {
    serverError(res, err)
  }
}

// 배정받은 본인만 수락·거절한다
exports.respondAssignment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, '배정을 찾을 수 없습니다')
    const assignment = await Assignment.findOne({ _id: req.params.id, team: req.team._id })
    if (!assignment) return fail(res, 404, '배정을 찾을 수 없습니다')
    if (!sameId(assignment.user, req.user._id)) {
      return fail(res, 403, '본인에게 배정된 것만 수락하거나 거절할 수 있습니다')
    }

    const { status } = req.body || {}
    if (status !== 'accepted' && status !== 'declined') return fail(res, 400, '수락 또는 거절을 골라 주세요')
    const reason = clean(req.body?.declineReason)
    if (reason.length > 200) return fail(res, 400, '거절 이유는 200자 이내로 적어 주세요')

    assignment.status = status
    assignment.declineReason = status === 'declined' ? reason : ''
    await assignment.save()
    await assignment.populate('user', 'email')
    res.json(assignment)
  } catch (err) {
    serverError(res, err)
  }
}

// 내 배정 중 다가오는 것 (날짜 없는 콘티 포함, 지난 콘티·삭제된 콘티 제외)
async function upcomingAssignmentsFor(team, user) {
  const all = await Assignment.find({ team: team._id, user: user._id })
    .sort({ createdAt: -1 })
    .limit(300)
    .populate('setlist', 'name gigDate')
    .lean()
  const from = yesterdayUtc()
  return all
    .filter((a) => a.setlist && (!a.setlist.gigDate || new Date(a.setlist.gigDate) >= from))
    .sort((a, b) => {
      const da = a.setlist.gigDate ? new Date(a.setlist.gigDate).getTime() : Infinity
      const db = b.setlist.gigDate ? new Date(b.setlist.gigDate).getTime() : Infinity
      return da - db
    })
    .slice(0, 50)
}

exports.myAssignments = async (req, res) => {
  try {
    const assignments = await upcomingAssignmentsFor(req.team, req.user)
    res.json({ assignments, pendingCount: assignments.filter((a) => a.status === 'pending').length })
  } catch (err) {
    serverError(res, err)
  }
}

// ───────────── 못 나오는 날 ─────────────

exports.listUnavailability = async (req, res) => {
  try {
    const from = req.query.from ? parseDay(req.query.from) : yesterdayUtc()
    const to = req.query.to ? parseDay(req.query.to) : null
    if (!from || (req.query.to && !to)) return fail(res, 400, '날짜 형식이 올바르지 않습니다')

    const date = { $gte: from }
    if (to) date.$lte = to
    const list = await Unavailability.find({ team: req.team._id, date })
      .populate('user', 'email')
      .sort({ date: 1 })
      .limit(500)
    res.json(list)
  } catch (err) {
    serverError(res, err)
  }
}

exports.addUnavailability = async (req, res) => {
  try {
    const date = parseDay(req.body?.date)
    if (!date) return fail(res, 400, '날짜를 골라 주세요')
    if (date < yesterdayUtc()) return fail(res, 400, '지난 날짜는 표시할 수 없습니다')
    const note = clean(req.body?.note)
    if (note.length > 100) return fail(res, 400, '메모는 100자 이내로 적어 주세요')

    const mine = { team: req.team._id, user: req.user._id }
    const count = await Unavailability.countDocuments({ ...mine, date: { $gte: yesterdayUtc() } })
    if (count >= MAX_FUTURE_UNAVAILABLE) {
      return fail(res, 400, `못 나오는 날은 ${MAX_FUTURE_UNAVAILABLE}개까지 표시할 수 있습니다`)
    }

    // 같은 날을 다시 표시하면 메모만 바꾼다
    const doc = await Unavailability.findOneAndUpdate(
      { ...mine, date },
      { note },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).populate('user', 'email')
    res.status(201).json(doc)
  } catch (err) {
    if (err.code === 11000) return fail(res, 409, '이미 표시한 날짜입니다')
    serverError(res, err)
  }
}

exports.deleteUnavailability = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, '표시를 찾을 수 없습니다')
    const doc = await Unavailability.findOne({ _id: req.params.id, team: req.team._id })
    if (!doc) return fail(res, 404, '표시를 찾을 수 없습니다')
    if (!sameId(doc.user, req.user._id)) return fail(res, 403, '내가 표시한 날짜만 지울 수 있습니다')
    await doc.deleteOne()
    res.json({ message: '지웠습니다' })
  } catch (err) {
    serverError(res, err)
  }
}

// ───────────── 공지 · 기도제목 ─────────────

async function unreadCountFor(team, user) {
  const seen = await TeamPostSeen.findOne({ team: team._id, user: user._id })
  const filter = { team: team._id, author: { $ne: user._id } }
  if (seen) filter.createdAt = { $gt: seen.lastSeenPostsAt }
  return TeamPost.countDocuments(filter)
}

// 첫 페이지: 고정 공지를 맨 위에, 그다음 최신 글 50개. before(마지막 글의 작성 시각)로 다음 페이지
exports.listPosts = async (req, res) => {
  try {
    const base = { team: req.team._id }
    if (req.query.kind) {
      if (!['notice', 'prayer'].includes(req.query.kind)) return fail(res, 400, '잘못된 요청입니다')
      base.kind = req.query.kind
    }
    let before = null
    if (req.query.before) {
      before = new Date(String(req.query.before))
      if (Number.isNaN(before.getTime())) return fail(res, 400, '잘못된 요청입니다')
    }

    const populate = (q) => q.populate('author', 'email').populate('prayedBy', 'email')
    const pinned = before
      ? []
      : await populate(TeamPost.find({ ...base, pinned: true }).sort({ createdAt: -1 }).limit(MAX_PINNED))
    const rest = await populate(
      TeamPost.find({ ...base, pinned: { $ne: true }, ...(before && { createdAt: { $lt: before } }) })
        .sort({ createdAt: -1 })
        .limit(POSTS_PAGE + 1)
    )

    res.json({
      posts: [...pinned, ...rest.slice(0, POSTS_PAGE)],
      hasMore: rest.length > POSTS_PAGE,
      unreadCount: await unreadCountFor(req.team, req.user),
    })
  } catch (err) {
    serverError(res, err)
  }
}

// 탭 배지용: 안 읽은 글 수 + 아직 답하지 않은 내 배정 수
exports.getUnread = async (req, res) => {
  try {
    const [unreadCount, upcoming] = await Promise.all([
      unreadCountFor(req.team, req.user),
      upcomingAssignmentsFor(req.team, req.user),
    ])
    res.json({ unreadCount, pendingAssignments: upcoming.filter((a) => a.status === 'pending').length })
  } catch (err) {
    serverError(res, err)
  }
}

exports.markPostsSeen = async (req, res) => {
  try {
    await TeamPostSeen.findOneAndUpdate(
      { team: req.team._id, user: req.user._id },
      { lastSeenPostsAt: new Date() },
      { upsert: true }
    )
    res.json({ unreadCount: 0 })
  } catch (err) {
    serverError(res, err)
  }
}

exports.createPost = async (req, res) => {
  try {
    const { kind } = req.body || {}
    if (kind !== 'notice' && kind !== 'prayer') return fail(res, 400, '공지인지 기도제목인지 골라 주세요')
    const title = clean(req.body?.title)
    const body = clean(req.body?.body)
    if (!title) return fail(res, 400, '제목을 적어 주세요')
    if (title.length > 100) return fail(res, 400, '제목은 100자 이내로 적어 주세요')
    if (body.length > 2000) return fail(res, 400, '내용은 2000자 이내로 적어 주세요')

    if (!(await takeAttempt(`team-post:${req.user._id}`, 30, RATE_WINDOW_MS))) {
      return fail(res, 429, '글을 너무 자주 올렸습니다. 15분 뒤에 다시 올려 주세요')
    }

    const pinned = kind === 'notice' && req.body.pinned === true && isOwner(req.team, req.user)
    const post = await TeamPost.create({ team: req.team._id, kind, title, body, pinned, author: req.user._id })
    await post.populate('author', 'email')
    res.status(201).json(post)
  } catch (err) {
    serverError(res, err)
  }
}

async function findTeamPost(req, res) {
  if (!isId(req.params.id)) { fail(res, 404, '글을 찾을 수 없습니다'); return null }
  const post = await TeamPost.findOne({ _id: req.params.id, team: req.team._id })
  if (!post) fail(res, 404, '글을 찾을 수 없습니다')
  return post
}

// 쓴 사람 또는 팀장만 지운다
exports.deletePost = async (req, res) => {
  try {
    const post = await findTeamPost(req, res)
    if (!post) return
    if (!sameId(post.author, req.user._id) && !isOwner(req.team, req.user)) {
      return fail(res, 403, '글을 쓴 사람이나 팀장만 지울 수 있습니다')
    }
    await post.deleteOne()
    res.json({ message: '글을 지웠습니다' })
  } catch (err) {
    serverError(res, err)
  }
}

exports.pinPost = async (req, res) => {
  try {
    if (!isOwner(req.team, req.user)) return fail(res, 403, '팀장만 공지를 고정할 수 있습니다')
    const post = await findTeamPost(req, res)
    if (!post) return
    if (post.kind !== 'notice') return fail(res, 400, '공지만 고정할 수 있습니다')
    post.pinned = req.body?.pinned === true
    await post.save()
    await post.populate('author', 'email')
    await post.populate('prayedBy', 'email')
    res.json(post)
  } catch (err) {
    serverError(res, err)
  }
}

// "함께 기도해요" 누르기·취소
exports.togglePray = async (req, res) => {
  try {
    const post = await findTeamPost(req, res)
    if (!post) return
    if (post.kind !== 'prayer') return fail(res, 400, '기도제목에만 누를 수 있습니다')
    const already = post.prayedBy.some((u) => sameId(u, req.user._id))
    const updated = await TeamPost.findByIdAndUpdate(
      post._id,
      already ? { $pull: { prayedBy: req.user._id } } : { $addToSet: { prayedBy: req.user._id } },
      { new: true }
    ).populate('author', 'email').populate('prayedBy', 'email')
    res.json(updated)
  } catch (err) {
    serverError(res, err)
  }
}

// ───────────── 출석 체크 ─────────────

const ATTENDANCE_KINDS = ['예배', '연습', '기타']

// 팀원만 남기고 중복을 뺀다
function presentMembers(team, list) {
  if (!Array.isArray(list)) return []
  const ids = new Set()
  for (const id of list.slice(0, 500)) {
    if (isId(id) && isMember(team, id)) ids.add(String(id))
  }
  return [...ids]
}

const threeMonthsAgoUtc = () => {
  const t = startOfTodayUtc()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 3, t.getUTCDate()))
}

exports.listAttendance = async (req, res) => {
  try {
    const since = threeMonthsAgoUtc()
    const events = await Attendance.find({ team: req.team._id, date: { $gte: since } })
      .sort({ date: -1, createdAt: -1 })
      .limit(200)
      .populate('createdBy', 'email')
    await req.team.populate('members', 'email')

    const totalEvents = events.length
    const stats = req.team.members.map((m) => {
      const present = events.filter((e) => e.present.some((p) => sameId(p, m._id))).length
      return {
        user: { _id: m._id, email: m.email },
        present,
        rate: totalEvents ? Math.round((present / totalEvents) * 100) : 0,
      }
    })
    res.json({ events, stats, totalEvents, since })
  } catch (err) {
    serverError(res, err)
  }
}

exports.createAttendance = async (req, res) => {
  try {
    const date = parseDay(req.body?.date)
    if (!date) return fail(res, 400, '날짜를 골라 주세요')
    const kind = req.body?.kind || '예배'
    if (!ATTENDANCE_KINDS.includes(kind)) return fail(res, 400, '예배·연습·기타 중에서 골라 주세요')
    const title = clean(req.body?.title)
    if (title.length > 50) return fail(res, 400, '이름은 50자 이내로 적어 주세요')

    if (!(await takeAttempt(`team-attendance:${req.user._id}`, 30, RATE_WINDOW_MS))) {
      return fail(res, 429, '출석부를 너무 자주 만들었습니다. 15분 뒤에 다시 해 주세요')
    }

    const event = await Attendance.create({
      team: req.team._id,
      date,
      kind,
      title,
      present: presentMembers(req.team, req.body?.present),
      createdBy: req.user._id,
    })
    await event.populate('createdBy', 'email')
    res.status(201).json(event)
  } catch (err) {
    serverError(res, err)
  }
}

// 팀원 누구나 출석을 체크·해제할 수 있다
exports.updateAttendance = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, '출석부를 찾을 수 없습니다')
    const event = await Attendance.findOne({ _id: req.params.id, team: req.team._id })
    if (!event) return fail(res, 404, '출석부를 찾을 수 없습니다')

    if (req.body?.present !== undefined) {
      if (!Array.isArray(req.body.present)) return fail(res, 400, '잘못된 요청입니다')
      event.present = presentMembers(req.team, req.body.present)
    }
    if (req.body?.title !== undefined) {
      const title = clean(req.body.title)
      if (title.length > 50) return fail(res, 400, '이름은 50자 이내로 적어 주세요')
      event.title = title
    }
    if (req.body?.kind !== undefined) {
      if (!ATTENDANCE_KINDS.includes(req.body.kind)) return fail(res, 400, '예배·연습·기타 중에서 골라 주세요')
      event.kind = req.body.kind
    }
    await event.save()
    await event.populate('createdBy', 'email')
    res.json(event)
  } catch (err) {
    serverError(res, err)
  }
}

// 만든 사람 또는 팀장만 지운다
exports.deleteAttendance = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, '출석부를 찾을 수 없습니다')
    const event = await Attendance.findOne({ _id: req.params.id, team: req.team._id })
    if (!event) return fail(res, 404, '출석부를 찾을 수 없습니다')
    if (!sameId(event.createdBy, req.user._id) && !isOwner(req.team, req.user)) {
      return fail(res, 403, '출석부를 만든 사람이나 팀장만 지울 수 있습니다')
    }
    await event.deleteOne()
    res.json({ message: '출석부를 지웠습니다' })
  } catch (err) {
    serverError(res, err)
  }
}
