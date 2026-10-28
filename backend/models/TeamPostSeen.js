const mongoose = require('mongoose')

// 팀 소식을 마지막으로 본 때 (사람·팀마다 하나). 이후에 올라온 다른 사람의 글 수가 "안 읽은 글"이다
const teamPostSeenSchema = new mongoose.Schema({
  team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastSeenPostsAt: { type: Date, required: true },
})
teamPostSeenSchema.index({ team: 1, user: 1 }, { unique: true })

module.exports = mongoose.model('TeamPostSeen', teamPostSeenSchema)
