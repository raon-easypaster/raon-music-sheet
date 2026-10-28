const mongoose = require('mongoose')

// 팀 공지(notice)와 기도제목(prayer)
const teamPostSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    kind: { type: String, enum: ['notice', 'prayer'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    body: { type: String, trim: true, maxlength: 2000, default: '' },
    pinned: { type: Boolean, default: false }, // 공지만, 팀장만 고정할 수 있다
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 기도제목에 "함께 기도해요"를 누른 사람들
    prayedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)
teamPostSchema.index({ team: 1, pinned: -1, createdAt: -1 })

module.exports = mongoose.model('TeamPost', teamPostSchema)
