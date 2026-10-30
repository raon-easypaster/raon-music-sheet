const mongoose = require('mongoose')

// 저작권 침해 신고 (삭제 요청). 누구나 로그인 없이 낼 수 있고, 운영자(ADMIN_EMAILS)만 본다
const copyrightRequestSchema = new mongoose.Schema(
  {
    receipt: { type: String, required: true, unique: true }, // 신고한 사람에게 알려 주는 접수 번호
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, enum: ['owner', 'agent', 'publisher', 'other'], default: 'owner' },
    work: { type: String, required: true, trim: true }, // 곡 제목 · 저작물
    location: { type: String, trim: true, default: '' }, // 공유 링크나 악보 주소, 찾는 데 도움이 되는 설명
    details: { type: String, trim: true, default: '' },
    shareToken: { type: String, default: '' }, // location에서 찾아낸 공유 링크
    fileIds: { type: [String], default: [] }, // location에서 찾아낸 악보 파일 번호
    status: { type: String, enum: ['received', 'reviewing', 'blocked', 'rejected', 'resolved'], default: 'received' },
    operatorNote: { type: String, trim: true, default: '' },
    handledBy: { type: String, default: '' },
    handledAt: { type: Date, default: null },
    ipHash: { type: String, default: '' },
  },
  { timestamps: true }
)
copyrightRequestSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('CopyrightRequest', copyrightRequestSchema)
