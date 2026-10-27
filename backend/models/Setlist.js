const mongoose = require('mongoose')

const setlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    venue: String,
    gigDate: Date,
    notes: String,

    // 🔥 THIS WAS MISSING
    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song',
      },
    ],

    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
    shareToken: {
      type: String,
      default: null,
    },
    // 공유 링크 비밀번호 (선택). bcrypt 암호로만 저장한다
    sharePinHash: {
      type: String,
      default: null,
    },
    // 비밀번호를 여러 번 틀리면 잠시 잠근다 (서버가 여러 대여도 같게 동작하도록 DB에 기록)
    sharePinFailures: { type: Number, default: 0 },
    sharePinLockedUntil: { type: Date, default: null },
    // 이 콘티에서만 쓰는 곡별 Key·메모 (곡 원본 정보는 그대로 둔다)
    songSettings: [
      {
        _id: false,
        song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
        key: { type: String, trim: true, default: '' },
        notes: { type: String, trim: true, default: '' },
      },
    ],
    currentSongIdx: {
      type: Number,
      default: 0,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
)

// 화면으로 보낼 때 공유 비밀번호 암호는 빼고, 설정 여부만 알려 준다
setlistSchema.set('toJSON', {
  transform(doc, ret) {
    ret.hasSharePin = !!ret.sharePinHash
    delete ret.sharePinHash
    delete ret.sharePinFailures
    delete ret.sharePinLockedUntil
    return ret
  },
})

module.exports = mongoose.model('Setlist', setlistSchema)