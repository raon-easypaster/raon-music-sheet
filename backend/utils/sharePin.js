const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const PinAttempt = require('../models/PinAttempt')
const { clientIp } = require('./rateLimit')

// 공유 비밀번호 확인 — setlistController의 checkSharePin과 같은 규칙·같은 시도 기록(PinAttempt)을 쓴다
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

  // 비밀번호를 바꾸면 sharePinHash가 달라지므로 기억해 둔 것도 저절로 무효가 된다
  const cacheKey = crypto.createHash('sha256').update(`${setlist.sharePinHash}\n${pin}`).digest('hex')
  const until = verified.get(cacheKey)
  if (until && until > Date.now()) return 'ok'

  const ipKey = `ip:${setlist.shareToken}:${clientIp(req)}`
  const linkKey = `link:${setlist.shareToken}`
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
