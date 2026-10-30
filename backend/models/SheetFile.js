const mongoose = require('mongoose')

// 앱에 올린 악보 파일(/api/sheets/:fileId)을 누가 올렸는지. 곡에 저장하기 전에도 올린 사람은 볼 수 있게 한다
// (이 기록이 없는 예전 파일은 그 파일을 쓰는 곡으로 권한을 판단한다)
const sheetFileSchema = new mongoose.Schema(
  {
    fileId: { type: String, required: true, unique: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('SheetFile', sheetFileSchema)
