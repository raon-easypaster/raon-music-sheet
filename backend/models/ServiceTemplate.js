const mongoose = require('mongoose')
const { itemSchema } = require('./Setlist')

// 매주 반복되는 예배 순서. 곡은 담지 않고 '찬양 자리'로 남겨 둔다
const serviceTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    serviceType: { type: String, trim: true, default: '' },
    startTime: { type: String, trim: true, default: '' },
    venue: { type: String, trim: true, default: '' },
    items: { type: [itemSchema], default: [] },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('ServiceTemplate', serviceTemplateSchema)
