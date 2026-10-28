const mongoose = require('mongoose')

// 팀원이 "이 날은 못 나와요"라고 표시한 날짜 (하루 단위, UTC 자정으로 저장한다)
const unavailabilitySchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 100, default: '' },
  },
  { timestamps: true }
)
unavailabilitySchema.index({ team: 1, user: 1, date: 1 }, { unique: true })
unavailabilitySchema.index({ team: 1, date: 1 })

module.exports = mongoose.model('Unavailability', unavailabilitySchema)
