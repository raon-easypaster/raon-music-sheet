const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/authMiddleware')

const {
  createSetlist,
  getSetlists,
  updateSetlist,
  deleteSetlist,
  addSongsToSetlist,
  removeSongFromSetlist,
  reorderSongs,
  getShareToken,
  getPublicSetlist,
  getPublicCurrentSong,
  setPublicCurrentSong,
  duplicateSetlist,
  updateSongSettings,
  setSharePin,
  setCurrentSong,
} = require('../controllers/setlistController')

// Public routes (no auth)
router.get('/public/:token', getPublicSetlist)
router.get('/public/:token/current', getPublicCurrentSong)
router.put('/public/:token/current', setPublicCurrentSong)

// Protected routes
router.post('/', protect, createSetlist)
router.get('/', protect, getSetlists)
router.put('/:id', protect, updateSetlist)
router.delete('/:id', protect, deleteSetlist)
router.put('/:id/songs', protect, addSongsToSetlist)
router.put('/:id/remove-song', protect, removeSongFromSetlist)
router.put('/:id/reorder', protect, reorderSongs)
router.post('/:id/share', protect, getShareToken)
router.put('/:id/share-pin', protect, setSharePin)
router.put('/:id/current', protect, setCurrentSong)
router.post('/:id/duplicate', protect, duplicateSetlist)
router.put('/:id/song-settings/:songId', protect, updateSongSettings)

module.exports = router
