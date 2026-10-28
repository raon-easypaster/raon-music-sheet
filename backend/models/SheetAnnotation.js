const mongoose = require('mongoose')

// 콘티 안에서 곡 악보 위에 그린 필기 (콘티·곡·악보 페이지마다 하나)
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
    // 어느 악보 페이지의 필기인지: 사진은 페이지 id, PDF는 'id#쪽'.
    // null = 예전 방식의 사진 악보 한 장 (이 칸이 생기기 전에 그린 필기)
    pageKey: { type: String, default: null },
    strokes: { type: [strokeSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // 저장할 때마다 1씩 올라간다. 다른 사람이 먼저 저장했는지 알아내는 데 쓴다
    version: { type: Number, default: 0 },
  },
  { timestamps: true }
)
sheetAnnotationSchema.index({ setlist: 1, song: 1, pageKey: 1 }, { unique: true })

const SheetAnnotation = mongoose.model('SheetAnnotation', sheetAnnotationSchema)

// 페이지별 필기 전에는 (콘티, 곡)마다 하나만 저장하는 색인이 있었다.
// 그 색인이 남아 있으면 같은 곡의 두 번째 페이지 필기를 저장할 수 없으므로 색인만 지운다 (필기 데이터는 그대로)
let indexChecked = null
SheetAnnotation.ensurePageIndex = (recheck = false) => {
  if (!indexChecked || recheck) {
    indexChecked = SheetAnnotation.collection.indexes()
      .then((list) => (list.some((i) => i.name === 'setlist_1_song_1')
        ? SheetAnnotation.collection.dropIndex('setlist_1_song_1')
        : null))
      .catch((err) => { if (err.codeName !== 'NamespaceNotFound') indexChecked = null })
      .then(() => SheetAnnotation.createIndexes())
      .catch(() => { indexChecked = null })
  }
  return indexChecked
}

module.exports = SheetAnnotation
