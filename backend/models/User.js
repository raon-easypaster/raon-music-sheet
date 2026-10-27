const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    // 팀장이 임시 비밀번호로 초기화하면 true → 다음 로그인 때 비밀번호 변경을 안내한다
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('User', userSchema)