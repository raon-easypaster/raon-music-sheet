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
    // 각자 따로 표시하는 즐겨찾기 곡 (다른 사람에게는 보이지 않는다)
    favoriteSongs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song',
      },
    ],
    // 임시 비밀번호의 유효 기한 (지나면 그 임시 비밀번호로는 로그인할 수 없다)
    tempPasswordExpiresAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('User', userSchema)