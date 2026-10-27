const mongoose = require('mongoose')

// 공유 비밀번호 시도 횟수. key = "ip:<공유토큰>:<IP>" (기기별) 또는 "link:<공유토큰>" (링크 전체)
// expireAt이 지나면 MongoDB가 문서를 자동으로 지운다
const pinAttemptSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  attempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },
  lockCount: { type: Number, default: 0 }, // 링크 전체 잠금이 몇 번 걸렸는지 (잠금 시간을 늘리는 데 쓴다)
  expireAt: { type: Date, required: true },
})
pinAttemptSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('PinAttempt', pinAttemptSchema)
