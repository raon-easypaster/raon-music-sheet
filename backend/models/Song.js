const mongoose = require('mongoose')

const songSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    artist: {
      type: String,
      trim: true,
      default: '',
    },
    key: {
      type: String,
      trim: true,
      default: '',
    },
    bpm: {
      type: Number,
      default: 0,
    },
    youtubeUrl: {
      type: String,
      trim: true,
      default: '',
    },
    mrUrl: {
      type: String,
      trim: true,
      default: '',
    },
    sheetImageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    sheetPdfUrl: {
      type: String,
      trim: true,
      default: '',
    },
    structure: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    capo: {
      type: Number,
      default: 0,
    },

    // 악보 (Key별로 여러 개, 한 악보에 사진 여러 장 또는 PDF).
    // 비어 있으면 위의 sheetImageUrl·sheetPdfUrl을 'Key 미확인' 악보로 쓴다 (예전 곡 그대로 동작).
    // 채워져 있으면 sheetImageUrl·sheetPdfUrl은 첫 악보를 따라가는 사본이다.
    sheets: {
      type: [
        {
          _id: false,
          id: { type: String, required: true },        // 악보 번호 (콘티에서 고른 악보를 가리킴)
          key: { type: String, trim: true, default: '' }, // 악보에 실제로 적힌 Key. 빈 값 = 미확인
          label: { type: String, trim: true, default: '' },
          pages: [
            {
              _id: false,
              id: { type: String, required: true },     // 페이지 번호 (필기가 이 번호에 붙는다)
              type: { type: String, enum: ['image', 'pdf'], required: true },
              url: { type: String, required: true },
            },
          ],
        },
      ],
      default: [],
    },

    // ── 곡 분류 (모두 선택 입력) ──
    tempo: { type: String, trim: true, default: '' },          // 느림 | 보통 | 빠름 (BPM으로 자동 채움, 바꿀 수 있음)
    timeSignature: { type: String, trim: true, default: '' },  // 4/4, 3/4, 6/8 …
    themes: { type: [String], default: [] },                   // 주제·절기 태그
    target: { type: String, trim: true, default: '' },         // 찬양의 대상
    traits: { type: [String], default: [] },                   // 곡 특성 (고백, 선포 …)
    hymnNumber: { type: String, trim: true, default: '' },     // 찬송가 번호
    scripture: { type: String, trim: true, default: '' },      // 관련 성경구절
    lyricist: { type: String, trim: true, default: '' },
    composer: { type: String, trim: true, default: '' },
    durationMin: { type: Number, default: 0 },                 // 곡 길이(분). 0이면 예배 시간 계산에 4분으로 셈
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
    },
  },
  { timestamps: true }
)

// 악보 파일 주소로 곡을 찾는다 (악보 파일을 보여 줄 때 권한 확인)
songSchema.index({ 'sheets.pages.url': 1 })

module.exports = mongoose.model('Song', songSchema)