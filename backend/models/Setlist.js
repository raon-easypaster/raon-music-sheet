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
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Setlist', setlistSchema)