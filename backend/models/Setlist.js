const mongoose = require('mongoose')

// 예배 순서 한 줄 (찬양·찬양 자리·기도·말씀·광고·헌금·축도·기타)
const itemSchema = new mongoose.Schema({
  kind: { type: String, required: true },
  song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', default: null }, // kind가 song일 때
  title: { type: String, trim: true, default: '' },
  minutes: { type: Number, default: 0 },
  note: { type: String, trim: true, default: '' },
})

const setlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    venue: String,
    gigDate: Date,
    notes: String,
    serviceType: { type: String, trim: true, default: '' }, // 예배 종류 (주일 1부, 청년부 …)
    startTime: { type: String, trim: true, default: '' },   // 예배 시작 시각 'HH:MM'

    // 🔥 THIS WAS MISSING
    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Song',
      },
    ],

    // 예배 순서. 비어 있으면 songs 순서만 있는 예전 콘티로 본다.
    // 채워져 있으면 곡 순서는 items가 기준이고, songs는 items의 곡을 차례대로 담은 사본이다
    items: { type: [itemSchema], default: [] },

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
    return ret
  },
})

module.exports = mongoose.model('Setlist', setlistSchema)
module.exports.itemSchema = itemSchema