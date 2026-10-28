const mongoose = require('mongoose')

// 연습 완료 표시 (로그인한 사람 기준이라 다른 기기에서도 이어진다)
// fingerprint: 완료할 때의 악보·Key·송폼·메모 지문. 지금 지문과 다르면 '변경 후 재확인 필요'
const practiceRecordSchema = new mongoose.Schema(
  {
    setlist: { type: mongoose.Schema.Types.ObjectId, ref: 'Setlist', required: true },
    song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    fingerprint: { type: String, default: '' },
  },
  { timestamps: true }
)
practiceRecordSchema.index({ setlist: 1, user: 1, song: 1 }, { unique: true })

module.exports = mongoose.model('PracticeRecord', practiceRecordSchema)
