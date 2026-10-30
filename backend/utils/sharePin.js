const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const PinAttempt = require('../models/PinAttempt')
const { clientIp } = require('./rateLimit')
const optionalUser = require('./optionalUser')
const { accessFilter } = require('./access')

// 공유 링크로 볼 수 있는지 확인 (공유 화면·필기 화면이 함께 쓴다)
// - 기기(IP)마다 5번 틀리면 15분 잠금, 여러 기기 합쳐 30번 틀리면 링크 전체 잠금(잠길 때마다 두 배, 최대 24시간)
// - 필기 화면은 몇 초마다 다시 불러오므로, 한 번 맞힌 비밀번호는 잠시 기억해서 매번 암호 비교를 하지 않는다
const PIN_LOCK_MS = 15 * 60 * 1000
const PIN_MAX_LOCK_MS = 24 * 60 * 60 * 1000
const PIN_LIMITS = { ip: 5, link: 30 }
const VERIFIED_TTL_MS = 10 * 60 * 1000
const verified = new Map() // key → 만료 시각

async function reserveAttempt(key, limit, escalate = false) {
  const now = new Date()
  const keepUntil = new Date(now.getTime() + (escalate ? 7 * PIN_MAX_LOCK_MS : PIN_LOCK_MS * 2))
  let doc
  try {
    doc = await PinAttempt.findOneAndUpdate(
      { key, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] },
      { $inc: { attempts: 1 }, $set: { expireAt: keepUntil, lockedUntil: null } },
      { new: true, upsert: true }
    )
  } catch (err) {
    if (err.code !== 11000) throw err // 잠긴 문서가 있어 새로 만들 수 없음 = 잠김
    return 'locked'
  }
  if (doc.attempts <= limit) return 'ok'

  const lockCount = (doc.lockCount || 0) + 1
  const lockMs = escalate ? Math.min(PIN_LOCK_MS * 2 ** (lockCount - 1), PIN_MAX_LOCK_MS) : PIN_LOCK_MS
  await PinAttempt.updateOne({ key }, { attempts: 0, lockCount, lockedUntil: new Date(now.getTime() + lockMs), expireAt: keepUntil })
  return 'locked'
}

// → 'ok' | 'wrong' | 'locked'
exports.checkSharePin = async (setlist, req) => {
  if (!setlist.sharePinHash) return 'ok'
  const pin = String(req.headers['x-share-pin'] || '')
  if (!pin) return 'wrong'

  const ipKey = `ip:${setlist.shareToken}:${clientIp(req)}`
  const linkKey = `link:${setlist.shareToken}`
  // 잠겨 있으면 기억해 둔 비밀번호도 쓰지 않는다 (잠긴 동안 계속 맞혀 보는 것을 막는다)
  if (await PinAttempt.exists({ key: { $in: [ipKey, linkKey] }, lockedUntil: { $gt: new Date() } })) return 'locked'

  // 비밀번호를 바꾸면 sharePinHash가 달라지므로 기억해 둔 것도 저절로 무효가 된다
  const cacheKey = crypto.createHash('sha256').update(`${setlist.sharePinHash}\n${pin}`).digest('hex')
  const until = verified.get(cacheKey)
  if (until && until > Date.now()) return 'ok'

  const ipResult = await reserveAttempt(ipKey, PIN_LIMITS.ip)
  if (ipResult !== 'ok') return ipResult
  const linkResult = await reserveAttempt(linkKey, PIN_LIMITS.link, true)
  if (linkResult !== 'ok') return linkResult

  if (await bcrypt.compare(pin, setlist.sharePinHash)) {
    await PinAttempt.deleteOne({ key: ipKey })
    await PinAttempt.updateOne({ key: linkKey, attempts: { $gt: 0 } }, { $inc: { attempts: -1 } })
    if (verified.size > 1000) verified.clear()
    verified.set(cacheKey, Date.now() + VERIFIED_TTL_MS)
    return 'ok'
  }
  return 'wrong'
}

exports.rejectPin = (res, result) => {
  if (result === 'locked') {
    return res.status(429).json({ message: '비밀번호를 여러 번 틀려 15분 동안 잠겼습니다. 잠시 후 다시 시도하거나, 공유한 분에게 비밀번호를 새로 걸어 달라고 해 주세요', needPin: true, locked: true })
  }
  return res.status(401).json({ message: '이 콘티는 비밀번호가 필요합니다', needPin: true })
}

// 로그인한 사람이 이 콘티를 앱에서 볼 수 있는 사람(팀원·만든 사람)인가
async function isMember(setlist, req) {
  const user = await optionalUser(req)
  if (!user) return false
  const Setlist = require('../models/Setlist')
  return !!(await Setlist.exists({ _id: setlist._id, ...(await accessFilter(user)) }))
}

// → 'ok' | 'login'(잠긴 링크, 비밀번호 없음) | 'wrong' | 'locked'
// - 팀원(로그인)은 비밀번호 없이 늘 볼 수 있다
// - 잠긴 링크(shareOpen === false): 비밀번호가 걸려 있으면 비밀번호로, 아니면 팀원 로그인으로만
// - 열린 링크(예전 링크 포함): 비밀번호가 걸려 있으면 비밀번호, 아니면 누구나
exports.checkShareAccess = async (setlist, req) => {
  if (await isMember(setlist, req)) return 'ok'
  if (setlist.sharePinHash) return exports.checkSharePin(setlist, req)
  return setlist.shareOpen === false ? 'login' : 'ok'
}

exports.rejectShare = (res, result) => {
  if (result === 'login') {
    return res.status(401).json({ message: '팀원만 볼 수 있는 링크입니다. 이 콘티의 팀 계정으로 로그인해 주세요', needLogin: true })
  }
  return exports.rejectPin(res, result)
}
