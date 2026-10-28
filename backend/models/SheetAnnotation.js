const mongoose = require('mongoose')

// 콘티 안에서 곡 악보 위에 그린 필기 (콘티·곡마다 하나)
// 좌표는 악보 이미지 크기에 대한 비율(0~1)이라 화면 크기가 달라도 같은 자리에 보인다
const strokeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    tool: { type: String, enum: ['pen', 'highlighter'], default: 'pen' },
    color: { type: String, required: true },
    width: { type: Number, required: true }, // 이미지 가로 1000 기준 굵기
    points: { type: [[Number]], default: [] },
  },
  { _id: false }
)

const sheetAnnotationSchema = new mongoose.Schema(
  {
    setlist: { type: mongoose.Schema.Types.ObjectId, ref: 'Setlist', required: true },
    song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
    strokes: { type: [strokeSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // 저장할 때마다 1씩 올라간다. 다른 사람이 먼저 저장했는지 알아내는 데 쓴다
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
)
sheetAnnotationSchema.index({ setlist: 1, song: 1 }, { unique: true })

module.exports = mongoose.model('SheetAnnotation', sheetAnnotationSchema)
