const mongoose = require('mongoose')

// 저작권 신고로 차단한 악보 파일 (/api/sheets/:fileId). 파일은 지우지 않고 보여 주지만 않는다 → 풀면 그대로 돌아온다
const blockedSheetSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, unique: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'CopyrightRequest', default: null },
    blockedBy: { type: String, default: '' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('BlockedSheet', blockedSheetSchema)
