const mongoose = require('mongoose')

// 출석 체크: 예배·연습 한 번이 문서 하나, 나온 팀원을 present에 담는다
const attendanceSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    date: { type: Date, required: true },
    kind: { type: String, enum: ['예배', '연습', '기타'], default: '예배' },
    title: { type: String, trim: true, maxlength: 50, default: '' },
    present: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)
attendanceSchema.index({ team: 1, date: -1 })

module.exports = mongoose.model('Attendance', attendanceSchema)
