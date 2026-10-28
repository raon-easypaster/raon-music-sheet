const mongoose = require('mongoose')

// 콘티(예배)마다 누가 어떤 자리(인도·싱어·건반…)를 맡는지. 배정받은 사람이 수락하거나 거절한다
const assignmentSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    setlist: { type: mongoose.Schema.Types.ObjectId, ref: 'Setlist', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, required: true, trim: true, maxlength: 20 },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    declineReason: { type: String, trim: true, maxlength: 200, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)
assignmentSchema.index({ team: 1, setlist: 1 })
assignmentSchema.index({ team: 1, user: 1 })
// 같은 사람을 같은 콘티의 같은 자리에 두 번 넣지 않는다
assignmentSchema.index({ setlist: 1, user: 1, role: 1 }, { unique: true })

module.exports = mongoose.model('Assignment', assignmentSchema)
