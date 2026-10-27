const PinAttempt = require('../models/PinAttempt')

// 일정 시간(windowMs) 동안 key마다 limit번까지만 허용한다. 서버가 여러 대여도 같게 동작하도록 DB에 센다.
// 한도 안이면 true, 넘으면 false
exports.takeAttempt = async (key, limit, windowMs) => {
  const now = new Date()
  let doc
  try {
    doc = await PinAttempt.findOneAndUpdate(
      { key, expireAt: { $gt: now } },
      { $inc: { attempts: 1 }, $setOnInsert: { expireAt: new Date(now.getTime() + windowMs) } },
      { new: true, upsert: true }
    )
  } catch (err) {
    if (err.code !== 11000) throw err
    // 기한이 지났지만 아직 자동 삭제되지 않은 기록 → 새 기간으로 다시 시작
    doc = await PinAttempt.findOneAndUpdate(
      { key, expireAt: { $lte: now } },
      { attempts: 1, expireAt: new Date(now.getTime() + windowMs) },
      { new: true }
    )
    if (!doc) return exports.takeAttempt(key, limit, windowMs) // 동시에 다른 요청이 먼저 새로 시작한 경우
  }
  return doc.attempts <= limit
}

// 성공한 시도는 세지 않도록 방금 예약한 1회를 되돌린다 (예: 로그인 성공)
exports.refundAttempt = async (key) => {
  await PinAttempt.updateOne({ key, attempts: { $gt: 0 } }, { $inc: { attempts: -1 } })
}

// Vercel은 X-Forwarded-For를 실제 접속 주소로 덮어쓰므로(위조 불가) 이것을 먼저 쓴다.
// (다른 곳에 배포한다면 그 환경이 이 헤더를 덮어쓰는지 확인해야 한다)
exports.clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || '')
    .split(',')[0].trim()
