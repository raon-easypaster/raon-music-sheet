const mongoose = require('mongoose')

// 콘티 수정 이력. 한 번 바뀔 때마다 하나씩, 바뀐 뒤의 내용(snapshot)과 읽기 쉬운 변경 내역(changes)을 남긴다
const setlistRevisionSchema = new mongoose.Schema(
  {
    setlist: { type: mongoose.Schema.Types.ObjectId, ref: 'Setlist', required: true },
    revision: { type: Number, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    kind: { type: String, enum: ['start', 'change', 'confirm', 'unconfirm', 'restore'], default: 'change' },
    changes: { type: [String], default: [] },
    afterConfirm: { type: Boolean, default: false }, // 확정된 뒤에 고친 것
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
)
setlistRevisionSchema.index({ setlist: 1, revision: -1 })

module.exports = mongoose.model('SetlistRevision', setlistRevisionSchema)
