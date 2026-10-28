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
        sheetId: { type: String, trim: true, default: '' }, // 직접 고른 악보. 빈 값 = Key에 맞춰 자동
      },
    ],
    currentSongIdx: {
      type: Number,
      default: 0,
    },
    // 실시간 진행: 지금 곡을 넘기는 사람(진행자)과 마지막 신호. liveSeq는 곡을 넘길 때마다 1씩 오른다
    presenter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    presenterSeenAt: { type: Date, default: null },
    presenterSeq: { type: Number, default: 0 }, // 진행자가 바뀔 때마다 오른다
    liveSeq: { type: Number, default: 0 },

    // 작성 중 / 확정. 예전 콘티는 작성 중으로 본다
    status: { type: String, enum: ['draft', 'confirmed'], default: 'draft' },
    // 내용(곡·순서·Key·메모·악보 선택·예배 순서·기본 정보)이 바뀔 때마다 1씩 오른다. 이력·변경 확인·충돌 확인에 쓴다
    revision: { type: Number, default: 0 },
    confirmedAt: { type: Date, default: null },
    confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    confirmedRevision: { type: Number, default: 0 },
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