const mongoose = require('mongoose')
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const Setlist = require('../models/Setlist')
const Song = require('../models/Song')
const PinAttempt = require('../models/PinAttempt')
const ServiceTemplate = require('../models/ServiceTemplate')
const Assignment = require('../models/Assignment')
const SheetAnnotation = require('../models/SheetAnnotation')
const SetlistRevision = require('../models/SetlistRevision')
const SetlistAck = require('../models/SetlistAck')
const PracticeRecord = require('../models/PracticeRecord')
const Team = require('../models/Team')
const { cleanItems, cleanStartTime, toTemplateItems, syncItemsWithSongs } = require('../utils/serviceOrder')
const { clientIp } = require('../utils/rateLimit')
const { resolveWorkspace, accessFilter, canDelete, FORBIDDEN_WORKSPACE } = require('../utils/access')
const { effectiveSheets, pickSheet, practiceFingerprint, normalizeKey } = require('../utils/sheets')
const { cleanFlow, FLOW_MAX } = require('../utils/flow')
const { snapshot, describeChanges } = require('../utils/setlistHistory')
const { canLead, leaderSummary, sameId } = require('../utils/leader')
const optionalUser = require('../utils/optionalUser')
const { checkShareAccess, rejectShare } = require('../utils/sharePin')
const { grantShare, ensureUserCookie } = require('../utils/sheetAccess')

function cleanSetlistId(raw) {
  const cleanId = String(raw).trim().replace(/^"|"$/g, '')
  return mongoose.Types.ObjectId.isValid(cleanId) ? cleanId : null
}

// 내가 접근할 수 있는 콘티 (개인 콘티 또는 내가 속한 팀의 콘티)
async function findAccessibleSetlist(req) {
  const id = cleanSetlistId(req.params.id)
  if (!id) return null
  return Setlist.findOne({ _id: id, ...(await accessFilter(req.user)) })
}

// 콘티와 같은 작업 공간의 곡만 담을 수 있다
async function sameWorkspaceSongIds(setlist, songIds) {
  const scope = setlist.team ? { team: setlist.team } : { user: setlist.user, team: null }
  const validIds = songIds.filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
  const songs = await Song.find({ _id: { $in: validIds }, ...scope }, '_id')
  const allowed = new Set(songs.map((s) => s._id.toString()))
  return validIds.filter((id) => allowed.has(String(id)))
}

const populateSetlist = (id) => Setlist.findById(id).populate('songs').populate('user', 'email').populate('confirmedBy', 'email')

// ── 수정 이력·충돌 확인 ──
// 콘티 내용을 바꾸는 요청은 모두 commitChange를 거친다.
// - 화면이 보고 있던 판 번호(baseRevision)가 지금과 다르면 409로 돌려보낸다 → 다른 사람의 변경을 조용히 덮어쓰지 않는다
//   (baseRevision을 보내지 않는 예전 화면·스크립트는 예전처럼 저장된다)
// - 바뀐 내용이 있으면 판 번호를 1 올리고, 누가·언제·무엇을 바꿨는지 이력을 남긴다
const SAVED_FIELDS = ['name', 'venue', 'gigDate', 'notes', 'serviceType', 'startTime', 'songs', 'items', 'songSettings',
  'status', 'confirmedAt', 'confirmedBy', 'confirmedRevision']

async function songInfo(ids) {
  const valid = [...new Set(ids.map(String))].filter((id) => mongoose.isValidObjectId(id))
  const list = await Song.find({ _id: { $in: valid } }, 'title key structure sheets sheetImageUrl sheetPdfUrl').lean()
  return new Map(list.map((s) => [String(s._id), s]))
}

async function sendConflict(res, setlistId, base) {
  const latest = await Setlist.findById(setlistId, 'revision')
  const recent = await SetlistRevision.find({ setlist: setlistId, revision: { $gt: base } })
    .sort({ revision: 1 }).limit(20).populate('user', 'email').lean()
  return res.status(409).json({
    conflict: true,
    message: '다른 사람이 먼저 콘티를 고쳤습니다. 최신 내용을 다시 불러왔으니 바뀐 내용을 확인하고 다시 해 주세요.',
    revision: latest?.revision ?? base,
    changes: recent.flatMap((r) => r.changes.map((c) => `${r.user?.email || '누군가'}: ${c}`)),
  })
}

// mutate(setlist)가 콘티를 고친다. { error, status }를 돌려주면 저장하지 않고 그 오류를 보낸다
async function commitChange(req, res, mutate, { kind = 'change', setlist: loaded } = {}) {
  const setlist = loaded || await findAccessibleSetlist(req)
  if (!setlist) return res.status(404).json({ message: 'Setlist not found' })

  const base = req.body?.baseRevision
  if (base !== undefined && base !== null && Number(base) !== setlist.revision) {
    return sendConflict(res, setlist._id, Number(base))
  }

  const before = snapshot(setlist)
  const result = await mutate(setlist)
  if (result?.error) return res.status(result.status || 400).json({ message: result.error })
  const after = snapshot(setlist)
  const songs = await songInfo([...before.songs, ...after.songs])
  const changes = [...(result?.changes || []), ...describeChanges(before, after, songs)]
  if (!changes.length) return res.json(await populateSetlist(setlist._id))

  const doc = setlist.toObject({ depopulate: true })
  const fields = {}
  for (const f of SAVED_FIELDS) fields[f] = doc[f] ?? null
  // 판 번호 칸이 생기기 전에 만든 콘티는 DB에 revision이 없으므로 0과 같이 본다
  const sameRevision = setlist.revision === 0 ? { $in: [0, null] } : setlist.revision
  const updated = await Setlist.updateOne({ _id: setlist._id, revision: sameRevision }, { $set: fields, $inc: { revision: 1 } })
  if (!updated.matchedCount) return sendConflict(res, setlist._id, setlist.revision)

  // 이력을 처음 남길 때는 '기록 시작 전' 내용도 함께 남겨 그 상태로 되돌릴 수 있게 한다
  await SetlistRevision.updateOne(
    { setlist: setlist._id, kind: 'start' },
    { $setOnInsert: { revision: setlist.revision, user: null, changes: ['이력 기록을 시작하기 전 내용'], snapshot: before } },
    { upsert: true }
  )
  // 고친 사람은 자기 변경을 이미 본 것이므로, 바로 앞 판까지 확인했던 사람이면 새 판까지 확인한 것으로 둔다.
  // 확정한 사람은 확정한 판을 확인한 것으로 남긴다
  if (kind === 'confirm') {
    await SetlistAck.findOneAndUpdate({ setlist: setlist._id, user: req.user._id }, { $max: { revision: setlist.revision + 1 } }, { upsert: true })
  } else {
    await SetlistAck.updateOne({ setlist: setlist._id, user: req.user._id, revision: { $gte: setlist.revision } }, { $max: { revision: setlist.revision + 1 } })
  }
  await SetlistRevision.create({
    setlist: setlist._id,
    revision: setlist.revision + 1,
    user: req.user._id,
    kind,
    changes,
    afterConfirm: before.status === 'confirmed' && after.status === 'confirmed' && kind !== 'confirm',
    snapshot: after,
  })
  return res.json(await populateSetlist(setlist._id))
}

// CREATE SETLIST
exports.createSetlist = async (req, res) => {
  try {
    const ws = await resolveWorkspace(req.user, req.body.team)
    if (!ws) return res.status(403).json({ message: FORBIDDEN_WORKSPACE })

    const { name, venue, gigDate, notes } = req.body
    const team = ws.team ? ws.team._id : null

    // 템플릿으로 만들기: 같은 작업 공간의 템플릿만 쓸 수 있다
    let template = null
    if (req.body.templateId) {
      if (!mongoose.isValidObjectId(req.body.templateId)) return res.status(400).json({ message: '템플릿을 찾을 수 없습니다' })
      template = await ServiceTemplate.findOne({ _id: req.body.templateId, ...(team ? { team } : { user: req.user._id, team: null }) })
      if (!template) return res.status(404).json({ message: '템플릿을 찾을 수 없습니다' })
    }

    const setlist = await Setlist.create({
      name,
      venue: venue || template?.venue,
      gigDate,
      notes,
      serviceType: String(req.body.serviceType ?? template?.serviceType ?? '').trim().slice(0, 30),
      startTime: cleanStartTime(req.body.startTime || template?.startTime),
      items: template ? toTemplateItems(template.items) : [],
      user: req.user._id,
      team,
    })
    res.status(201).json(setlist)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET SETLISTS — /setlists?team=<팀 id> (team이 없으면 내 개인 콘티)
exports.getSetlists = async (req, res) => {
  try {
    const ws = await resolveWorkspace(req.user, req.query.team)
    if (!ws) return res.status(403).json({ message: FORBIDDEN_WORKSPACE })

    const setlists = await Setlist
      .find(ws.filter)
      .populate('songs')
      .populate('user', 'email')
      .populate('confirmedBy', 'email')
      .sort({ createdAt: -1 })

    res.json(setlists)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// UPDATE SETLIST DETAILS
exports.updateSetlist = async (req, res) => {
  try {
    if (!cleanSetlistId(req.params.id)) {
      return res.status(400).json({ message: `Invalid setlist id: ${req.params.id}` })
    }
    await commitChange(req, res, (setlist) => {
      const b = req.body
      if (b.name !== undefined && String(b.name).trim()) setlist.name = String(b.name).trim().slice(0, 80)
      if (b.venue !== undefined) setlist.venue = String(b.venue ?? '').trim().slice(0, 80)
      if (b.gigDate !== undefined) setlist.gigDate = b.gigDate || null
      if (b.notes !== undefined) setlist.notes = String(b.notes ?? '').slice(0, 2000)
      if (b.serviceType !== undefined) setlist.serviceType = String(b.serviceType).trim().slice(0, 30)
      if (b.startTime !== undefined) setlist.startTime = cleanStartTime(b.startTime)
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ADD SONGS TO SETLIST
exports.addSongsToSetlist = async (req, res) => {
  try {
    const { songIds } = req.body
    if (!Array.isArray(songIds)) {
      return res.status(400).json({ message: 'songIds must be an array' })
    }
    await commitChange(req, res, async (setlist) => {
      // prevent duplicates, and only songs from the same workspace
      const existing = setlist.songs.map(id => id.toString())
      const allowed = await sameWorkspaceSongIds(setlist, songIds)
      setlist.songs.push(...allowed.filter(id => !existing.includes(String(id))))
      syncItemsWithSongs(setlist)
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE SETLIST — 만든 사람 또는 팀장만
exports.deleteSetlist = async (req, res) => {
  try {
    if (!cleanSetlistId(req.params.id)) {
      return res.status(400).json({ message: `Invalid setlist id: ${req.params.id}` })
    }

    const setlist = await findAccessibleSetlist(req)
    if (!setlist) {
      return res.status(404).json({ message: 'Setlist not found' })
    }
    if (!(await canDelete(req.user, setlist))) {
      return res.status(403).json({ message: '콘티를 만든 사람이나 팀장만 삭제할 수 있습니다' })
    }

    await setlist.deleteOne()
    // 이 콘티의 팀원 배정·악보 필기·수정 이력·변경 확인·연습 기록도 함께 지운다
    await Assignment.deleteMany({ setlist: setlist._id })
    await SheetAnnotation.deleteMany({ setlist: setlist._id })
    await SetlistRevision.deleteMany({ setlist: setlist._id })
    await SetlistAck.deleteMany({ setlist: setlist._id })
    await PracticeRecord.deleteMany({ setlist: setlist._id })
    res.json({ message: 'Setlist deleted successfully' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// REORDER SONGS
exports.reorderSongs = async (req, res) => {
  try {
    const { songIds } = req.body
    if (!Array.isArray(songIds)) return res.status(400).json({ message: 'songIds must be an array' })
    await commitChange(req, res, async (setlist) => {
      setlist.songs = await sameWorkspaceSongIds(setlist, songIds)
      syncItemsWithSongs(setlist)
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GENERATE / GET SHARE TOKEN
exports.getShareToken = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })

    if (!setlist.shareToken) {
      setlist.shareToken = crypto.randomBytes(16).toString('hex')
      setlist.shareOpen = false // 새 링크는 잠가 둔다: 팀원 로그인 또는 공유 비밀번호가 있어야 열린다
      await setlist.save()
    }
    res.json({ shareToken: setlist.shareToken, shareOpen: setlist.shareOpen !== false })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUBLIC VIEW BY TOKEN
// 누가 볼 수 있는지는 utils/sharePin.js의 checkShareAccess가 정한다 (팀원 로그인 · 공유 비밀번호 · 열린 링크)

// 곡 하나를 화면에 보낼 모양으로: 콘티 Key에 맞춰 고른 악보와 Key 비교 결과를 함께 담는다
function songForView(s, own) {
  const key = own?.key || s.key || ''
  const sheets = effectiveSheets(s)
  const pick = pickSheet(sheets, key, own?.sheetId)
  const pages = pick.sheet?.pages || []
  return {
    _id: s._id,
    title: s.title,
    artist: s.artist,
    key,
    capo: s.capo || 0,
    bpm: s.bpm,
    youtubeUrl: s.youtubeUrl,
    mrUrl: s.mrUrl,
    // 예전 화면(앱을 새로 받기 전)을 위해 고른 악보의 첫 사진·PDF도 예전 칸에 담는다
    sheetImageUrl: pages.find((p) => p.type === 'image')?.url || '',
    sheetPdfUrl: pages.find((p) => p.type === 'pdf')?.url || '',
    sheets,
    sheet: pick.sheet,
    keyState: pick.keyState,
    sheetChosen: pick.chosen,
    structure: s.structure,
    flow: cleanFlow(own?.flow), // 이번 콘티의 진행 (비어 있으면 structure를 보여 준다)
    durationMin: s.durationMin || 0,
    notes: [own?.notes, s.notes].filter(Boolean).join('\n'),
  }
}

// 확정 이후 고친 횟수
async function changesAfterConfirm(setlist) {
  if (setlist.status !== 'confirmed') return 0
  return SetlistRevision.countDocuments({ setlist: setlist._id, revision: { $gt: setlist.confirmedRevision }, afterConfirm: true })
}

exports.getPublicSetlist = async (req, res) => {
  try {
    const setlist = await Setlist.findOne({ shareToken: req.params.token }).populate('songs')
    if (!setlist) return res.status(404).json({ message: '유효하지 않은 링크입니다' })
    const access = await checkShareAccess(setlist, req)
    if (access !== 'ok') return rejectShare(res, access)
    // 이 기기에서 이 콘티의 악보 파일을 열 수 있게 한다 (악보 사진·PDF는 볼 권한이 있는 사람에게만 나간다)
    grantShare(req, res, setlist.shareToken)
    ensureUserCookie(req, res, await optionalUser(req))

    const settings = new Map((setlist.songSettings || []).map((s) => [s.song.toString(), s]))
    res.json({
      name: setlist.name,
      gigDate: setlist.gigDate || null,
      serviceType: setlist.serviceType || '',
      startTime: setlist.startTime || '',
      status: setlist.status || 'draft',
      revision: setlist.revision || 0,
      confirmedAt: setlist.confirmedAt || null,
      changesAfterConfirm: await changesAfterConfirm(setlist),
      updatedAt: setlist.updatedAt,
      // 예배 순서 (곡 항목은 songs의 위치로 알려 준다)
      items: (setlist.items || []).map((it) => ({
        kind: it.kind,
        title: it.title,
        minutes: it.minutes,
        note: it.note,
        songIndex: it.kind === 'song' ? setlist.songs.findIndex((s) => s._id.equals(it.song)) : -1,
      })),
      songs: setlist.songs.map((s) => songForView(s, settings.get(s._id.toString()))),
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── 실시간 진행 (곡 넘기기) ──
// 전체 팀의 '지금 곡'은 진행자만 바꾼다. 진행자 = 인도 권한(팀장·인도 배정자·개인 콘티 주인)이 있고 진행을 맡은 사람.
// 공유 링크만 받은 사람과 일반 팀원은 자기 화면에서만 곡을 넘겨 본다(혼자 보기).
// 서버리스에서 여러 서버가 떠도 같은 값을 보도록 위치는 항상 DB에서 읽는다.
const PRESENTER_ACTIVE_MS = 45 * 1000
const HEARTBEAT_MS = 10 * 1000

async function liveView(setlist, user, { member = false } = {}) {
  const lead = user ? await canLead(user, setlist) : false
  const isPresenter = !!user && sameId(setlist.presenter, user._id)
  // 진행자가 화면을 보고 있는 동안은 마지막 신호 시각을 갱신한다 (너무 잦지 않게)
  if (isPresenter && (!setlist.presenterSeenAt || Date.now() - setlist.presenterSeenAt > HEARTBEAT_MS)) {
    setlist.presenterSeenAt = new Date()
    await Setlist.updateOne({ _id: setlist._id, presenter: user._id }, { presenterSeenAt: setlist.presenterSeenAt })
  }
  const active = !!setlist.presenter && !!setlist.presenterSeenAt && Date.now() - setlist.presenterSeenAt < PRESENTER_ACTIVE_MS
  let presenterName
  if (member && setlist.presenter) {
    const u = await mongoose.model('User').findById(setlist.presenter, 'email').lean()
    presenterName = u?.email || ''
  }
  return {
    index: setlist.currentSongIdx || 0,
    seq: setlist.liveSeq || 0,
    presenterSeq: setlist.presenterSeq || 0,
    hasPresenter: !!setlist.presenter,
    presenterActive: active,
    presenterSeenAt: setlist.presenterSeenAt,
    ...(presenterName !== undefined && { presenterName }),
    ...(member && { setlistId: setlist._id }),
    isPresenter,
    canPresent: lead,
    songCount: (setlist.songs || []).length,
    revision: setlist.revision || 0,
  }
}

const LIVE_FIELDS = 'songs currentSongIdx liveSeq presenter presenterSeenAt presenterSeq team user revision sharePinHash shareToken'

// 진행자로서 곡 위치를 바꾼다 (권한 검사는 부르는 쪽에서)
async function moveLive(req, res, setlist, user) {
  const { index, takeover } = req.body || {}
  if (!Number.isInteger(index) || index < 0 || index >= setlist.songs.length) {
    return res.status(400).json({ message: '곡 위치가 올바르지 않습니다' })
  }
  const busy = setlist.presenter && !sameId(setlist.presenter, user._id) &&
    setlist.presenterSeenAt && Date.now() - setlist.presenterSeenAt < PRESENTER_ACTIVE_MS
  if (busy && !takeover) {
    const u = await mongoose.model('User').findById(setlist.presenter, 'email').lean()
    return res.status(409).json({
      busy: true,
      presenterName: u?.email || '',
      message: `${u?.email || '다른 인도자'} 님이 진행 중입니다. 넘겨받으려면 ‘진행 넘겨받기’를 눌러 주세요`,
    })
  }
  const changed = !sameId(setlist.presenter, user._id)
  const updated = await Setlist.findOneAndUpdate(
    { _id: setlist._id },
    { $set: { currentSongIdx: index, presenter: user._id, presenterSeenAt: new Date() }, $inc: { liveSeq: 1, presenterSeq: changed ? 1 : 0 } },
    { new: true, projection: LIVE_FIELDS }
  )
  res.json(await liveView(updated, user, { member: true }))
}

const NO_LEAD = '진행 권한이 없습니다. 팀장이나 이 콘티의 인도자만 전체 화면의 곡을 넘길 수 있어요. 내 화면에서만 보려면 ‘혼자 보기’를 쓰세요'

// GET /setlists/public/:token/current — 누구나 (로그인한 인도자면 진행 권한도 알려 준다)
exports.getPublicCurrentSong = async (req, res) => {
  try {
    const setlist = await Setlist.findOne({ shareToken: req.params.token }, LIVE_FIELDS)
    if (!setlist) return res.status(404).json({ message: '유효하지 않은 링크입니다' })
    const user = await optionalUser(req)
    const member = user ? !!(await Setlist.exists({ _id: setlist._id, ...(await accessFilter(user)) })) : false
    res.json(await liveView(setlist, member ? user : null, { member }))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/public/:token/current  { index, takeover } — 로그인한 인도자만. 공유 링크만으로는 바꿀 수 없다
exports.setPublicCurrentSong = async (req, res) => {
  try {
    const setlist = await Setlist.findOne({ shareToken: req.params.token }, LIVE_FIELDS)
    if (!setlist) return res.status(404).json({ message: '유효하지 않은 링크입니다' })
    const user = await optionalUser(req)
    if (!user || !(await canLead(user, setlist))) return res.status(403).json({ message: NO_LEAD })
    await moveLive(req, res, setlist, user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /setlists/:id/live — 콘티 화면에서 진행 상태 보기
exports.getLive = async (req, res) => {
  try {
    const id = cleanSetlistId(req.params.id)
    if (!id) return res.status(404).json({ message: 'Setlist not found' })
    const setlist = await Setlist.findOne({ _id: id, ...(await accessFilter(req.user)) }, LIVE_FIELDS)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    res.json({ ...(await liveView(setlist, req.user, { member: true })), leaders: await leaderSummary(setlist) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/current  { index, takeover } — 인도 권한이 있는 사람만
exports.setCurrentSong = async (req, res) => {
  try {
    const id = cleanSetlistId(req.params.id)
    if (!id) return res.status(404).json({ message: 'Setlist not found' })
    const setlist = await Setlist.findOne({ _id: id, ...(await accessFilter(req.user)) }, LIVE_FIELDS)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    if (!(await canLead(req.user, setlist))) return res.status(403).json({ message: NO_LEAD })
    await moveLive(req, res, setlist, req.user)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /setlists/:id/live/release — 진행 끝내기 (진행자 본인 또는 팀장)
exports.releaseLive = async (req, res) => {
  try {
    const id = cleanSetlistId(req.params.id)
    if (!id) return res.status(404).json({ message: 'Setlist not found' })
    const setlist = await Setlist.findOne({ _id: id, ...(await accessFilter(req.user)) }, LIVE_FIELDS)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    if (setlist.presenter && !sameId(setlist.presenter, req.user._id) && !(await canLead(req.user, setlist))) {
      return res.status(403).json({ message: NO_LEAD })
    }
    const updated = await Setlist.findOneAndUpdate(
      { _id: setlist._id },
      { $set: { presenter: null, presenterSeenAt: null }, $inc: { presenterSeq: setlist.presenter ? 1 : 0 } },
      { new: true, projection: LIVE_FIELDS }
    )
    res.json(await liveView(updated, req.user, { member: true }))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

exports.removeSongFromSetlist = async (req, res) => {
  try {
    const { songId } = req.body
    if (!songId) {
      return res.status(400).json({ message: 'songId is required' })
    }
    // 필기·연습 기록은 지우지 않는다 (곡을 다시 넣거나 이전 판으로 복원하면 그대로 보인다)
    await commitChange(req, res, (setlist) => {
      setlist.songs = setlist.songs.filter((id) => id.toString() !== songId.toString())
      setlist.songSettings = (setlist.songSettings || []).filter((s) => s.song.toString() !== songId.toString())
      syncItemsWithSongs(setlist)
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /setlists/:id/duplicate — 같은 작업 공간에 곡·순서·콘티별 설정까지 복사한 새 콘티를 만든다
exports.duplicateSetlist = async (req, res) => {
  try {
    const source = await findAccessibleSetlist(req)
    if (!source) return res.status(404).json({ message: 'Setlist not found' })

    const copy = await Setlist.create({
      name: (req.body.name || '').trim() || `${source.name} (복사)`,
      gigDate: req.body.gigDate || null,
      venue: source.venue,
      notes: source.notes,
      songs: source.songs,
      songSettings: source.songSettings,
      serviceType: source.serviceType,
      startTime: source.startTime,
      items: source.items,
      team: source.team,
      user: req.user._id,
    })
    res.status(201).json(await populateSetlist(copy._id))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/song-settings/:songId  { key, notes, sheetId, flow } — 이 콘티에서만 쓸 Key·메모·악보·진행 (모두 비우면 원래대로)
// Key를 바꾸는 것은 '이번에 부를 Key' 이름만 바꾸는 것이다. 악보 이미지·PDF 내용은 바뀌지 않는다
exports.updateSongSettings = async (req, res) => {
  try {
    await commitChange(req, res, async (setlist) => {
      const songId = String(req.params.songId)
      if (!setlist.songs.some((id) => id.toString() === songId)) {
        return { error: '이 콘티에 없는 곡입니다', status: 404 }
      }
      const key = normalizeKey(String(req.body.key || '').trim().slice(0, 10))
      const notes = String(req.body.notes || '').trim().slice(0, 1000)
      const current = (setlist.songSettings || []).find((s) => s.song.toString() === songId)
      let sheetId = req.body.sheetId === undefined ? current?.sheetId || '' : String(req.body.sheetId || '').trim()
      if (sheetId) {
        const song = await Song.findById(songId, 'sheets sheetImageUrl sheetPdfUrl').lean()
        if (!song || !effectiveSheets(song).some((s) => s.id === sheetId)) return { error: '이 곡에 없는 악보입니다' }
      }
      // 진행: 보내지 않으면 지금 것을 그대로 둔다 (예전 화면이 저장해도 지워지지 않게)
      const flow = req.body.flow === undefined ? cleanFlow(current?.flow) : cleanFlow(req.body.flow)
      if (Array.isArray(req.body.flow) && req.body.flow.length > FLOW_MAX) return { error: `진행은 ${FLOW_MAX}칸까지 적을 수 있습니다` }
      const others = (setlist.songSettings || []).filter((s) => s.song.toString() !== songId)
      setlist.songSettings = key || notes || sheetId || flow.length
        ? [...others, { song: songId, key, notes, sheetId, ...(flow.length ? { flow } : {}) }]
        : others
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/share-pin  { pin } — 숫자 4~8자리. 빈 값이면 비밀번호를 해제한다
exports.setSharePin = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })

    const pin = String(req.body.pin ?? '').trim()
    if (pin && !/^\d{6,8}$/.test(pin)) {
      return res.status(400).json({ message: '공유 비밀번호는 숫자 6~8자리로 정해 주세요' })
    }
    setlist.sharePinHash = pin ? await bcrypt.hash(pin, await bcrypt.genSalt(10)) : null
    await setlist.save()
    // 비밀번호를 새로 걸거나 해제하면 이 링크의 잠금 기록도 모두 지운다
    if (setlist.shareToken) {
      await PinAttempt.deleteMany({ key: { $in: [`link:${setlist.shareToken}`] } })
      await PinAttempt.deleteMany({ key: { $regex: `^ip:${setlist.shareToken}:` } })
    }
    res.json({ hasSharePin: !!pin })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/share-access  { open } — 링크만 있으면 누구나 볼 수 있게 열지(true), 잠글지(false)
exports.setShareAccess = async (req, res) => {
  try {
    if (typeof req.body?.open !== 'boolean') return res.status(400).json({ message: 'open은 true 또는 false여야 합니다' })
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    setlist.shareOpen = req.body.open
    await setlist.save()
    res.json({ shareOpen: setlist.shareOpen })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/items  { items: [...] } — 예배 순서 전체 저장 (곡 순서도 이것을 따른다)
exports.updateItems = async (req, res) => {
  try {
    if (!Array.isArray(req.body.items)) return res.status(400).json({ message: 'items must be an array' })
    await commitChange(req, res, async (setlist) => {
      const requested = req.body.items.filter((it) => it?.kind === 'song').map((it) => String(it.song?._id || it.song || ''))
      const allowed = await sameWorkspaceSongIds(setlist, requested)
      const items = cleanItems(req.body.items, allowed)
      setlist.items = items
      setlist.songs = items.filter((it) => it.kind === 'song').map((it) => it.song)
      const kept = new Set(setlist.songs.map(String))
      setlist.songSettings = (setlist.songSettings || []).filter((s) => kept.has(s.song.toString()))
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── 확정 · 수정 이력 · 변경 확인 · 복원 ──

// POST /setlists/:id/confirm  { baseRevision } — 인도 권한이 있는 사람만
exports.confirmSetlist = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    if (!(await canLead(req.user, setlist))) return res.status(403).json({ message: '콘티 확정은 팀장이나 이 콘티의 인도자만 할 수 있습니다' })
    if (setlist.status === 'confirmed' && setlist.confirmedRevision === setlist.revision) {
      return res.json(await populateSetlist(setlist._id)) // 이미 지금 내용으로 확정됨
    }
    const again = setlist.status === 'confirmed'
    await commitChange(req, res, (s) => {
      s.status = 'confirmed'
      s.confirmedAt = new Date()
      s.confirmedBy = req.user._id
      s.confirmedRevision = s.revision + 1
      return again ? { changes: ['변경 내용을 반영해 다시 확정'] } : undefined
    }, { kind: 'confirm', setlist })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /setlists/:id/unconfirm  { baseRevision } — 인도 권한이 있는 사람만
exports.unconfirmSetlist = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    if (!(await canLead(req.user, setlist))) return res.status(403).json({ message: '확정 해제는 팀장이나 이 콘티의 인도자만 할 수 있습니다' })
    if (setlist.status !== 'confirmed') return res.json(await populateSetlist(setlist._id))
    await commitChange(req, res, (s) => { s.status = 'draft' }, { kind: 'unconfirm', setlist })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// GET /setlists/:id/history — 수정 이력(최근 100개)과 팀원별 변경 확인 기록
exports.getHistory = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    const revisions = await SetlistRevision.find({ setlist: setlist._id }, '-snapshot')
      .sort({ revision: -1 }).limit(100).populate('user', 'email').lean()
    const acks = await SetlistAck.find({ setlist: setlist._id }).populate('user', 'email').lean()
    let members = []
    if (setlist.team) {
      const team = await Team.findById(setlist.team, 'members owner').populate('members', 'email').lean()
      members = (team?.members || []).map((m) => ({ _id: m._id, email: m.email }))
    }
    res.json({
      revision: setlist.revision,
      status: setlist.status,
      confirmedRevision: setlist.confirmedRevision,
      canLead: await canLead(req.user, setlist),
      revisions: revisions.map((r) => ({
        revision: r.revision, kind: r.kind, changes: r.changes, afterConfirm: r.afterConfirm,
        user: r.user ? { _id: r.user._id, email: r.user.email } : null, at: r.createdAt,
      })),
      acks: acks.filter((a) => a.user).map((a) => ({ user: { _id: a.user._id, email: a.user.email }, revision: a.revision, at: a.updatedAt })),
      members,
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /setlists/:id/ack  { revision } — '변경 확인': 화면에서 본 판 번호까지 확인했다고 남긴다
exports.ackSetlist = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    const seen = Number(req.body?.revision)
    if (!Number.isInteger(seen) || seen < 0) return res.status(400).json({ message: '확인한 판 번호가 필요합니다' })
    // 화면이 아직 받지 못한 더 새 변경까지 확인한 것으로 남기지 않는다
    const revision = Math.min(seen, setlist.revision)
    const ack = await SetlistAck.findOneAndUpdate(
      { setlist: setlist._id, user: req.user._id },
      { $max: { revision } },
      { new: true, upsert: true }
    )
    res.json({ revision: ack.revision, latest: setlist.revision, upToDate: ack.revision >= setlist.revision })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /setlists/:id/restore  { revision, baseRevision } — 이전 판의 내용으로 되돌린다 (되돌린 것도 새 판으로 남는다)
// 복원 범위: 곡·곡 순서·콘티별 Key·메모·악보 선택·예배 순서·예배 종류·시작 시각
// 그대로 두는 것: 콘티 이름·날짜·장소·메모, 확정 상태, 공유 링크·비밀번호, 팀원 배정, 필기, 연습 기록, 진행 위치
exports.restoreSetlist = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    const target = Number(req.body?.revision)
    const rev = Number.isInteger(target)
      ? await SetlistRevision.findOne({ setlist: setlist._id, revision: target }).lean()
      : null
    if (!rev?.snapshot) return res.status(404).json({ message: '복원할 판을 찾을 수 없습니다' })
    if (target === setlist.revision) return res.status(400).json({ message: '지금 판과 같은 내용입니다' })

    await commitChange(req, res, async (s) => {
      const snap = rev.snapshot
      const allowed = await sameWorkspaceSongIds(s, snap.songs || [])
      const allowedSet = new Set(allowed.map(String))
      const missing = (snap.songs || []).length - allowed.length
      s.songs = allowed
      s.items = (snap.items || []).length ? cleanItems(snap.items, allowed) : []
      s.songSettings = (snap.songSettings || []).filter((x) => allowedSet.has(String(x.song)))
      s.serviceType = snap.serviceType || ''
      s.startTime = snap.startTime || ''
      if (s.items.length) syncItemsWithSongs(s)
      return { changes: [`${target}판 내용으로 복원`, ...(missing > 0 ? [`삭제된 곡 ${missing}곡은 복원하지 못함`] : [])] }
    }, { kind: 'restore', setlist })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── 연습 완료 (로그인한 사람 기준) ──

// 지금 콘티의 곡마다 연습 지문
async function currentFingerprints(setlist) {
  const songs = await Song.find({ _id: { $in: setlist.songs } }, 'key structure sheets sheetImageUrl sheetPdfUrl').lean()
  const settings = new Map((setlist.songSettings || []).map((s) => [String(s.song), s]))
  return new Map(songs.map((song) => [String(song._id), practiceFingerprint(song, settings.get(String(song._id)))]))
}

function practiceSummary(records, prints) {
  let done = 0
  let stale = 0
  const songs = []
  for (const r of records) {
    const print = prints.get(String(r.song))
    if (!print) continue // 콘티에서 빠진 곡
    const isStale = r.fingerprint !== print
    if (isStale) stale += 1
    else done += 1
    songs.push({ song: r.song, stale: isStale, at: r.updatedAt })
  }
  return { done, stale, total: prints.size, songs }
}

// GET /setlists/:id/practice → { mine: { done, stale, total, songs }, team: [{ user, done, stale, total }] }
exports.getPractice = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    const prints = await currentFingerprints(setlist)
    const records = await PracticeRecord.find({ setlist: setlist._id }).lean()
    const mine = practiceSummary(records.filter((r) => sameId(r.user, req.user._id)), prints)
    let team = []
    if (setlist.team) {
      const t = await Team.findById(setlist.team, 'members').populate('members', 'email').lean()
      team = (t?.members || []).map((m) => {
        const sum = practiceSummary(records.filter((r) => sameId(r.user, m._id)), prints)
        return { user: { _id: m._id, email: m.email }, done: sum.done, stale: sum.stale, total: sum.total }
      })
    }
    res.json({ mine, team })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// PUT /setlists/:id/practice/:songId  { done } — 내 연습 완료 표시 / 해제
exports.setPractice = async (req, res) => {
  try {
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    const songId = String(req.params.songId)
    if (!setlist.songs.some((id) => id.toString() === songId)) return res.status(404).json({ message: '이 콘티에 없는 곡입니다' })
    if (req.body?.done === false) {
      await PracticeRecord.deleteOne({ setlist: setlist._id, song: songId, user: req.user._id })
    } else {
      const prints = await currentFingerprints(setlist)
      await PracticeRecord.findOneAndUpdate(
        { setlist: setlist._id, song: songId, user: req.user._id },
        { $set: { fingerprint: prints.get(songId) || '' } },
        { upsert: true }
      )
    }
    const prints = await currentFingerprints(setlist)
    const records = await PracticeRecord.find({ setlist: setlist._id, user: req.user._id }).lean()
    res.json({ mine: practiceSummary(records, prints) })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// ── 예배 템플릿 ──
const templateScope = (ws, user) => (ws.team ? { team: ws.team._id } : { user: user._id, team: null })

// GET /setlists/templates?team=
exports.getTemplates = async (req, res) => {
  try {
    const ws = await resolveWorkspace(req.user, req.query.team)
    if (!ws) return res.status(403).json({ message: FORBIDDEN_WORKSPACE })
    res.json(await ServiceTemplate.find(templateScope(ws, req.user)).sort({ serviceType: 1, name: 1 }).limit(100))
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// POST /setlists/templates  { fromSetlist, name } — 콘티의 순서를 템플릿으로 저장
exports.createTemplate = async (req, res) => {
  try {
    req.params.id = req.body.fromSetlist
    const setlist = await findAccessibleSetlist(req)
    if (!setlist) return res.status(404).json({ message: 'Setlist not found' })
    const name = String(req.body.name || '').trim().slice(0, 40)
    if (!name) return res.status(400).json({ message: '템플릿 이름을 넣어 주세요' })

    // 순서를 아직 안 짠 콘티는 곡 수만큼 '찬양 자리'를 만든다
    const items = setlist.items.length
      ? setlist.items
      : setlist.songs.map(() => ({ kind: 'slot', title: '', minutes: 0, note: '' }))
    const scope = setlist.team ? { team: setlist.team } : { user: req.user._id, team: null }
    if ((await ServiceTemplate.countDocuments(scope)) >= 100) {
      return res.status(400).json({ message: '템플릿은 100개까지 저장할 수 있습니다' })
    }

    const template = await ServiceTemplate.create({
      name,
      serviceType: setlist.serviceType,
      startTime: setlist.startTime,
      venue: setlist.venue || '',
      items: toTemplateItems(items),
      team: setlist.team || null,
      user: req.user._id,
    })
    res.status(201).json(template)
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}

// DELETE /setlists/templates/:templateId — 만든 사람 또는 팀장
exports.deleteTemplate = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.templateId)) return res.status(404).json({ message: '템플릿을 찾을 수 없습니다' })
    const template = await ServiceTemplate.findOne({ _id: req.params.templateId, ...(await accessFilter(req.user)) })
    if (!template) return res.status(404).json({ message: '템플릿을 찾을 수 없습니다' })
    if (!(await canDelete(req.user, template))) return res.status(403).json({ message: '만든 사람이나 팀장만 지울 수 있습니다' })
    await template.deleteOne()
    res.json({ message: '템플릿을 지웠습니다' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
