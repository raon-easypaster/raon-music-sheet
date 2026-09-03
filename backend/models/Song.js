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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Song', songSchema)