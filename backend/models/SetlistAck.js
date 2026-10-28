const mongoose = require('mongoose')

// 팀원이 콘티 변경 사항을 확인한 기록. revision = 확인할 때의 콘티 판 번호
const setlistAckSchema = new mongoose.Schema(
  {
    setlist: { type: mongoose.Schema.Types.ObjectId, ref: 'Setlist', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    revision: { type: Number, required: true },
  },
  { timestamps: true }
)
setlistAckSchema.index({ setlist: 1, user: 1 }, { unique: true })

module.exports = mongoose.model('SetlistAck', setlistAckSchema)
